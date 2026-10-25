"""Extract the printed «مسرد المصطلحات» of the science G9-10 student books, from the PDFs' own glyph data.

Pipeline (needs PyMuPDF and the student-book PDFs, which are not in git — set IQRAA_REPO to the
checkout that has them; output goes to .work/, git-ignored):
    python extract_glossary.py    # every book's glossary pages -> .work/raw.json
    python filter_glossary.py     # accepted / held-back, with a reason -> .work/accepted.json, held.json
    python emit_glossary.py       # -> src/data/glossary/science-g9-10.json (+ .held.json)
glossary-pages.json lists each book's glossary start page. chem-s1's PDF was missing when this was run.

The text layer extracts the lam-alef ligature (لا) as alef-lam («ال»). A real article «ال» is two
normal-width glyphs; the ligature is a ZERO-width alef followed by one wide lam glyph. So a zero-width
alef/hamza-alef immediately followed by lam is swapped back to lam + alef.

Every entry starts on a row that holds the English term in a colour (never black); wrapped lines of a
definition have none. Right-to-left on the entry row: [bullet] Arabic term, English term, ':', definition.
"""
import sys, os, re, json
import fitz

import os, pathlib
REPO = os.environ.get("IQRAA_REPO") or str(pathlib.Path(__file__).resolve().parents[4])
EXTRACTED = REPO + "/lib/curriculum/src/data/extracted"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, ".work")
os.makedirs(WORK, exist_ok=True)
PAGES = json.load(open(HERE + "/glossary-pages.json", encoding="utf-8"))
ALEF = set("اأإآ")
LATIN = re.compile(r"[A-Za-z]")
HARAKAT = re.compile(r"[\u064B-\u0652\u0670\u0640]")
BULLET = {"•", "●", "▪", "■"}


def fix(chars, size=12.0):
    """chars: list of (char, width) in logical order -> text with lam-alef restored.

    A: zero-width alef-variant then a wide lam = one ligature glyph, extracted in swapped order.
    B: one WIDE alef-variant = the ligature glyph with its lam lost (normal alef is ~0.22em, the ligature ~0.6em).
    """
    wide = 0.45 * size
    out, i = [], 0
    while i < len(chars):
        c, w = chars[i]
        if c in ALEF and w < 0.5 and i + 1 < len(chars) and chars[i + 1][0] == "ل":
            out.append("ل")
            out.append(c)
            i += 2
            continue
        if c in ALEF and w > wide:
            out.append("ل")
            out.append(c)
            i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def rows_of(page):
    """Group spans into visual rows (same y), each span fixed and with its x0 / colour."""
    d = page.get_text("rawdict")
    spans = []
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                chars = [(c["c"], c["bbox"][2] - c["bbox"][0]) for c in s["chars"]]
                text = fix(chars, s["size"])
                if not text.strip():
                    continue
                spans.append({"y": l["bbox"][1], "x0": s["bbox"][0], "color": s["color"], "text": text})
    spans.sort(key=lambda s: (s["y"], -s["x0"]))
    rows, cur = [], []
    for s in spans:
        if cur and abs(s["y"] - cur[0]["y"]) > 2.5:
            rows.append(cur)
            cur = []
        cur.append(s)
    if cur:
        rows.append(cur)
    for r in rows:
        r.sort(key=lambda s: -s["x0"])
    return rows


def is_english(s):
    return s["color"] != 0 and len(LATIN.findall(s["text"])) >= 3 and not re.search(r"[\u0600-\u06FF]", s["text"])


def skippable(r):
    plain = " ".join(s["text"] for s in r).strip()
    bare = HARAKAT.sub("", plain)
    return (bare.startswith("مسرد المصطلحات") or re.fullmatch(r"\d+", plain) is not None
            or re.fullmatch(r"[\s()\u200F\u200E]*[\u0621-\u064A][\s()\u200F\u200E]*", bare) is not None)


def ends_glossary(r):
    """The reference list follows the glossary; nothing after this heading is an entry."""
    bare = HARAKAT.sub("", " ".join(s["text"] for s in r))
    return re.search(r"\u0642\u0627\u0626\u0645\u0629\s*\u0627\u0644\u0645\u0631\u0627\u062C\u0639", bare) is not None


ORPHAN = re.compile(r"(?<![\u0621-\u064A\u064B-\u0652])[\u064B-\u0652]+")


def tidy(text):
    """Drop diacritics that float free of a letter and spaces before punctuation."""
    text = ORPHAN.sub("", text)
    text = re.sub(r"\s+([.\u060C\u061B:\u061F)])", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_book(book):
    meta = json.load(open(f"{EXTRACTED}/{book}.json", encoding="utf-8"))
    doc = fitz.open(f"{REPO}/{meta['localPath']}")
    head = PAGES[book]["head"][0]
    entries, cur, scanned, stray = [], None, [], []
    done = False
    for pno in range(head, len(doc) + 1):
        if done:
            break
        rows = rows_of(doc[pno - 1])
        starts = sum(1 for r in rows if any(is_english(s) for s in r))
        if pno > head and starts == 0:
            break
        scanned.append(pno)
        for r in rows:
            if ends_glossary(r):
                done = True
                break
            if skippable(r):
                continue
            eng_spans = sorted([s for s in r if is_english(s)], key=lambda s: s["x0"])
            if eng_spans:
                if cur:
                    entries.append(cur)
                ex0 = eng_spans[0]["x0"]
                body = [s for s in r if not is_english(s) and s["text"].strip() not in BULLET]
                term = " ".join(s["text"].strip() for s in body if s["x0"] > ex0 + 0.5 and s["text"].strip() != ":")
                de = [s for s in body if s["x0"] < ex0 - 0.5]
                text = " ".join(s["text"].strip() for s in de)
                cur = {"book": book, "page": pno, "ar": term.strip(),
                       "en": " ".join(s["text"].strip() for s in eng_spans).rstrip(":").strip(),
                       "def": [re.sub(r"^\s*:\s*", "", text)]}
            elif cur is not None:
                cur["def"].append(" ".join(s["text"].strip() for s in r if s["text"].strip() not in BULLET))
            else:
                stray.append((pno, " ".join(s["text"] for s in r).strip()))
    if cur:
        entries.append(cur)
    kept = []
    for e in entries:
        e["def"] = tidy(" ".join(e["def"]))
        e["ar"] = tidy(e["ar"])
        if re.search(r"[؀-ۿ]", e["ar"]):
            kept.append(e)
    return {"head": head, "pages": scanned, "entries": kept, "stray": stray}


if __name__ == "__main__":
    only = sys.argv[1:] or list(PAGES)
    out = {}
    for b in only:
        meta = json.load(open(f"{EXTRACTED}/{b}.json", encoding="utf-8"))
        if not os.path.exists(f"{REPO}/{meta['localPath']}"):
            print(f"{b:38s} SKIPPED: source PDF not on this machine")
            continue
        res = parse_book(b)
        out[b] = res
        print(f"{b:38s} head p{res['head']} pages {res['pages'][0]}-{res['pages'][-1]} entries {len(res['entries'])} stray {len(res['stray'])}")
    json.dump(out, open(WORK + "/raw.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
