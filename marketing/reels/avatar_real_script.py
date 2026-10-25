"""Reel 18 — the worksheet reel with a photoreal presenter (D-ID Studio clip, the user's own script, voice «Sana», Arabic (Jordan)).

The words are the user's. Nothing here adds a claim: the reel shows what the app does (ask, a worksheet with a worked example, graded exercises, an answer key) and
carries the same labels as the others — «تطبيق أردني · بأيدٍ أردنية» on every frame, a «شخصية افتراضية» tag (the host is synthetic and says so: «أنا مُضيفتكم الافتراضية»),
the demo-mode pill on generated screens. «مجانًا» appears only in the closing line, true while the product has no price.

Each sentence is one unit: its caption phrases (shown in order across the sentence's speech) and the app footage behind it: (take, source seconds, rate, demo).
Footage of the library sheet stops at 17 s of that take: after it the sheet's second exercise (an «و» that reads as a 9 next to Latin letters) and later the answer key (mirrored maths) come on screen. The bottom 28% of those screens is faded as a second guard.
"""
SENTENCES = [
    dict(text="عندك حصّة بكرة، ولسّه بدّك تجهّز ورقة عمل؟",
         chunks=["عندك حصّة بكرة،", "ولسّه بدّك تجهّز ورقة عمل؟"],
         subs=[("tour", 56.2, 0.5, "ai")]),
    dict(text="اقرأ بيساعدك!", chunks=["اقرأ بيساعدك!"], subs=[("tour", 66.0, 0.0, "ai")]),
    dict(text="أهلًا وسهلًا بكل معلّم ومعلّمة!", chunks=["أهلًا وسهلًا بكل معلّم ومعلّمة!"],
         subs=[("r12_curriculum", 9.0, 0.4, None)]),
    dict(text="أنا مُضيفتكم الافتراضية في اقرأ، تطبيق أردني طوّرته كفاءات أردنية، ليساعدكم في شغلكم اليومي، ويدعم تدريس المنهاج الأردني.",
         chunks=["أنا مُضيفتكم الافتراضية في اقرأ،", "تطبيق أردني طوّرته كفاءات أردنية،", "ليساعدكم في شغلكم اليومي،", "ويدعم تدريس المنهاج الأردني."],
         subs=[("r12_curriculum", 11.0, 0.5, None), ("r12_curriculum", 13.0, 0.6, None)]),
    dict(text="مع اقرأ، بتحدّد الصف والدرس، وبتجهّز ورقة عمل فيها مثال محلول يوضّح الفكرة، وتمارين بتتدرّج من السهل للأصعب، ومعها الإجابات النموذجية لتسهيل التصحيح.",
         chunks=["مع اقرأ، بتحدّد الصف والدرس،", "وبتجهّز ورقة عمل فيها مثال محلول يوضّح الفكرة،", "وتمارين بتتدرّج من السهل للأصعب،", "ومعها الإجابات النموذجية لتسهيل التصحيح."],
         subs=[("tour", 107.0, 1.0, "ai"), ("r2n_library", 15.0, 0.25, None), ("r2n_library", 16.0, 0.25, None), ("r2n_library", 17.0, 0.0, None)]),
    dict(text="وبعدها؟", chunks=["وبعدها؟"], subs=[("r2n_library", 16.5, 0.0, None)]),
    dict(text="بتراجعها وبتعدّل عليها بما يناسب مستوى طلابك وأهداف حصّتك.",
         chunks=["بتراجعها وبتعدّل عليها", "بما يناسب مستوى طلابك وأهداف حصّتك."],
         subs=[("r2n_library", 16.0, 0.0, None), ("r2n_library", 15.0, 0.0, None)]),
    dict(text="جرّب اقرأ، وخلّي تحضير حصّة بكرة أسهل!", chunks=["جرّب اقرأ،", "وخلّي تحضير حصّة بكرة أسهل!"],
         subs=[("r2n_library", 14.5, 0.4, None)]),
    dict(text="اقرأ…", chunks=["اقرأ…"], subs=[("tour", 50.6, 0.0, None)]),
    dict(text="وقت أقل للتحضير، ووقت أكثر للتعليم.", chunks=["وقت أقل للتحضير،", "ووقت أكثر للتعليم."], subs=[("tour", 50.6, 0.0, None)]),
]
TAG = "مُضيفة اقرأ · شخصية افتراضية"
CTA = "جرّبه مجانًا · www.iqrra.com"
