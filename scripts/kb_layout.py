"""
Discover grade/subject folders under the Knowledge Base root.

Everything lives under one folder and keeps growing:

    Knowledge Base/
      9th grade/
        Math/
        Science/
      10th grade/
        Math/
        Chemistry/

Phase one is grades 1-10, so being told "here is grade 9 maths" once per
folder is sixty invocations. This walks the root instead, and both importers
take `--root` so one command covers whatever is currently there — including
folders added after the command was last run.

Unrecognised folders are **reported, not skipped silently**. A subject folder
whose name this does not know is exactly the case where a whole grade's
material would otherwise go missing with nothing on screen to say so.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# Folder name → the subject id the rest of the pipeline uses. Keys are matched
# case-insensitively against the folder name with spaces and underscores gone.
SUBJECT_FOLDERS: dict[str, str] = {
    "math": "math",
    "maths": "math",
    "mathematics": "math",
    "الرياضيات": "math",
    "science": "science",
    "العلوم": "science",
    "chemistry": "chemistry",
    "الكيمياء": "chemistry",
    "physics": "physics",
    "الفيزياء": "physics",
    "biology": "biology",
    "الأحياء": "biology",
    "arabic": "arabic",
    "اللغةالعربية": "arabic",
    "العربية": "arabic",
    "english": "english",
    "اللغةالإنجليزية": "english",
    "الإنجليزية": "english",
    "islamic": "islamic",
    "islamicstudies": "islamic",
    "التربيةالإسلامية": "islamic",
    "social": "social",
    "socialstudies": "social",
    "الدراساتالاجتماعية": "social",
    "computer": "computer",
    "الحاسوب": "computer",
    "finlit": "finlit",
    "financialliteracy": "finlit",
    "الثقافةالمالية": "finlit",
}

# «9th grade», «Grade 9», «grade-9», «9», «الصف التاسع».
ARABIC_ORDINALS = {
    "الأول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6,
    "السابع": 7, "الثامن": 8, "التاسع": 9, "العاشر": 10,
    "الحاديعشر": 11, "الثانيعشر": 12,
}


def _key(name: str) -> str:
    return re.sub(r"[\s_\-]+", "", name).lower()


def parse_grade(folder_name: str) -> int | None:
    """Grade number from a folder name, or None when it is not a grade folder."""
    k = _key(folder_name)
    m = re.search(r"(\d{1,2})", k)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 12:
            return n
        # Out of range is not a verdict — «رياضيات 2024» has digits in it and
        # is still not a grade folder, so fall through to the Arabic names
        # rather than declaring the folder unplaceable on the strength of a year.
    # Longest first: «الصف الثاني عشر» contains «الثاني», so checking in
    # declaration order would read grade 12 as grade 2.
    for word in sorted(ARABIC_ORDINALS, key=len, reverse=True):
        if word in k:
            return ARABIC_ORDINALS[word]
    return None


def parse_subject(folder_name: str) -> str | None:
    """Subject id from a folder name, or None when it is not a known subject."""
    return SUBJECT_FOLDERS.get(_key(folder_name))


@dataclass
class Pack:
    grade: int
    subject: str
    path: Path


@dataclass
class Discovery:
    packs: list[Pack]
    """(path, why) for every folder that could not be placed."""
    unrecognised: list[tuple[Path, str]]


def discover(root: Path) -> Discovery:
    """
    Walk `root` for `<grade folder>/<subject folder>/` pairs holding PDFs.

    A subject folder with no PDFs directly inside is still returned — the
    caller reports "no PDFs" rather than this silently pretending it is not a
    pack, which would be indistinguishable from not finding the folder at all.
    """
    packs: list[Pack] = []
    unrecognised: list[tuple[Path, str]] = []

    if not root.is_dir():
        return Discovery(packs, [(root, "not a directory")])

    for grade_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        grade = parse_grade(grade_dir.name)
        if grade is None:
            unrecognised.append((grade_dir, "folder name has no grade in it"))
            continue
        for subject_dir in sorted(p for p in grade_dir.iterdir() if p.is_dir()):
            subject = parse_subject(subject_dir.name)
            if subject is None:
                unrecognised.append((subject_dir, f"unknown subject folder for grade {grade}"))
                continue
            packs.append(Pack(grade=grade, subject=subject, path=subject_dir))

    return Discovery(packs, unrecognised)


def report_unrecognised(disc: Discovery) -> None:
    """Print what could not be placed. Silence here loses a whole subject."""
    if not disc.unrecognised:
        return
    print(f"\n{len(disc.unrecognised)} folder(s) not recognised and therefore NOT imported:")
    for path, why in disc.unrecognised:
        print(f"  • {path.name}  — {why}")
    print("  Add the folder name to SUBJECT_FOLDERS in scripts/kb_layout.py, or rename it.")
