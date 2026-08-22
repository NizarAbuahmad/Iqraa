#!/usr/bin/env python3
"""
Pull the few pages that matter out of a Jordanian دليل المعلم.

A teacher guide is ~45 MB and a few hundred pages, but the curriculum data
comes from three page *types*, and everything else is the student book
reproduced with notes around it:

  • «مُخطَّط الوحدة»  — lesson names, النتاجات, المصطلحات, الأدوات, عدد الحصص.
                        One table per unit, and it is the whole schema.
  • the vertical-alignment page — what the grade before covered, this grade
                        covers, the grade after will. This is `prior_knowledge`,
                        transcribed rather than inferred.
  • «نتاجات الدرس»    — per-lesson outcomes, useful as a cross-check.

Run it where the PDFs are and commit the small text files it writes. A unit's
extract is a few KB against a 45 MB binary that is gitignored anyway, and it
travels through a chat window without any of this having to be uploaded.

    pip install pypdf
    python scripts/extract_curriculum_pages.py --grade 9 --subject math \\
        --src "C:\\...\\9th grade\\Math"

Writes to `curriculum-extracts/g<grade>-<subject>/<pdf name>.md`, one section
per matched page, with the page number so anything surprising can be checked
against the original.

On some Linux images the system `cryptography` build panics on import and
prints a Rust backtrace to stderr. That noise is harmless — `load_pypdf()`
catches it and falls back — and it does not appear on a normal Windows or
macOS install. Judge the run by its summary line, not by the backtrace.

**Read what it produces before trusting it.** Some guides carry fonts whose
glyphs do not map back to Unicode, and those pages extract as `/uniXXXX`
escapes. The script counts how many pages came out that way and says so — a
file with a high count needs a human to read the PDF, not a parser.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The alignment page names two neighbouring grades alongside this one.
GRADE_WORDS = [
    "الصفالأول", "الصفالثاني", "الصفالثالث", "الصفالرابع", "الصفالخامس",
    "الصفالسادس", "الصفالسابع", "الصفالثامن", "الصفالتاسع", "الصفالعاشر",
    "الصفالحاديعشر", "الصفالثانيعشر",
]


def show(path: Path) -> str:
    """Repo-relative when it is inside the repo, absolute when `--out` is not."""
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def load_pypdf():
    """
    Import pypdf, working around a broken system `cryptography` build.

    pypdf pulls cryptography in for encrypted PDFs. Where that package's rust
    bindings panic on import, the panic is not an ImportError and pypdf's own
    fallback chain never gets a chance — so block the module and let pypdf use
    its pure-python provider. Curriculum PDFs are not encrypted.
    """
    class Blocked:
        def find_module(self, name, path=None):
            return self if name == "cryptography" or name.startswith("cryptography.") else None

        def load_module(self, name):
            raise ImportError("blocked: see load_pypdf()")

    try:
        import pypdf  # noqa: F401
        return pypdf
    except BaseException:
        sys.meta_path.insert(0, Blocked())
        import pypdf
        return pypdf


def squash(text: str) -> str:
    """Normalised, harakat- and space-free, for matching."""
    return re.sub(r"[\u064B-\u0652\u0640\s]+", "", unicodedata.normalize("NFKC", text))


def readable(text: str) -> str:
    """Presentation-form Arabic → standard letters, for output."""
    return unicodedata.normalize("NFKC", text)


def broken_glyph_ratio(text: str) -> float:
    """Share of the page that came out as `/uniXXXX` escapes."""
    if not text:
        return 0.0
    escaped = len(re.findall(r"/uni[0-9A-Fa-f]{4}", text)) * 7
    return min(1.0, escaped / max(1, len(text)))


def classify_page(text: str) -> str | None:
    s = squash(text)
    if "مخططالوحدة" in s:
        return "unit-plan"
    # Two or more grade names on one page is the vertical-alignment table.
    if sum(1 for g in GRADE_WORDS if g in s) >= 2:
        return "vertical-alignment"
    if "نتاجاتالدرس" in s:
        return "lesson-outcomes"
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--grade", type=int, required=True, choices=range(1, 13))
    ap.add_argument("--subject", required=True)
    ap.add_argument("--src", required=True, type=Path, help="folder of teacher-guide PDFs, or one PDF")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    pypdf = load_pypdf()
    src: Path = args.src
    pdfs = [src] if src.is_file() else sorted(f for f in src.iterdir() if f.suffix.lower() == ".pdf")
    if not pdfs:
        print(f"No PDFs at {src}", file=sys.stderr)
        return 2

    out_dir = args.out or (ROOT / "curriculum-extracts" / f"g{args.grade}-{args.subject}")
    out_dir.mkdir(parents=True, exist_ok=True)

    total_hits = 0
    for pdf in pdfs:
        try:
            reader = pypdf.PdfReader(str(pdf))
        except Exception as e:  # noqa: BLE001
            # One unreadable file must not stop the rest — the whole point is
            # a batch pass over a grade's worth of guides.
            print(f"  !! {pdf.name}: cannot read ({e})", file=sys.stderr)
            continue

        sections: list[str] = []
        broken_pages = 0
        for i, page in enumerate(reader.pages, 1):
            try:
                raw = page.extract_text() or ""
            except Exception:  # noqa: BLE001
                continue
            kind = classify_page(raw)
            if not kind:
                continue
            if broken_glyph_ratio(raw) > 0.15:
                broken_pages += 1
            sections.append(f"\n\n## p{i} — {kind}\n\n```\n{readable(raw).strip()}\n```")

        if not sections:
            print(f"  -- {pdf.name}: no curriculum pages found ({len(reader.pages)} pages)")
            continue

        header = (
            f"# {pdf.name}\n\n"
            f"- grade: {args.grade}\n- subject: {args.subject}\n"
            f"- pages in file: {len(reader.pages)}\n"
            f"- curriculum pages extracted: {len(sections)}\n"
        )
        if broken_pages:
            header += (
                f"- **{broken_pages} of these pages have broken glyph encoding "
                f"(`/uniXXXX`) — read the PDF for those, do not trust the text below.**\n"
            )
        dest = out_dir / f"{pdf.stem}.md"
        dest.write_text(header + "".join(sections) + "\n", encoding="utf-8")
        total_hits += len(sections)
        flag = f"  ({broken_pages} broken)" if broken_pages else ""
        print(f"  ok {pdf.name}: {len(sections)} page(s) → {show(dest)}{flag}")

    print(f"\n{total_hits} curriculum page(s) extracted from {len(pdfs)} PDF(s) → {show(out_dir)}")
    if total_hits == 0:
        # Silence here would read as "nothing to extract" rather than "the
        # matcher did not fire", which are very different problems.
        print(
            "\nNothing matched. Either these are not teacher guides, or the guide\n"
            "words its unit plan differently — open one and check for «مُخطَّط الوحدة».",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
