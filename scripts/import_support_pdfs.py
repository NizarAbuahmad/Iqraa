#!/usr/bin/env python3
"""
Import a folder of support PDFs into knowledge-base/ + a catalog JSON.

Generalises `import_g10_math_support.py` and `import_g10_chem_support.py`,
which each hardcode one grade, one subject, one Windows path and one set of
unit rules. Phase one is grades 1-10, so that shape would mean a new copy of
the same script per subject per grade — roughly sixty of them.

Run it on the machine holding the PDFs (they are gitignored by design: a
teacher guide alone is 45 MB):

    python scripts/import_support_pdfs.py --grade 9 --subject math \\
        --src "C:\\...\\Knowledge Base\\9th grade\\Math"

    # See what it would classify, touching nothing:
    python scripts/import_support_pdfs.py --grade 9 --subject math --src ... --dry-run

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


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--grade", type=int, required=True, choices=range(1, 13))
    ap.add_argument("--subject", required=True, help=f"one of: {', '.join(SUBJECT_AR)}")
    ap.add_argument("--src", required=True, type=Path, help="folder holding the PDFs")
    ap.add_argument("--dry-run", action="store_true", help="classify and report, write nothing")
    args = ap.parse_args()

    if args.subject not in SUBJECT_AR:
        print(f"Unknown subject {args.subject!r}. Known: {', '.join(SUBJECT_AR)}", file=sys.stderr)
        return 2
    if not args.src.is_dir():
        print(f"Source folder not found: {args.src}", file=sys.stderr)
        return 2

    grade, subject = args.grade, args.subject
    slug = f"grade-{grade}-{subject}"
    fallback_tag = f"g{grade}-{subject}-general"
    out_pdf = ROOT / "knowledge-base" / slug / "support-pdfs"
    out_data = ROOT / "artifacts" / "mobile" / "data" / f"g{grade}_{subject}_support_resources.json"
    unit_rules = load_unit_rules(grade, subject)

    pdfs = sorted(f for f in args.src.iterdir() if f.suffix.lower() == ".pdf")
    if not pdfs:
        print(f"No PDFs in {args.src}", file=sys.stderr)
        return 2

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
        if not args.dry_run:
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
            "source_note": f"Imported from {args.src}. Duplicate (1) files collapsed by content hash.",
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
    print(f"{len(pdfs)} source PDFs → {len(unique)} unique")
    for t, n in sorted(by_type.items(), key=lambda kv: -kv[1]):
        print(f"  {t:<15} {n}")
    if untagged:
        # Say it out loud. An untagged resource is invisible to unit-scoped
        # search, which is how it would otherwise never surface for a lesson.
        print(f"\n{untagged} file(s) have no unit tag — add rules to "
              f"scripts/unit_rules/g{grade}-{subject}.json once the teacher guide is read.")

    if args.dry_run:
        print("\n--dry-run: nothing written.")
        return 0

    out_data.parent.mkdir(parents=True, exist_ok=True)
    out_data.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {len(resources)} resources → {out_data.relative_to(ROOT)}")
    print(f"PDFs → {out_pdf.relative_to(ROOT)} (gitignored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
