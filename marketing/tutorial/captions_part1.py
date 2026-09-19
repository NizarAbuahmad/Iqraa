#!/usr/bin/env python3
"""Part-1 captions: text + timing together, timed against out/_video.mp4.

Renders each caption to a transparent PNG via Chrome (ffmpeg drawtext cannot
shape or reorder Arabic) and writes caption_times.json for assemble.py.

The recording moves across three subjects — the chat bar shows الأحياء, the
unit browse is الكيمياء, and the slides/deck/plan are الجغرافيا. So no caption
names a lesson: each one describes only what is on screen at that moment.

    python captions_part1.py
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CAPS = HERE / "captions"
W, H = 1920, 1080

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# (start, end, pos, text) against the assembled master.
#   <span class="k">…</span>     a real UI label to look for
#   <span class="warn">…</span>  a caution
CAPTIONS = [
    # 6.20 - 19.44  the chat screen and the lesson bar
    (7.0, 10.8, "bottom", 'الشريط أعلى الشاشة يعرض <span class="k">الدرس الحالي</span> — المادة والصف والدرس'),
    (11.1, 14.9, "bottom", 'اضغط <span class="k">تغيير الدرس</span> لاختيار درس آخر من المنهاج الأردني'),
    (15.2, 19.2, "bottom", '<span class="warn">وضع العرض · محتوى تجريبي</span> يعني أنّ النصوص المولّدة أمثلة توضيحية — أمّا دروس المنهاج فحقيقية'),

    # 19.44 - 26.06  unit and lesson list
    (19.9, 22.9, "bottom", 'اختر الوحدة، ثم الدرس — كما هي في الكتاب المدرسي'),
    (23.2, 25.9, "bottom", 'وبجانب كل درس مدّته وعدد حصصه'),

    # 28.46 - 31.66  the tools screen
    (28.8, 31.4, "bottom", '<span class="k">أدوات التدريس</span> مرتّبة: قبل الحصة، وأثناءها، وبعدها'),

    # 34.26 - 51.34  the slides tool
    (34.8, 38.6, "bottom", '<span class="k">شرائح الدرس</span> تبني عرض الحصة من الدرس مباشرة'),
    (38.9, 42.7, "bottom", 'تأكّد من الصف والمادة والدرس قبل التجهيز'),
    (43.0, 46.8, "bottom", 'ويمكنك إضافة صورك ومرفقاتك إلى الشرائح'),
    (47.1, 51.0, "bottom", 'ثم اضغط <span class="k">جهّز الشرائح</span>'),

    # 53.94 - 76.44  results, export, then presenting
    (54.4, 58.2, "bottom", 'الشرائح جاهزة — راجعها قبل العرض'),
    (58.5, 62.3, "bottom", 'واحفظها، أو صدّرها <span class="k">PDF</span> أو <span class="k">Word</span> للطباعة'),
    (62.9, 67.3, "bottom", '<span class="k">اعرض على الشاشة</span> — ويبدأ العرض أمام صفّك'),
    (67.8, 72.2, "bottom", '<span class="k">نتاجات التعلم</span> تفتح الحصة: ماذا سيتعلّم الطالب اليوم'),
    (72.7, 76.1, "bottom", 'والتنقّل بين الشرائح بزرّي <span class="k">التالي</span> و<span class="k">السابق</span>'),

    # 76.44 - 80.44  a slide carrying a real textbook figure
    (76.9, 80.2, "bottom", 'وبعض الشرائح تأتي بصور من <span class="k">كتاب الطالب</span> نفسه'),

    # 83.04 - 107.30  the lesson plan
    (83.5, 87.4, "bottom", '<span class="k">خطة درس</span> — الأداة الثانية لتحضير الحصة'),
    (87.7, 91.9, "bottom", 'حدّد الصف والمادة والدرس'),
    (92.2, 96.4, "bottom", '<span class="k">المدة</span>: ٣٠ أو ٤٥ أو ٦٠ أو ٩٠ دقيقة'),
    (96.7, 101.2, "bottom", 'و<span class="k">أسلوب التدريس</span>: مباشر، أو استقصائي، أو تعاوني — وتتغيّر الخطة كلها تبعًا له'),
    (101.6, 106.9, "bottom", 'ثم <span class="k">حضّر خطة الدرس</span> — فتظهر بالأهداف والأنشطة والتوقيت والتقويم'),
]


def main():
    CAPS.mkdir(exist_ok=True)
    for f in CAPS.glob("*.png"):
        f.unlink()

    js = "window.CAPTIONS = " + json.dumps(
        [dict(text=t, pos=p) for _, _, p, t in CAPTIONS], ensure_ascii=False, indent=1) + ";\n"
    (HERE / "captions.gen.js").write_text(js, encoding="utf-8")

    src = (HERE / "captions.html").as_uri()
    for i in range(len(CAPTIONS)):
        png = CAPS / f"{i:03d}.png"
        p = subprocess.run([
            CHROME, "--headless=new", "--disable-gpu",
            "--allow-file-access-from-files", "--hide-scrollbars",
            "--force-device-scale-factor=1", "--disable-lcd-text",
            "--font-render-hinting=none", f"--window-size={W},{H}",
            "--virtual-time-budget=8000",
            "--default-background-color=00000000",   # keep the alpha channel
            f"--screenshot={png}", f"{src}?i={i}",
        ], capture_output=True, text=True)
        if not png.exists():
            sys.exit(f"caption {i} did not render\n{p.stderr[-800:]}")
        with open(png, "rb") as fh:
            if fh.read(26)[25] not in (4, 6):
                sys.exit(f"caption {i} lost its alpha — overlay would paint a black box")

    (HERE / "caption_times.json").write_text(json.dumps(
        [dict(i=i, start=s, end=e) for i, (s, e, _, _) in enumerate(CAPTIONS)],
        indent=1), encoding="utf-8")

    # a caption that outlasts its shot lands on the next one
    for i in range(1, len(CAPTIONS)):
        if CAPTIONS[i][0] < CAPTIONS[i - 1][1]:
            sys.exit(f"captions {i-1} and {i} overlap in time")
    print(f"  {len(CAPTIONS)} captions rendered, alpha verified, times written")


if __name__ == "__main__":
    main()
