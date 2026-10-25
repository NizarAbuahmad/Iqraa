"""Write the committed glossary data from gl-accepted.json / gl-held.json, keyed by the app's catalog book ids."""
import json, os, collections
import os, pathlib
REPO = os.environ.get("IQRAA_REPO") or str(pathlib.Path(__file__).resolve().parents[4])
EXTRACTED = REPO + "/lib/curriculum/src/data/extracted"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, ".work")
os.makedirs(WORK, exist_ok=True)
OUT = REPO + "/lib/curriculum/src/data/glossary"
BOOK_ID = {
    "chem-s2-student-book": "book-chem-10-s2", "bio-s1-student-book": "book-bio-10-s1", "bio-s2-student-book": "book-bio-10-s2",
    "earth-s1-student-book": "book-earth-10-s1", "earth-s2-student-book": "book-earth-10-s2",
    "phys-s1-student-book": "book-phys-10-s1", "phys-s2-student-book": "book-phys-10-s2",
    "g9-chemistry-s1-student-book": "book-chem-9-s1", "g9-chemistry-s2-student-book": "book-chem-9-s2",
    "g9-biology-s1-student-book": "book-biology-9-s1", "g9-biology-s2-student-book": "book-biology-9-s2",
    "g9-earth-science-s1-student-book": "book-earth-science-9-s1", "g9-earth-science-s2-student-book": "book-earth-science-9-s2",
    "g9-physics-s1-student-book": "book-phys-9-s1", "g9-physics-s2-student-book": "book-phys-9-s2",
}
acc = json.load(open(WORK + "/accepted.json", encoding="utf-8"))
held = json.load(open(WORK + "/held.json", encoding="utf-8"))
os.makedirs(OUT, exist_ok=True)
entries = [{"bookId": BOOK_ID[e["book"]], "page": e["page"], "ar": e["ar"], "en": e["en"], "def": e["def"]} for e in acc]
entries.sort(key=lambda e: (e["bookId"], e["page"]))
meta = {
    "what": "The printed «مسرد المصطلحات» (glossary) of the NCCD Grade 9-10 science student books, read from each PDF's own glyph data (scripts/glossary/). Definitions are the book's, word for word; nothing here was written by a model.",
    "repairs": "The PDFs' text layer drops or swaps the lam-alef ligature (لا -> ال); it is restored from glyph widths, tatweel and doubled marks are removed, and a few reversed terms are corrected (filter_glossary.py). Entries the filters or a reviewer found damaged are held back in science-g9-10.held.json; others may still carry damage a person has not read yet.",
    "gaps": "Grade 10 chemistry S1 has no entries: its source PDF was not available. Grade 10 physics S1 has 23, with the symbol in brackets after each term stripped.",
}
json.dump({"meta": meta, "entries": entries}, open(OUT + "/science-g9-10.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
hl = [{"bookId": BOOK_ID[h["book"]], "page": h["page"], "ar": h["ar"], "en": h["en"], "def": h["def"], "why": h["why"]} for h in held]
json.dump({"note": "Held back from science-g9-10.json: not shown to students. Fix by hand against the book page, then move into entries.", "held": hl}, open(OUT + "/science-g9-10.held.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(entries), "entries;", len(hl), "held")
print(collections.Counter(e["bookId"] for e in entries))
