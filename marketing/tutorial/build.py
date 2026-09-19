#!/usr/bin/env python3
"""Iqraa teacher tutorial — 1920x1080, YouTube.

Unlike the reel (which is 100% generated), this one is cut from a real screen
recording of production web. This script owns everything that is NOT footage:
the chapter cards, the Arabic captions, and the final assembly.

Arabic is rasterised by Chrome in both cases. ffmpeg's drawtext does no bidi
reordering or glyph shaping — it renders Arabic disconnected and backwards.

    python build.py --cards            render the chapter cards
    python build.py --captions         render the caption PNGs (transparent)
    python build.py --probe            prove the caption PNGs really have alpha
    python build.py --assemble         cut + caption + score (needs cuts.json)
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CARDS_DIR = HERE / "cards"
CAPS_DIR = HERE / "captions"
OUT = HERE / "out"
W, H, FPS = 1920, 1080, 30

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

CARDS = ["intro", "01", "02", "03", "04", "05",
         "06", "07", "08", "09", "10", "11", "12", "outro",
         # part-1 cut, matching the recording that exists today
         "intro1", "c1", "c2", "c3", "c4", "c5", "outro1"]

# Caption copy. `ch` is the chapter it belongs to; timings come from cuts.json
# once the footage exists, so this list stays readable and re-orderable.
#   pos: bottom | top | center | banner
#   <span class="k">…</span>    a real UI label the teacher should look for
#   <span class="warn">…</span> a caution
CAPTIONS = [
    # 01 — what Iqraa is
    dict(ch="01", pos="bottom", text='أربع شاشات تعريفية تظهر مرة واحدة — اضغط <span class="k">تخطي</span> إن أردت'),
    dict(ch="01", pos="bottom", text='اقرأ يتبع المنهاج الأردني المعتمد، بوحداته ودروسه'),

    # 02 — account
    dict(ch="02", pos="bottom", text='الاسم والبريد وكلمة المرور — ثم <span class="k">إنشاء حساب</span>'),
    dict(ch="02", pos="bottom", text='<span class="warn">لا يفتح الحساب قبل تأكيد البريد</span> — أدخل الرمز المكوّن من ٦ أرقام'),
    dict(ch="02", pos="bottom", text='الدخول عبر Google لا يحتاج رمز تأكيد'),

    # 03 — where to start
    dict(ch="03", pos="bottom", text='شاشة <span class="k">اقرأ</span> هي نقطة البداية'),
    dict(ch="03", pos="bottom", text='اكتب ما تحتاجه بلغتك — مثل: حضّر خطة درس عن تركيب الاقترانات'),
    dict(ch="03", pos="bottom", text='أو اضغط <span class="k">＋</span> بجانب مربّع الكتابة لاختيار الأداة مباشرة'),

    # 04 — pinning the lesson
    dict(ch="04", pos="bottom", text='الشريط أعلى المحادثة يعرض <span class="k">الدرس الحالي</span>'),
    dict(ch="04", pos="bottom", text='اضغط <span class="k">تغيير الدرس</span> لاختيار المادة والوحدة والدرس'),
    dict(ch="04", pos="center", text='كل ما تطلبه بعد هذه الخطوة يُبنى على هذا الدرس'),

    # 05 — prep from the lesson page
    dict(ch="05", pos="bottom", text='من <span class="k">المنهاج</span> → المادة → الوحدة → الدرس'),
    dict(ch="05", pos="bottom", text='اضغط <span class="k">حضّر خطة درس</span> — والتحضير يفتح داخل صفحة الدرس نفسها'),
    dict(ch="05", pos="bottom", text='حضّر من صفحة الدرس لا من الأدوات — هكذا تبقى الخطة مرتبطة بنتاجات الدرس'),
    dict(ch="05", pos="bottom", text='من <span class="k">خيارات التحضير</span>: المدة، وأسلوب التدريس'),
    dict(ch="05", pos="bottom", text='غيّر الأسلوب وأعد التجهيز — تتغيّر الخطة كلها، لا عنوانها فقط'),

    # 06 — the demo badge
    dict(ch="06", pos="center", text='هذه الشارة تعني أنّ النصّ المعروض <span class="k">مثال توضيحي</span>، لا ناتج ذكاء اصطناعي حيّ'),
    dict(ch="06", pos="bottom", text='أمّا بيانات المنهاج والدروس والنتاجات فحقيقية من المنهاج الأردني'),

    # 07 — the tools
    dict(ch="07", pos="bottom", text='زر <span class="k">＋</span> يفتح الأدوات على الدرس المثبَّت'),
    dict(ch="07", pos="bottom", text='ورقة عمل: عدد الأسئلة، وأنواعها، ومستوى الصعوبة'),
    dict(ch="07", pos="bottom", text='مع كل ورقة <span class="k">مفتاح الإجابات</span>'),
    dict(ch="07", pos="bottom", text='في الرياضيات، يفحص البرنامج مفاتيح الإجابات رمزيًا قبل عرضها'),

    # 08 — save and export
    dict(ch="08", pos="bottom", text='<span class="k">احفظ في موادي</span> ليبقى العمل في مكتبتك'),
    dict(ch="08", pos="bottom", text='<span class="k">تصدير</span> → PDF أو Word، جاهز للطباعة'),
    dict(ch="08", pos="bottom", text='التصدير يأخذ النسخة بعد تعديلك، لا النسخة الأولى'),

    # 09 — class mode
    dict(ch="09", pos="bottom", text='<span class="k">ابدأ الحصة</span> يبني شرائح العرض من الدرس مباشرة'),
    dict(ch="09", pos="bottom", text='التالي والسابق، وإظهار التلميح، وكشف الإجابة'),
    dict(ch="09", pos="bottom", text='<span class="k">لوحة المعلم</span>: نصائح التدريس، والمفاهيم الخاطئة، وأسئلة مقترحة'),

    # 10 — classes and students
    dict(ch="10", pos="bottom", text='<span class="k">حسابي</span> → <span class="k">صفوفي</span>'),
    dict(ch="10", pos="center", text='في أول مرة يظهر إقرار حماية بيانات الطلبة — اضغط <span class="k">أُقرّ بذلك</span> للمتابعة'),
    dict(ch="10", pos="bottom", text='سمِّ الصف — مثال: العاشر رياضيات أ'),
    dict(ch="10", pos="bottom", text='الصق قائمة الأسماء دفعة واحدة — اسم في كل سطر'),
    dict(ch="10", pos="bottom", text='الطالب في اقرأ اسم في قائمتك — بلا حساب ولا كلمة مرور'),
    dict(ch="10", pos="bottom", text='<span class="k">رمز الانضمام</span> رمز واحد للصف كله، يختار كلٌّ اسمه منه'),
    dict(ch="10", pos="bottom", text='<span class="warn">أمّا أيقونة المفتاح بجانب الطالب</span> فرمز خاص بطالب واحد لوليّ أمره'),

    # 11 — evaluations
    dict(ch="11", pos="bottom", text='<span class="k">تقييم جديد</span> — اختر الكتاب ثم نتاجات التعلّم'),
    dict(ch="11", pos="bottom", text='الأسئلة تُولَّد من النتاجات التي اخترتها، لا من عنوان عام'),
    dict(ch="11", pos="bottom", text='<span class="k">انشر التقييم</span> — ولن يظهر رابط الطلاب قبل النشر'),
    dict(ch="11", pos="bottom", text='اكتب الرمز على اللوح، أو أرسل الرابط — يفتحه الطالب ويختار اسمه'),
    dict(ch="11", pos="bottom", text='<span class="k">أدخل إجابات الطلاب</span> — علامة لكل سؤال، وملاحظة إن أردت'),
    dict(ch="11", pos="bottom", text='<span class="k">لوحة النتائج</span>: المتوسط العام، وتوزيع المستويات، والكفايات'),
    dict(ch="11", pos="bottom", text='<span class="k">ما الذي فات الصف</span> — مرتّبًا حسب ما خسره الطلاب فعليًا'),

    # 12 — paper exam + OCR
    dict(ch="12", pos="bottom", text='امتحانك ورقي؟ اختر <span class="k">امتحان ورقي</span> عند الإنشاء'),
    dict(ch="12", pos="bottom", text='لا يحتاج اقرأ نصّ الأسئلة — فقط علامة كل سؤال وما يقيسه'),
    dict(ch="12", pos="bottom", text='<span class="k">امسح العلامات من الورقة</span> — صوّرها بعد أن صحّحتها'),
    dict(ch="12", pos="center", text='<span class="warn">لا يُحفظ شيء من المسح.</span> تُملأ الخانات فقط، وما لم يُقرأ يبقى فارغًا — لا صفرًا'),
    dict(ch="12", pos="bottom", text='راجع العلامات، ثم <span class="k">سلّم وصحّح</span>'),
]


def run(cmd):
    subprocess.run(cmd, check=True, capture_output=True)


def chrome() -> str:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    sys.exit("No Chrome/Edge found — install Chrome or edit CHROME_CANDIDATES.")


def shoot(exe, url, png, transparent=False):
    args = [
        exe, "--headless=new", "--disable-gpu",
        "--allow-file-access-from-files",   # else the file:// logo silently drops
        "--hide-scrollbars", "--force-device-scale-factor=1",
        "--disable-lcd-text", "--font-render-hinting=none",
        f"--window-size={W},{H}",
        "--virtual-time-budget=8000",       # let Google Fonts land before the shot
    ]
    if transparent:
        args.append("--default-background-color=00000000")
    args += [f"--screenshot={png}", url]
    run(args)
    if not Path(png).exists():
        sys.exit(f"Chrome produced no frame for {url}")


def write_captions_js():
    CAPS_DIR.mkdir(exist_ok=True)
    js = "window.CAPTIONS = " + json.dumps(CAPTIONS, ensure_ascii=False, indent=1) + ";\n"
    (HERE / "captions.gen.js").write_text(js, encoding="utf-8")
    print(f"  captions.gen.js — {len(CAPTIONS)} captions")


def render_cards():
    CARDS_DIR.mkdir(exist_ok=True)
    exe = chrome()
    src = (HERE / "cards.html").as_uri()
    for c in CARDS:
        png = CARDS_DIR / f"{c}.png"
        shoot(exe, f"{src}?c={c}", png)
        print(f"  card {c}  ({png.stat().st_size // 1024} KB)")


def render_captions():
    write_captions_js()
    exe = chrome()
    src = (HERE / "captions.html").as_uri()
    for i, c in enumerate(CAPTIONS):
        png = CAPS_DIR / f"{i:03d}.png"
        shoot(exe, f"{src}?i={i}", png, transparent=True)
    print(f"  rendered {len(CAPTIONS)} caption PNGs")


def probe_alpha():
    """A caption PNG that lost its alpha would paint a black slab over the footage."""
    import struct
    bad = []
    for png in sorted(CAPS_DIR.glob("*.png")):
        with open(png, "rb") as f:
            head = f.read(26)
        # PNG IHDR: colour type byte at offset 25; 6 = RGBA, 4 = grey+alpha
        ctype = head[25]
        if ctype not in (4, 6):
            bad.append((png.name, ctype))
    if bad:
        for n, t in bad:
            print(f"  NO ALPHA: {n} (colour type {t})")
        sys.exit("caption PNGs must be RGBA — overlay would paint a black box")
    print(f"  alpha OK on {len(list(CAPS_DIR.glob('*.png')))} caption PNGs")


def assemble():
    cuts = HERE / "cuts.json"
    if not cuts.exists():
        sys.exit(
            "cuts.json not found.\n"
            "Assembly needs the raw take first: drop the recording in this folder,\n"
            "and we agree a cut list (in/out points per chapter) from it."
        )
    sys.exit("cuts.json found — assembly step is written once the real take defines it.")


if __name__ == "__main__":
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not on PATH.")
    OUT.mkdir(exist_ok=True)
    args = sys.argv[1:]
    if not args or "--cards" in args:
        print("rendering cards...")
        render_cards()
    if not args or "--captions" in args:
        print("rendering captions...")
        render_captions()
        probe_alpha()
    if "--probe" in args:
        probe_alpha()
    if "--assemble" in args:
        assemble()
    print("done.")
