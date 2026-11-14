"""
Which pages of a student book open a UNIT — its cover, the page listing its lessons,
its competencies («كفايات الوحدة»), the English unit overview — so a lesson's page
range can stop before them.

Why
───
Both page renderers end a lesson on the page before the next lesson opens
(`map_lesson_pages.ranges`, `verify_book_pages.lesson_ranges`). That is right inside
a unit and wrong at its end: the next lesson is the first of a new unit, and the
pages before it are that unit's cover and overview, so every unit's last lesson
ended on one to three pages of the NEXT unit. A 2026-11-13 review of Grades 5 and 8
found it on about 40 of 99 unit-final lessons (status log, «Grade 3 review…»).

How a page is recognised
────────────────────────
Only from its text, and the text layer of these books is scrambled: letters swap
around the article («الحركة» → «احلركة»), words come out glued or reversed, and
some titles are set in a font whose letters extract as nonsense («كفايات» reads
«ئفبخ»). So nothing here compares strings. A marker is a multiset of letters, and a
page "has" it when some short stretch of the page's letters holds that multiset —
order and spacing play no part. The markers are things only an opener prints:

- a unit's lesson list: «دروس الوحدة», «قائمة الدروس»;
- a cover: «الوحدة» with an ordinal or a number, on a page with little else on it
  (a maths exercise page also prints «الوحدة 5», in a header over a full page);
- the competencies page: all five language skills listed together (a lesson page
  names its own one);
- the English pupil's book overview: every skill heading on one page.

A unit REVIEW («مراجعة الوحدة»), summary («حصاد الوحدة») or project at the END of a
unit is not an opener and is left with the lesson before it.

Callers only trim at a unit boundary and only walk back over pages this says yes
to, so a page it misses is shown as before, and a lesson page cannot be cut unless
it reads as one of the above.

Pure functions: nothing here opens a PDF (`opener_pages` takes any object whose
pages have `get_text()`), so `test_unit_openers.py` runs without one.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from typing import Callable

MARKS = re.compile(r"[ً-ٰٟـۖ-ۭ]")
FOLD = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه", "ؤ": "و", "ئ": "ي"})
ARABIC = re.compile(r"[ء-ي]")

# A cover carries a title and a sentence or two (101-169 letters on the Grade 5
# covers measured); a page with more Arabic letters than this is a content page,
# whatever its header says.
COVER_MAX_LETTERS = 180
SKILLS_MIN_LETTERS = 700
# How far past a marker's own length its letters may be spread.
SLACK = 3
# The most pages a unit's opening ever takes (cover, lesson list, competencies).
MAX_OPENER_PAGES = 4

ORDINALS = ["الاولي", "الثانيه", "الثالثه", "الرابعه", "الخامسه", "السادسه", "السابعه", "الثامنه", "التاسعه", "العاشره"]
SKILLS_AR = ["الاستماع", "التحدث", "القراءه", "الكتابه", "اللغوي"]
SKILLS_EN = ["vocabulary", "grammar", "listening", "speaking", "reading", "writing"]


def letters(text: str) -> str:
    """The page's Arabic letters in reading order, diacritics dropped and alef/ya/ta folded."""
    text = unicodedata.normalize("NFKC", text)
    text = MARKS.sub("", text).translate(FOLD)
    return "".join(ARABIC.findall(text))


def has(stream: str, marker: str, slack: int = SLACK) -> bool:
    """Does some stretch of `stream` hold every letter of `marker` (as a multiset)?"""
    need = Counter(letters(marker))
    n = sum(need.values())
    width = n + slack
    if not n or len(stream) < n:
        return False
    window = Counter(stream[:width])
    if not need - window:
        return True
    for i in range(width, len(stream)):
        window[stream[i]] += 1
        window[stream[i - width]] -= 1
        if not need - window:
            return True
    return False


def words(text: str) -> str:
    """Folded text with word breaks kept, for markers whose word ORDER matters."""
    text = unicodedata.normalize("NFKC", text)
    text = MARKS.sub("", text).translate(FOLD)
    return " ".join(re.sub(r"[^ء-ي]+", " ", text).split())


# «ال» comes out «لا» in these text layers, so the article may appear either way round.
ART = r"(?:ال|لا)"
# A lesson-list heading, in order: a sentence that merely mentions «دروس وحدة …» holds
# the same letters, so a letter count is not enough here.
LIST = re.compile(rf"دروس {ART}وحده|قايمه {ART}دروس")
# A unit's END («نهاية الوحدة», its review or summary) belongs to the lesson before it.
END = re.compile(rf"(?:نهايه|مراجعه|حصاد) {ART}وحده")


def ordinals(stream: str) -> set[int]:
    """The units a page names («الوحدة الثانية» → {1}), from its letter stream."""
    return {i for i, o in enumerate(ORDINALS) if has(stream, "الوحده" + o, 2)}


def overview(text: str) -> bool:
    """A page that opens a unit whatever unit it names: its lesson list, its
    competencies, the English overview. Never the unit's end (review, summary)."""
    folded = words(text)
    if END.search(folded):
        return False
    if LIST.search(folded):
        return True
    stream = letters(text)
    # The competencies page («كفايات الوحدة») lists the unit's five language skills;
    # its own title often extracts as nonsense, so the list is what identifies it. It
    # is a long page (1,400-1,800 letters on the Grade 5 books); on a short, badly
    # scrambled page four skill names can turn up in the letter soup by chance.
    if len(stream) >= SKILLS_MIN_LETTERS and sum(has(stream, s, 1) for s in SKILLS_AR) >= 4:
        return True
    low = text.lower()
    return sum(s in low for s in SKILLS_EN) >= 5


def cover(text: str, own: frozenset[int] | set[int] = frozenset()) -> bool:
    """A unit cover: an ordinal on a page with almost nothing else on it, naming a
    unit the lesson's own pages (`own`) do not. The Arabic books print «الوحدة
    التاسعة» as a running header, and an exercise page of blank answer lines is as
    short as a cover; it is told apart by naming the lesson's own unit."""
    if END.search(words(text)):
        return False
    stream = letters(text)
    return len(stream) <= COVER_MAX_LETTERS and bool(ordinals(stream) - set(own))


def is_unit_opener(text: str, own: frozenset[int] | set[int] = frozenset()) -> bool:
    return overview(text) or cover(text, own)


def trim_end(start: int, end: int, text_of: Callable[[int], str]) -> int:
    """`end`, walked back over the next unit's opener pages that close the range.

    Call it only for a lesson that is the last of its unit. `text_of(page)` gives a
    page's text (1-based). Never goes past `start`, never more than MAX_OPENER_PAGES.
    """
    own: set[int] = set()
    for p in range(start, end + 1):
        stream = letters(text_of(p))
        # A content page's running header names this unit. The next unit's overview
        # names that unit, so it does not count even when it is long.
        if len(stream) > COVER_MAX_LETTERS and not overview(text_of(p)):
            own |= ordinals(stream)
    steps = 0
    while end > start and steps < MAX_OPENER_PAGES and is_unit_opener(text_of(end), own):
        end -= 1
        steps += 1
    return end
