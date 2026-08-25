#!/usr/bin/env python3
"""Import Grade 10 Math support PDFs into knowledge-base + JSON catalog."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from pathlib import Path

DEFAULT_SRC = Path(
    r"c:\Users\Lenovo\Downloads\Raya studio\Iqraa\Calude app\Knowledge Base\10th grade\Math\new resou"
)
ROOT = Path(__file__).resolve().parents[1]
OUT_PDF = ROOT / "knowledge-base" / "grade-10-math" / "support-pdfs"
OUT_DATA = ROOT / "artifacts" / "mobile" / "data" / "g10_math_support_resources.json"

# ─────────────────────────────────────────────────────────────────────────────
# STOP, 2026-08-25.
#
# This script writes `artifacts/mobile/data/g10_math_support_resources.json`,
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


TYPE_RULES = [
    (r"^اختبار|^أسئلة مقترحة|^أسئلة موضوعية", "quiz"),
    (r"^ورقة عمل|^أوراق عمل", "worksheet"),
    (r"^إجابات|^حل ", "answer_key"),
    (r"^ملخص", "summary"),
    (r"^خطة|^مادة التدخل|^المادة المقررة|^المادة المساندة|^دوسية|^أسس الرياضيات|^قوانين", "remedial"),
]

UNIT_RULES = [
    (r"المصفوفات", ["s1-matrices"]),
    (r"الأسس والمعادلات|أنظمة المعادلات|كثيرات الحدود|معادلة خطية ومعادلة تربيعية", ["s1-u1"]),
    (r"الدائرة|أوتار|مماسات|الزاوية المركزية|الزاوية المحيطية|الشكل الرباعي الدائري|الزاوية المماسية", ["s1-u2"]),
    (r"حساب المثلثات", ["s1-u3"]),
    (r"الاقترانات|اقتران", ["s2-u5"]),
    (r"الاشتقاق|مشتق", ["s2-u6"]),
    (r"هندس|الأشكال الهندسية", ["geometry-ref"]),
    (r"الوحدة السادسة", ["s2-u6"]),
    (r"الوحدة السابعة", ["s2-u7"]),
    (r"الفصل الثاني", ["s2"]),
    (r"الفصل الأول|تشخيص|علاجي|فاقد|مساندة|تأسيس|أسس الرياضيات|البرنامج العلاجي", ["s1", "remedial"]),
]


def classify(name: str):
    stem = name.rsplit(".", 1)[0]
    rtype = "support"
    for pat, t in TYPE_RULES:
        if re.search(pat, stem):
            rtype = t
            break
    units: list[str] = []
    for pat, tags in UNIT_RULES:
        if re.search(pat, stem):
            for t in tags:
                if t not in units:
                    units.append(t)
    if not units:
        units = ["g10-math-general"]
    m = re.search(r"أ\.?\s*([^\.]+?)(?:\.pdf)?$", stem)
    author = m.group(1).strip() if m else None
    title = re.sub(r"\s*أ\.?\s*[^\.]+$", "", stem).strip() or stem
    return rtype, units, author, title


def main(src: Path = DEFAULT_SRC) -> None:
    if not src.is_dir():
        raise SystemExit(f"Source folder not found: {src}")

    OUT_PDF.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(f for f in src.iterdir() if f.suffix.lower() == ".pdf")

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
        resources.append(
            {
                "id": f"g10-math-sup-{i:03d}",
                "titleAr": title,
                "filename": f.name,
                "type": rtype,
                "unitTags": units,
                "authorAr": author,
                "sizeBytes": f.stat().st_size,
                "keywords": ["grade-10", "math", "رياضيات", "عاشر", *units, rtype],
            }
        )

    catalog = {
        "meta": {
            "grade": "الصف العاشر",
            "subject": "الرياضيات",
            "purpose": "Supporting teacher materials for Iqra chat grounding.",
            "pdf_dir_relative": "knowledge-base/grade-10-math/support-pdfs",
            "source_note": f"Imported from {src}. Duplicate (1) files collapsed by content hash.",
            "count_unique": len(unique),
            "count_source": len(pdfs),
        },
        "resources": resources,
    }
    OUT_DATA.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(resources)} resources → {OUT_DATA}")
    print(f"PDFs → {OUT_PDF}")


if __name__ == "__main__":
    import sys

    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC)
