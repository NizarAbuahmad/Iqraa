#!/usr/bin/env python3
"""
Import support PDFs into knowledge-base/ + a catalog JSON, one pack or all of them.

Generalises `import_g10_math_support.py` and `import_g10_chem_support.py`,
which each hardcode one grade, one subject, one Windows path and one set of
unit rules. Phase one is grades 1-10, so that shape would mean a new copy of
the same script per subject per grade — roughly sixty of them.

Run it on the machine holding the PDFs (they are gitignored by design: a
teacher guide alone is 45 MB). Point it at the whole Knowledge Base:

    python scripts/import_support_pdfs.py \\
        --root "C:\\...\\Iqraa\\Calude app\\Knowledge Base"

...which walks `<grade folder>/<subject folder>/` itself (see `kb_layout.py`),
so a grade added to that folder later is picked up by re-running the same
command. Or point it at one pack:

    python scripts/import_support_pdfs.py --grade 9 --subject math \\
        --src "C:\\...\\Knowledge Base\\9th grade\\Math"

    # See what it would classify, touching nothing:
    python scripts/import_support_pdfs.py --root ... --dry-run

Unit tagging is deliberately optional. A file with no matching rule is
catalogued as `<grade>-<subject>-general` rather than skipped: it is better to
have every PDF listed and some of them untagged than to silently drop the ones
whose unit is not yet known. Tags come from the teacher guide, which is usually
read after the files land — so tag rules live in `unit_rules/` and can be added
later without re-copying anything.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

from kb_layout import discover, report_unrecognised

ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = ROOT / "scripts" / "unit_rules"

# Type is inferred from how Jordanian teachers name these files. Order matters:
# «إجابات أسئلة كتاب التمارين» is an answer key, not an exercise book.
TYPE_RULES: list[tuple[str, str]] = [
    (r"^إجابات|^حل ", "answer_key"),
    # `^أسئلة` broadly, plus `بنك أسئلة` anywhere: the chemistry pack ships
    # «أسئلة منوعة» and «بنك أسئلة الكيمياء», which a narrower rule dropped
    # into the catch-all where they stop being findable as practice items.
    (r"^اختبار|^أسئلة|بنك أسئلة|^امتحان", "quiz"),
    (r"^ورقة عمل|^أوراق عمل", "worksheet"),
    (r"^ملخص|^ملزمة", "summary"),
    (
        r"^خطة|^مادة التدخل|^المادة المقررة|^المادة المساندة|^دوسية"
        r"|^أسس الرياضيات|^قوانين|علاجي|فاقد|تأسيس",
        "remedial",
    ),
    (r"^دليل المعلم", "teacher_guide"),
    # The definite article is optional: the Grade 9 set ships «كتاب تمارين
    # الرياضيات» while Grade 10 ships «كتاب التمارين». Requiring «ال»
    # dropped both Grade 9 exercise books into the catch-all, where they
    # read as unidentified "support material". It has to be an optional
    # GROUP — `ال?` makes only the lām optional and still demands the alef.
    # The chemistry pack's official books are named in English
    # («alchamy.2nd semester», «10th grade, alchamy1st semester»).
    (r"^كتاب (?:ال)?(?:طالب|تمارين|أنشطة|نشاط)|alchamy|^\d+th grade", "official_book"),
]

SUBJECT_AR = {
    "math": "الرياضيات",
    "science": "العلوم",
    "chemistry": "الكيمياء",
    "physics": "الفيزياء",
    "biology": "الأحياء",
    "arabic": "اللغة العربية",
    "english": "اللغة الإنجليزية",
    "islamic": "التربية الإسلامية",
    "social": "الدراسات الاجتماعية",
    "computer": "الحاسوب",
    "finlit": "الثقافة المالية",
}

GRADE_AR = {
    1: "الصف الأول", 2: "الصف الثاني", 3: "الصف الثالث", 4: "الصف الرابع",
    5: "الصف الخامس", 6: "الصف السادس", 7: "الصف السابع", 8: "الصف الثامن",
    9: "الصف التاسع", 10: "الصف العاشر", 11: "الصف الحادي عشر", 12: "الصف الثاني عشر",
}

# The full-subject id the app uses, so catalog `subjectId` matches SUBJECTS
# in lib/curriculum. `math` is the folder name; `mathematics` is the id.
SUBJECT_ID = {"math": "mathematics", "finlit": "financial-literacy"}


def load_unit_rules(grade: int, subject: str) -> list[tuple[str, list[str]]]:
    """
    Per-grade/subject regex → unit tags, from `scripts/unit_rules/g9-math.json`.

    Missing file is not an error: everything is catalogued untagged, and the
    rules can be added once the teacher guide has been read.
    """
    path = RULES_DIR / f"g{grade}-{subject}.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [(entry["pattern"], entry["tags"]) for entry in data.get("rules", [])]


def classify(
    name: str, unit_rules: list[tuple[str, list[str]]], fallback_tag: str
) -> tuple[str, list[str], str | None, str]:
    stem = name.rsplit(".", 1)[0]

    rtype = "support"
    for pat, t in TYPE_RULES:
        if re.search(pat, stem):
            rtype = t
            break

    units: list[str] = []
    for pat, tags in unit_rules:
        if re.search(pat, stem):
            for t in tags:
                if t not in units:
                    units.append(t)
    if not units:
        units = [fallback_tag]

    # «... إعداد أ. أحمد فرخ» → author "أحمد فرخ", title without the credit.
    m = re.search(r"أ\.?\s*([^\.]+?)(?:\.pdf)?$", stem)
    author = m.group(1).strip() if m else None
    title = re.sub(r"\s*(?:إعداد\s*)?أ\.?\s*[^\.]+$", "", stem).strip() or stem
    return rtype, units, author, title


def tagged_count(catalog: dict) -> int:
    """Resources carrying a real unit tag rather than the `-general` fallback."""
    return sum(
        1 for r in catalog.get("resources", [])
        if not (len(r.get("unitTags", [])) == 1 and str(r["unitTags"][0]).endswith("-general"))
    )


def consumer_of(catalog_path: Path) -> Path | None:
    """The app file that imports this catalog, or None when nothing reads it."""
    name = catalog_path.name
    services = ROOT / "artifacts" / "mobile" / "services"
    if not services.is_dir():
        return None
    for f in sorted(services.rglob("*.ts")):
        try:
            if name in f.read_text(encoding="utf-8"):
                return f
        except OSError:
            continue
    return None


def import_pack(
    grade: int, subject: str, src: Path, dry_run: bool, force: bool = False
) -> tuple[int, int, bool]:
    """
    Import one `<grade>/<subject>` folder. Returns (unique PDFs, untagged, refused).

    Returns zeroes rather than raising when a folder holds no PDFs — under
    `--root` one empty subject folder must not abort the other nineteen.
    """
    slug = f"grade-{grade}-{subject}"
    fallback_tag = f"g{grade}-{subject}-general"
    out_pdf = ROOT / "knowledge-base" / slug / "support-pdfs"
    out_data = ROOT / "artifacts" / "mobile" / "data" / f"g{grade}_{subject}_support_resources.json"
    unit_rules = load_unit_rules(grade, subject)

    pdfs = sorted(f for f in src.iterdir() if f.suffix.lower() == ".pdf")
    if not pdfs:
        # Named out loud. A subject folder that exists but holds nothing is a
        # different problem from one that was never found, and only one of
        # them is fixed by adding files.
        print(f"  -- grade {grade} {subject}: no PDFs in {src}")
        return 0, 0, False

    # Collapse Windows "(1)" duplicates by content hash, preferring the name
    # without the suffix — the same file downloaded twice is one resource.
    by_hash: dict[str, Path] = {}
    for f in pdfs:
        h = hashlib.md5(f.read_bytes()).hexdigest()
        prev = by_hash.get(h)
        if not prev:
            by_hash[h] = f
        elif "(1)" in prev.name and "(1)" not in f.name:
            by_hash[h] = f
        elif len(f.name) < len(prev.name) and "(1)" not in f.name:
            by_hash[h] = f

    unique = sorted(by_hash.values(), key=lambda p: p.name)
    resources = []
    untagged = 0
    for i, f in enumerate(unique, 1):
        rtype, units, author, title = classify(f.name, unit_rules, fallback_tag)
        if units == [fallback_tag]:
            untagged += 1
        if not dry_run:
            out_pdf.mkdir(parents=True, exist_ok=True)
            dest = out_pdf / f.name
            if not dest.exists():
                shutil.copy2(f, dest)
        resources.append({
            "id": f"g{grade}-{subject}-sup-{i:03d}",
            "titleAr": title,
            "filename": f.name,
            "type": rtype,
            "unitTags": units,
            "authorAr": author,
            "sizeBytes": f.stat().st_size,
            "subjectId": SUBJECT_ID.get(subject, subject),
            "keywords": [f"grade-{grade}", subject, SUBJECT_AR[subject], *units, rtype],
        })

    catalog = {
        "meta": {
            "grade": GRADE_AR[grade],
            "subject": SUBJECT_AR[subject],
            "subjectId": SUBJECT_ID.get(subject, subject),
            "purpose": "Supporting teacher materials for Iqra chat grounding.",
            "pdf_dir_relative": f"knowledge-base/{slug}/support-pdfs",
            "source_note": f"Imported from {src}. Duplicate (1) files collapsed by content hash.",
            "count_unique": len(unique),
            "count_source": len(pdfs),
            "count_untagged": untagged,
            "unit_rules": f"scripts/unit_rules/g{grade}-{subject}.json" if unit_rules else None,
        },
        "resources": resources,
    }

    by_type: dict[str, int] = {}
    for r in resources:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    types = ", ".join(f"{t} {n}" for t, n in sorted(by_type.items(), key=lambda kv: -kv[1]))
    print(f"  ok grade {grade} {subject}: {len(pdfs)} source → {len(unique)} unique ({types})")
    if untagged:
        # Say it out loud. An untagged resource is invisible to unit-scoped
        # search, which is how it would otherwise never surface for a lesson.
        print(f"     {untagged} untagged — add rules to scripts/unit_rules/g{grade}-{subject}.json")

    # Refuse to flatten an existing catalog's unit tags. `--root` runs over
    # every grade at once, and a grade whose `unit_rules/` file is missing
    # would otherwise rewrite a fully-tagged catalog as all-`-general` with
    # nothing on screen to say a whole grade just stopped being findable by
    # unit. Losing tags is a decision, so it has to be made out loud.
    if out_data.exists():
        try:
            before = tagged_count(json.loads(out_data.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            before = 0
        after = len(resources) - untagged
        if after < before and not force:
            print(
                f"     !! REFUSED: {out_data.name} already has {before} unit-tagged "
                f"resource(s), this run would leave {after}.\n"
                f"        Add scripts/unit_rules/g{grade}-{subject}.json, or pass --force "
                f"to overwrite anyway.",
                file=sys.stderr,
            )
            return len(unique), untagged, True

    if not dry_run:
        out_data.parent.mkdir(parents=True, exist_ok=True)
        out_data.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"     → {out_data.relative_to(ROOT)}  (PDFs → {out_pdf.relative_to(ROOT)}, gitignored)")
        # A catalog no app file imports is a file that exists and does nothing.
        # Only `g10_math` and `g10_chem` are wired up today, so every new grade
        # lands here — better said than discovered when a lesson has no
        # resources and everything looks imported.
        if consumer_of(out_data) is None:
            print(f"     note: nothing in artifacts/mobile/services imports "
                  f"{out_data.name} yet, so these resources are not searchable "
                  f"in the app until it is wired in.")
    return len(unique), untagged, False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=None,
                    help="Knowledge Base root; walks <grade>/<subject>/ itself")
    ap.add_argument("--grade", type=int, default=None, choices=range(1, 13))
    ap.add_argument("--subject", default=None, help=f"one of: {', '.join(SUBJECT_AR)}")
    ap.add_argument("--src", type=Path, default=None, help="folder holding one pack's PDFs")
    ap.add_argument("--dry-run", action="store_true", help="classify and report, write nothing")
    ap.add_argument("--force", action="store_true",
                    help="overwrite a catalog even when it would lose unit tags")
    args = ap.parse_args()

    if args.root and (args.grade or args.subject or args.src):
        print("Use --root, or --grade/--subject/--src — not both.", file=sys.stderr)
        return 2

    packs: list[tuple[int, str, Path]] = []
    if args.root:
        disc = discover(args.root)
        for p in disc.packs:
            if p.subject not in SUBJECT_AR:
                # kb_layout knows a folder name this script has no Arabic
                # label for. Skipping quietly would lose the whole subject.
                print(f"  !! grade {p.grade}: subject {p.subject!r} has no entry in "
                      f"SUBJECT_AR — not imported ({p.path})", file=sys.stderr)
                continue
            packs.append((p.grade, p.subject, p.path))
        if not packs and not disc.unrecognised:
            print(f"No grade/subject folders under {args.root}", file=sys.stderr)
            report_unrecognised(disc)
            return 2
        print(f"{len(packs)} pack(s) under {args.root}\n")
    else:
        if not (args.grade and args.subject and args.src):
            print("Give --root, or all of --grade, --subject and --src.", file=sys.stderr)
            return 2
        if args.subject not in SUBJECT_AR:
            print(f"Unknown subject {args.subject!r}. Known: {', '.join(SUBJECT_AR)}", file=sys.stderr)
            return 2
        if not args.src.is_dir():
            print(f"Source folder not found: {args.src}", file=sys.stderr)
            return 2
        packs = [(args.grade, args.subject, args.src)]
        disc = None

    total_files = 0
    total_untagged = 0
    refused = 0
    for grade, subject, src in packs:
        n, untagged, was_refused = import_pack(grade, subject, src, args.dry_run, args.force)
        total_files += n
        total_untagged += untagged
        refused += int(was_refused)

    print(f"\n{total_files} unique PDF(s) across {len(packs)} pack(s); {total_untagged} untagged.")
    if args.dry_run:
        print("--dry-run: nothing written.")
    if disc is not None:
        report_unrecognised(disc)
    if refused:
        # A refusal is not a success. Exiting 0 here would let a scripted run
        # over the whole knowledge base look clean while a grade's catalog was
        # deliberately left unwritten.
        print(f"{refused} pack(s) refused — see above.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
