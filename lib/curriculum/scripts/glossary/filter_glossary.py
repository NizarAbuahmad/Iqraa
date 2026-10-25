"""Split the raw glossary entries into accepted / held-back, with a reason for each held-back one.

Accepted = reads as plain Arabic prose: no formula fragments, balanced brackets, every word of the term and
definition seen elsewhere in the corpus of extracted books (a repaired ligature that is still wrong makes a
word nobody else prints). Held back is never shown to a student; it is listed so a person can fix it by hand.
"""
import json, os, re, glob, collections

import os, pathlib
REPO = os.environ.get("IQRAA_REPO") or str(pathlib.Path(__file__).resolve().parents[4])
EXTRACTED = REPO + "/lib/curriculum/src/data/extracted"
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(HERE, ".work")
os.makedirs(WORK, exist_ok=True)
HARAKAT = re.compile(r"[\u064B-\u0652\u0670\u0640]")
WORD = re.compile(r"[\u0621-\u064A]+")


def norm(w):
    w = HARAKAT.sub("", w)
    return w.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه")


freq = collections.Counter()
for f in glob.glob(EXTRACTED + "/*.json"):
    j = json.load(open(f, encoding="utf-8"))
    for p in j["text"]:
        for w in WORD.findall(p["text"]):
            freq[norm(w)] += 1
print("corpus words", len(freq))

raw = json.load(open(WORK + "/raw.json", encoding="utf-8"))
accepted, held = [], []


PREFIX = ["", "و", "ب", "ل", "ف", "ك", "ال", "وال", "بال", "لل", "فال", "كال", "ولل", "ول", "وب", "ال"]


def seen(w):
    for p in PREFIX:
        if p and w.startswith(p) and freq[w[len(p):]] >= 1 and len(w) - len(p) >= 3:
            return True
    return freq[w] >= 1


def balanced(s):
    return s.count("(") == s.count(")") and s.count("«") == s.count("»")


MARKS = re.compile(r"[ً-ْ]{2,}")


def _one_mark_run(m):
    run = m.group(0)
    # A shadda may sit with ONE vowel; any other pile-up is the PDF stacking two marks on one letter.
    return ("ّ" + next((c for c in run if c != "ّ"), "")) if "ّ" in run else run[0]


def clean(s):
    """Typographic damage that is certain: tatweel stretching (the books print some titles spaced out) and doubled marks."""
    s = s.replace("ـ", "")
    s = MARKS.sub(_one_mark_run, s)
    return re.sub(r"\s+", " ", s).strip()


# Fixes that are certain, read off the printed page by a reviewer: the PDF reverses the words of some
# two-word terms, and misspells three English terms. Keyed by the term without harakat.
TERM_FIX = {
    "الحراري المحتوى": "المحتوى الحراري",
    "كوكبي سديم": "سديمٌ كوكبي",
    "زجاجي نسيج": "نسيجٌ زجاجي",
    "فقاعي نسيج": "نسيجٌ فقاعي",
    "التكوين القياسية حرارة": "حرارةُ التكوينِ القياسية",
    "البروج دائرة": "دائرةُ البروج",
    "فتاتية صخور رسوبية": "صخورٌ رسوبيةٌ فُتاتية",
    "خشن الحبيبات نسيج": "نسيجٌ خشنُ الحبيبات",
    "المولية الكتلة": "الكتلةُ المولية",
    "المئوي المردود": "المردودُ المئوي",
    "الصخور دورة": "دورةُ الصخور",
    "رسوبية كيميائية صخور": "صخورٌ رسوبيةٌ كيميائية",
    "غير متورق نسيج": "نسيجٌ غيرُ مُتورِّق",
    "ناعم الحبيبات نسيج": "نسيجٌ ناعمُ الحبيبات",
}
EN_FIX = {"Sold Waste": "Solid Waste", "Pathogenses": "Pathogens", "Time Flight": "Time of Flight"}
# Entries a reviewer found wrong or doubtful and no rule catches: held until someone reads the page.
# (fragment of the raw term or definition) -> reason
HOLD_BY_HAND = {
    "حزامِ الكوَيكبات": "term in the wrong case",
    "خطٌّ الجريان": "term in the wrong case",
    "بمرورِالزمنِ": "words glued together",
    "أوِالمركَّبِ": "words glued together",
    "لامدا": "definition cut off, symbols scrambled",
    "حركتِها-منْ": "dash-delimited clause scrambled",
    "بكِبرِحجمِ": "words glued together",
    "منْ عذراءَ إلى يرقةٍ": "metamorphosis order doubtful (larva, pupa, adult) - check the book",
    "ومِنهُ لا يذوبُ": "a word («ما») seems missing - check the book",
}
LOST_LAM_ALEF = re.compile("اللّ(?![ً-ِ])")  # «اللّبة» for «اللابة»: shadda straight on the lam
LONE_ALEF = re.compile("(^| )[ء-ي][ً-ْ]*( |$)")  # a one-letter «word» (the PDF strands a letter)
GREEK = re.compile(r"[Ͱ-Ͽ]")
# a tanween-fatha on a letter that takes an alef (قليلً for قليلًا): not ة ء ا ى, and no alef after it
BARE_FATHATAN = re.compile("[^اةءأىًّ-ْ ]ً(?![اى])")


