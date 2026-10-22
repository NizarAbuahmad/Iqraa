"""Reel 17 — «معلّمة اقرأ» presents the full tour, 16:9 for YouTube. The script, the footage behind each beat, the recording guide.

Same host, rules and honesty as Reel 16 (see avatar_script.py): she says the app is Jordanian and made by Jordanians, she is tagged
«شخصية افتراضية», she never gives a personal testimonial, and nothing here says verified. The footage is the chapters of the YouTube
tour (`youtube_chapters.py`), grouped into twelve beats, so the same windows that were reviewed frame by frame are used, including the
blurred «ready» card for generated worksheets / quizzes / activities.

beat: key, group (small label above the title), title (big, right column), chunks (caption phrases), chapters (keys in youtube_chapters.py,
or an explicit `subs` list), gesture.
"""
from youtube_chapters import CHAPTERS

BEATS = [
    dict(key="greet", group="أهلًا بك", title="جولة في اقرأ", gesture="wave", chapters=[],
         subs=[("tour", 51.5, 0.6, None), ("r11_interactive", 8.3, 0.0, None), ("r10_games", 3.5, 1.0, None)],
         chunks=["أهلًا يا معلّمين ومعلّمات!", "أنا مُضيفتكم الافتراضية، وهاي جولة كاملة في تطبيق اقرأ."]),
    dict(key="jordan", group="من هو اقرأ؟", title="تطبيق أردني", gesture="none", chapters=[],
         subs=[("r12_curriculum", 9.0, 0.5, None), ("r12_curriculum", 13.0, 0.8, None)],
         chunks=["اقرأ تطبيق أردني، صُنع بأيدٍ أردنية،", "لمعلّمي الأردن ومنهاجنا الوطني.", "خلّونا نشوف شو بيقدّم لحصتك."]),
    dict(key="ask", group="تحضير الدرس", title="اسأل اقرأ", gesture="point", chapters=["ask"],
         chunks=["بنبدأ بالتحضير. اكتب طلبك بجملة وحدة،", "حتى لو مش مكتمل،", "وإذا مش واضح، بيسألك وبيقترح عليك الخطوة الجاية."]),
    dict(key="plan", group="تحضير الدرس", title="خطة درس", gesture="point", chapters=["plan"],
         chunks=["اختار الصف والمادة والدرس،", "والمدة وأسلوب التدريس،", "وبتطلع لك خطة درس: أهداف ومسار الحصة والتوقيت والواجب."]),
    dict(key="worksheet", group="تحضير الدرس", title="ورقة عمل", gesture="point", chapters=["worksheet"],
         chunks=["وورقة العمل: مثال محلول، ومثال نكمله،", "وتمارين متدرّجة،", "ومعها مفتاح إجابات بالخطوات."]),
    dict(key="quizact", group="تحضير الدرس", title="اختبار ونشاط", gesture="point", chapters=["quiz", "activity"],
         chunks=["واختبار قصير: اختيار من متعدد، وصح وخطأ، وإجابة قصيرة،", "وبتحدّد المدة والدرجة وعدد الأسئلة.", "وكمان نشاط جماعي بالخطوات والأدوار والزمن."]),
    dict(key="slides", group="داخل الصف", title="شرائح الدرس", gesture="point", chapters=["slides"],
         chunks=["وشرائح الدرس: حوّل الدرس لعرض على الشاشة،", "فيه نتاجات التعلّم وأفكار الدرس،", "وأشكال من كتابك المدرسي."]),
    dict(key="interactive", group="داخل الصف", title="الحصة التفاعلية", gesture="point", chapters=["interactive", "games"],
         chunks=["جوّا الحصة: سبعة أنشطة جاهزة مع مؤقّت،", "اختار الدرس والهدف وابدأ العرض،", "وألعاب اقرأ مجانية، بدون تسجيل، شاركها مع طلابك."]),
    dict(key="board", group="داخل الصف", title="السبورة والتحدّي", gesture="point", chapters=["board", "challenge"],
         chunks=["والسبورة: ارسم واشرح على الشاشة،", "بألوان وممحاة وصفحات،", "وتحدّي الصف: لعبة أسئلة بين فِرق الصف، بدون هواتف."]),
    dict(key="after", group="التقويم والتواصل", title="بعد الحصة", gesture="point", chapters=["eval", "parent", "messages"],
         chunks=["وبعد الحصة: ولّد أسئلة التقييم من المنهاج،", "واكتب رسالة لوليّ الأمر بالنبرة اللي بدك إياها،", "وراسل صفّك كله بنقرة."]),
    dict(key="organize", group="شُعبك وجدولك", title="نظّم شُعبك", gesture="point", chapters=["classes", "schedule", "calendar", "files"],
         chunks=["وبتنظّم شُعَبك: أضف طلابك بأسمائهم دفعة وحدة،", "وجدول حصصك الأسبوعي،", "وتقويمك وملفاتك، وكله بمكان واحد."]),
    dict(key="cta", group="جرّبها", title="مجانًا", gesture="wave_end", chapters=[],
         subs=[("tour", 51.5, 0.0, None)],
         chunks=["اقرأ تطبيق أردني، من أردنيين لمعلّمينا.", "جرّب كل هاي الأدوات مجانًا،", "من www.iqrra.com."]),
]


def beat_subs(beat):
    """-> [(take, src, rate, demo, crop)] — explicit `subs`, or the sub-scenes of the named chapters of the YouTube tour."""
    if beat.get("subs"):
        return [(t, s, r, d, None) for t, s, r, d in beat["subs"]]
    by = {c["key"]: c for c in CHAPTERS}
    out = []
    for k in beat["chapters"]:
        c = by[k]
        for sub in c["subs"]:
            take, src, rate, dur = sub[:4]
            out.append((take, src, rate, c["demo"], sub[4] if len(sub) > 4 else None))
    return out


def words(beat):
    return len(" ".join(beat["chunks"]).split())


def script_md():
    total = sum(words(b) for b in BEATS)
    lines = ["# نص تسجيل «معلّمة اقرأ» — نسخة يوتيوب (Reel 17)", "",
             "سجّل الصوت بنبرة معلّمة أردنية دافئة (لهجة أردنية خفيفة قريبة من الفصحى)، بسرعة عادية، ابتسامة في الصوت.", "",
             "**قواعد التسجيل (مهمة لضبط الفيديو):**",
             f"- سكتة قصيرة **حوالي ثانية بين كل فقرة وفقرة** ({len(BEATS)} فقرة). الفيديو يقسّم التسجيل على الفقرات من هذه السكتات.",
             "- ابدأ بنصف ثانية صمت، وأنهِ بنصف ثانية صمت. تسجيل واحد متصل، بلا موسيقى خلفية، في غرفة هادئة.",
             "- الملف: wav أو m4a أو mp3.", "",
             f"عدد الكلمات الكلي ≈ {total} (حوالي ٢ دقيقة بسرعة عادية).", ""]
    for i, b in enumerate(BEATS, 1):
        lines.append(f"**{i}. {b['title']}** — " + " ".join(b["chunks"]))
        lines.append("")
    lines += ["---", "الشخصية افتراضية ومعلنة كذلك على الشاشة؛ لا تقل «أنا معلّمة وأستخدمه» أو أي شهادة شخصية.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    open("AVATAR_YT_SCRIPT.md", "w").write(script_md())
    print(script_md())
