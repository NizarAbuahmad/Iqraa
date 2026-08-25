#!/usr/bin/env python3
"""Import Grade 10 Chemistry support + official PDFs into knowledge-base + JSON catalog."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from pathlib import Path

DEFAULT_SRC = Path(
    r"c:\Users\Lenovo\Downloads\Raya studio\Iqraa\Calude app\Knowledge Base\10th grade\alchamy"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_PDF = ROOT / "knowledge-base" / "grade-10-chemistry" / "support-pdfs"
OUT_DATA = ROOT / "artifacts" / "mobile" / "data" / "g10_chem_support_resources.json"

# ─────────────────────────────────────────────────────────────────────────────
# STOP, 2026-08-25.
#
# This script writes `artifacts/mobile/data/g10_chem_support_resources.json`,
# a catalog that no longer exists. It described the same PDFs as
# `lib/curriculum/src/data/g10_sources.json` under a second id space and a
# second type vocabulary, the two drifted, and the manifest absorbed it.
#
# Running this as-is recreates the split — and silently, because nothing
# imports the file it writes any more, so the damage would only show up the
# next time someone believed it. Point OUT_DATA at the manifest and teach the
# type rules to emit `kind` values before removing this guard.
# ─────────────────────────────────────────────────────────────────────────────
if os.environ.get("IQRA_ALLOW_LEGACY_SUPPORT_IMPORT") != "1":
    raise SystemExit(
        "Refusing to run: this writes the retired per-subject support catalog.\n"
        "The bank now lives in lib/curriculum/src/data/g10_sources.json.\n"
        "Set IQRA_ALLOW_LEGACY_SUPPORT_IMPORT=1 only if you have read the note above."
    )


SKIP_NAMES = {
    "school brochure updated.pdf",
}

TYPE_RULES = [
    (r"^كتاب الطالب|^دليل المعلم|^كتاب الأنشطة|alchamy|alchamy\.|10th grade", "official_book"),
    (r"^اختبار|^أسئلة|^بنك أسئلة", "quiz"),
    (r"^ورقة عمل|^أوراق عمل", "worksheet"),
    (r"^ملخص|^ملزمة", "summary"),
    (r"^دوسية|^المادة المقررة|^فاقد", "remedial"),
]

UNIT_RULES = [
    (r"الوحدة الأولى|البنية الذرية|نظرية بور|ماكس بلانك|بور الذري", ["chem-s1-u1"]),
    (r"الوحدة الثانية|الجدول الدوري", ["chem-s1-u2"]),
    (r"الوحدة الثالثة|الروابط|التساهمية|الأيونية", ["chem-s1-u3"]),
    (r"الوحدة الرابعة", ["chem-s2-u4"]),
    (r"الوحدة الخامسة|التفاعلات الكيميائية", ["chem-s2-u5"]),
    (r"الفصل الثاني|2nd semester|alchamy\.2nd", ["chem-s2"]),
    (r"الفصل الأول|1st semester|alchamy1st|الفصل الدراسي الأول", ["chem-s1"]),
]


def classify(name: str):
    stem = name.rsplit(".", 1)[0]
    rtype = "support"
    for pat, t in TYPE_RULES:
        if re.search(pat, stem, re.I):
            rtype = t
            break
    units: list[str] = []
    for pat, tags in UNIT_RULES:
        if re.search(pat, stem, re.I):
            for t in tags:
                if t not in units:
                    units.append(t)
    if not units:
        units = ["chem-g10-general"]
    m = re.search(r"(?:أ\.|م\.|المعلمة)\s*([^\.]+?)(?:\.pdf)?$", stem)
    author = m.group(1).strip() if m else None
    title = re.sub(r"\s*(?:أ\.|م\.|إعداد المعلمة|إعداد م\.|إعداد)\s*[^\.]+$", "", stem).strip() or stem
    return rtype, units, author, title


def main(src: Path = DEFAULT_SRC) -> None:
    if not src.is_dir():
        raise SystemExit(f"Source folder not found: {src}")

    OUT_PDF.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(
        f
        for f in src.iterdir()
        if f.suffix.lower() == ".pdf" and f.name.lower() not in SKIP_NAMES
    )

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
    for i, f in enumerate(unique, 1):
        rtype, units, author, title = classify(f.name)
        dest = OUT_PDF / f.name
        if not dest.exists():
            shutil.copy2(f, dest)
            print(f"copied {i}/{len(unique)}")
        resources.append(
            {
                "id": f"g10-chem-sup-{i:03d}",
                "titleAr": title,
                "filename": f.name,
                "type": rtype,
                "unitTags": units,
                "authorAr": author,
                "sizeBytes": f.stat().st_size,
                "subjectId": "chemistry",
                "keywords": [
                    "grade-10",
                    "chemistry",
                    "كيمياء",
                    "عاشر",
                    *units,
                    rtype,
                ],
            }
        )

    catalog = {
        "meta": {
            "grade": "الصف العاشر",
            "subject": "الكيمياء",
            "subjectId": "chemistry",
            "purpose": "Official books + teacher support materials for Iqra chemistry grounding.",
            "pdf_dir_relative": "knowledge-base/grade-10-chemistry/support-pdfs",
            "source_note": f"Imported from {src}. Brochure skipped; (1) duplicates collapsed.",
            "count_unique": len(unique),
            "count_source": len(pdfs),
        },
        "resources": resources,
    }
    OUT_DATA.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    by_type: dict[str, int] = {}
    for r in resources:
        by_type[r["type"]] = by_type.get(r["type"], 0) + 1
    print(f"Wrote {len(resources)} resources → {OUT_DATA}")
    print(f"PDFs → {OUT_PDF}")
    print("by_type", by_type)


if __name__ == "__main__":
    import sys

    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC)