def damage(ar, d):
    """The reason this entry shows damage a student would see, or None."""
    for part in (ar, d):
        if LOST_LAM_ALEF.search(part):
            return "lam-alef lost"
        if LONE_ALEF.search(part) or GREEK.search(part):
            return "orphan letter or Greek symbol"
        if BARE_FATHATAN.search(part):
            return "alef missing after tanween"
    # A reversed two-word term (the PDF flips them): the LAST word carries a damma/dammatan and the first none.
    # TERM_FIX has already put the known ones right, so what is left here is a new one.
    words = ar.split()
    if len(words) >= 2 and re.search("[ٌُ]$", words[-1]) and not re.search("[ً-ْ]", words[0]):
        return "term looks reversed"
    # a hyphen in a term, or the remains of a symbol in brackets: «()», «(:», «(.»
    if re.search("[-–]", ar) or re.search(r"\(\s*[:.]?\s*\)|\(\s*[:.]", d):
        return "stray hyphen or bracket"
    return None


for book, res in raw.items():
    for e in res["entries"]:
        ar, en, d = e["ar"].strip(), e["en"].strip(), e["def"].strip()
        en = re.sub(r"\s*\($", "", en).strip()
        ar = re.sub(r"\s*\(\s*(of)?\s*$", "", ar).strip()
        d = re.sub(r"^[\s.:)\u200f]+", "", d).strip()
        hand = next((r for frag, r in HOLD_BY_HAND.items() if frag in ar or frag in d), None)
        ar, d = clean(re.sub("[-–]\\s*$", "", ar)), clean(d)
        ar = TERM_FIX.get(HARAKAT.sub("", ar), ar)
        en = EN_FIX.get(en, en)
        why = None
        if hand:
            why = "held-by-hand: " + hand
        elif damage(ar, d):
            why = damage(ar, d)
        elif not re.fullmatch(r"[A-Za-z][A-Za-z '’\-/,.]*", en):
            why = "english-not-plain"
        elif re.search(r"[A-Za-z0-9\u0660-\u0669]", ar) or "(" in ar or ")" in ar or ":" in ar:
            why = "term-has-formula-or-bracket"
        elif re.search(r"[A-Za-z]", d) or re.search(r"[+=^]", d) or re.search(r"\d", d):
            why = "definition-has-formula"
        elif not balanced(d):
            why = "unbalanced-brackets"
        elif len(d) < 12:
            why = "definition-too-short"
        elif len(ar) > 60 or len(d) > 400:
            why = "too-long"
        else:
            bad = [w for w in WORD.findall(ar + " " + d) if len(norm(w)) > 2 and not seen(norm(w))]
            if bad:
                why = "unseen-word:" + "،".join(dict.fromkeys(bad[:3]))
        rec = {"book": book, "page": e["page"], "ar": ar, "en": en, "def": d}
        (held if why else accepted).append({**rec, **({"why": why} if why else {})})

json.dump(accepted, open(WORK + "/accepted.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(held, open(WORK + "/held.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("accepted", len(accepted), "held", len(held))
print(collections.Counter(h["why"].split(":")[0] for h in held))
out = ["%s p%s | %s | %s | %s" % (h["book"][:14], h["page"], h["ar"], h["en"], h["why"]) for h in held]
open(WORK + "/held.txt", "w", encoding="utf-8").write("\n".join(out))
