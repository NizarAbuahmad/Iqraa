"""Reel 16 — «معلّمة اقرأ», the virtual teacher host. The script, the footage behind each beat, and the recording guide.

One source for the overlays, the builder and `AVATAR_SCRIPT.md`. Each beat is one breath of the voice-over; `chunks` are the
burned-in caption phrases (shown in order across the beat); `subs` = (take, source seconds, rate, demo) with demo
  'ai'   -> the screen shows demo-mode generated content   -> label «وضع العرض · محتوى تجريبي»
  'acct' -> fictional classes / names                       -> label «حساب تجريبي · أسماء افتراضية»
  None   -> nothing to label

Rules the copy follows
  * It is said, in every cut, that the app is Jordanian and made by Jordanians (beats 2 and 9, and a chip on every frame).
  * The host is introduced as a virtual presenter and tagged «شخصية افتراضية». She never says "I teach / I use it": a made-up
    teacher giving a personal testimonial would be a fabricated endorsement.
  * Only what the app does today: no "verified", no "AI-checked", no time or price numbers. «مجانًا» is true today (no price or
    billing exists) — if a paywall ships, beat 9 and the end text must change.
Footage frames that show the app's mirrored maths (answer-key rows) are not used.
"""
BEATS = [
    dict(key="greet", gesture="wave",
         chunks=["أهلًا يا معلّمين ومعلّمات!", "أنا مُضيفتكم الافتراضية في تطبيق اقرأ."],
         subs=[("tour", 50.6, 0.0, None)]),
    dict(key="jordan", gesture="none",
         chunks=["اقرأ تطبيق أردني،", "صُنع بأيدٍ أردنية،", "لمعلّمي الأردن ومنهاجنا الوطني."],
         subs=[("r12_curriculum", 9.0, 0.5, None)]),
    dict(key="ask", gesture="point",
         chunks=["اسأل اقرأ بجملة وحدة،", "حتى لو طلبك مش مكتمل.", "وإذا مش واضح، بيسألك."],
         subs=[("tour", 56.2, 0.5, "ai"), ("tour", 66.0, 0.0, "ai")]),
    dict(key="curriculum", gesture="point",
         chunks=["المنهاج كله مرتّب:", "اختار الصف والمادة والدرس،", "وافتحه."],
         subs=[("r12_curriculum", 13.0, 0.8, None), ("r12_curriculum", 17.0, 0.0, None)]),
    dict(key="worksheet", gesture="point",
         chunks=["بدك ورقة عمل لدرس بكرة؟", "بتجهّز لك ورقة فيها مثال محلول،", "وتمارين متدرّجة، ومفتاح إجابات."],
         subs=[("r2n_library", 14.5, 0.4, None), ("r2n_library", 18.5, 0.0, None)]),
    dict(key="prep", gesture="point",
         chunks=["وكمان خطة درس، واختبار قصير،", "ونشاط للصف،", "وشرائح جاهزة للعرض على الشاشة."],
         subs=[("tour", 97.5, 0.0, "ai"), ("tour", 245.8, 0.0, "ai"), ("tour", 252.6, 0.0, "ai")]),
    dict(key="class", gesture="point",
         chunks=["وبالحصة: حصة تفاعلية بمؤقّت،", "وألعاب بدون تسجيل،", "وسبورة، وتحدّي بين فِرق الصف."],
         subs=[("r11_interactive", 11.8, 0.0, None), ("r10_games", 4.8, 0.9, None), ("tour", 354.0, 0.5, None), ("tour", 197.0, 0.0, "ai")]),
    dict(key="after", gesture="point",
         chunks=["وبعد الحصة: رسالة لوليّ الأمر،", "وتقييمات، وجدول حصصك،", "وملفاتك… كلها بمكان واحد."],
         subs=[("tour", 322.2, 1.0, "ai"), ("tour", 331.0, 0.9, "ai"), ("tour", 380.5, 1.0, "acct")]),
    dict(key="cta", gesture="wave_end",
         chunks=["اقرأ تطبيق أردني،", "من أردنيين لمعلّمينا.", "جرّبه مجانًا على درسك الجاي."],
         subs=[("tour", 50.6, 0.0, None)]),
]

CTA_LINE = "جرّبه مجانًا · www.iqrra.com"
JORDAN_CHIP = "تطبيق أردني · بأيدٍ أردنية"
TAG = "معلّمة اقرأ · شخصية افتراضية"
PILL = {"ai": "وضع العرض · محتوى تجريبي", "acct": "حساب تجريبي · أسماء افتراضية"}


def words(beat):
    return len(" ".join(beat["chunks"]).split())


def script_md():
    lines = ["# نص تسجيل «معلّمة اقرأ» (Reel 16)", "",
             "سجّل الصوت بنبرة معلّمة أردنية دافئة (لهجة أردنية خفيفة قريبة من الفصحى)، بسرعة عادية، ابتسامة في الصوت.", "",
             "**قواعد التسجيل (مهمة لضبط الفيديو):**",
             "- خذ نفسًا وسكتة قصيرة **حوالي ثانية بين كل فقرة وفقرة** (٩ فقرات). الفيديو يقسّم التسجيل على الفقرات من هذه السكتات.",
             "- ابدأ بنصف ثانية صمت، وأنهِ بنصف ثانية صمت. تسجيل واحد متصل، بلا موسيقى خلفية، في غرفة هادئة.",
             "- الملف: wav أو m4a أو mp3، قناة واحدة تكفي.", "",
             f"عدد الكلمات الكلي ≈ {sum(words(b) for b in BEATS)} (حوالي ٥٠–٦٠ ثانية بسرعة عادية).", ""]
    for i, b in enumerate(BEATS, 1):
        lines.append(f"**{i}.** " + " ".join(b["chunks"]))
        lines.append("")
    lines += ["---", "ملاحظة: الشخصية افتراضية ومعلنة كذلك على الشاشة؛ لا تقل «أنا معلّمة وأستخدمه» أو أي شهادة شخصية.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    open("AVATAR_SCRIPT.md", "w").write(script_md())
    print(script_md())
