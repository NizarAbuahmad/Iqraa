"""The chapter list of the YouTube explainer (Reel 15): copy, footage windows, timing. One source for the overlay
generator, the builder and the YouTube description (chapter timestamps are computed from the same list).

sub = (take, src seconds, rate, duration seconds[, crop])  — crop (x, y, w, h) in CSS px; default is the whole 390x844 screen.
demo  'ai'   -> the screen shows demo-mode generated content: label «وضع العرض · محتوى تجريبي»
      'acct' -> fictional classes / names: label «حساب تجريبي · أسماء افتراضية»
      None   -> nothing to label

Footage choices (reviewed frame by frame): frames where the app draws maths mirrored, or an Arabic «و» that reads as a 9
next to Latin letters, are not used — generated worksheets / quizzes / activities are shown as the form and the «ready»
card, never the question text. Settings and Profile are skipped: they show an e-mail address.
"""
LOWER = (0, 330, 390, 514)           # the «ready» card + buttons without the generated text above it

CHAPTERS = [
    dict(key="ask", group="تحضير الدرس", title="اسأل إقرأ", demo="ai",
         bullets=["اكتب طلبك بجملة وحدة، حتى لو كان غير مكتمل", "إذا الطلب مش واضح بيسألك، وبيقترح عليك الخطوة الجاية"],
         subs=[("tour", 50.8, 1.0, 7.0), ("tour", 65.0, 0.0, 3.0), ("tour", 66.0, 0.0, 3.0)]),
    dict(key="plan", group="تحضير الدرس", title="خطة درس", demo="ai",
         bullets=["اختار الصف والمادة والدرس والمدة وأسلوب التدريس", "خطة جاهزة: أهداف ومسار الحصة والتوقيت والواجب"],
         subs=[("tour", 81.0, 1.3, 6.5), ("tour", 92.0, 0.8, 4.5)]),
    dict(key="worksheet", group="تحضير الدرس", title="ورقة عمل", demo="ai",
         bullets=["مثال محلول، ومثال نكمله، وتمارين متدرجة", "ومعها مفتاح إجابات بالخطوات"],
         subs=[("tour", 107.0, 1.2, 7.5), ("tour", 125.0, 0.0, 3.0, LOWER)]),
    dict(key="quiz", group="تحضير الدرس", title="اختبار قصير", demo="ai",
         bullets=["اختيار من متعدد، صح وخطأ، وإجابة قصيرة", "حدّد المدة والدرجة وعدد الأسئلة"],
         subs=[("tour", 134.0, 1.2, 7.0), ("tour", 154.0, 0.0, 3.0, LOWER)]),
    dict(key="activity", group="تحضير الدرس", title="نشاط صفّي", demo="ai",
         bullets=["نشاط جماعي بالخطوات والأدوار والزمن", "للطباعة، أو للرجوع إليه أثناء الحصة"],
         subs=[("tour", 159.0, 1.2, 8.0), ("tour", 180.5, 0.0, 2.5, LOWER)]),
    dict(key="challenge", group="داخل الصف", title="تحدّي الصف", demo="ai",
         bullets=["لعبة أسئلة بين فرق الصف", "بلا هواتف وبلا تحضير: الطلاب يرفعون أيديهم وأنت تسجّل النقاط"],
         subs=[("tour", 186.0, 1.0, 8.0), ("tour", 197.0, 0.0, 3.5)]),
    dict(key="library", group="داخل الصف", title="المكتبة", demo=None,
         bullets=["أوراق عمل وفيديوهات ومصادر من الكتاب المدرسي", "ابحث باسم الدرس واختر الصف والمادة"],
         subs=[("tour", 227.5, 1.0, 8.0)]),
    dict(key="slides", group="داخل الصف", title="شرائح الدرس", demo="ai",
         bullets=["حوّل الدرس إلى عرض للشاشة", "نتاجات التعلّم وأفكار الدرس وأشكال من كتابك المدرسي"],
         subs=[("tour", 239.5, 1.3, 6.5), ("tour", 245.8, 0.0, 2.5), ("tour", 252.5, 0.0, 2.6), ("tour", 255.5, 0.0, 2.6),
               ("tour", 258.5, 0.0, 2.6), ("tour", 262.5, 0.0, 2.6)]),
    dict(key="interactive", group="داخل الصف", title="الحصة التفاعلية", demo="ai",
         bullets=["٧ أنشطة جاهزة مع مؤقّت", "اختار الدرس والهدف، وابدأ العرض"],
         subs=[("r11_interactive", 8.3, 1.4, 6.0), ("r11_interactive", 23.5, 2.2, 6.5), ("r11_interactive", 44.0, 0.0, 3.0)]),
    dict(key="games", group="داخل الصف", title="ألعاب إقرأ", demo=None,
         bullets=["ألعاب مجانية بلا تسجيل", "شارك الرابط مع طلابك للمراجعة والمتعة"],
         subs=[("r10_games", 0.4, 1.0, 3.2), ("r10_games", 3.5, 1.8, 7.2), ("r10_games", 25.9, 0.0, 2.6)]),
    dict(key="board", group="داخل الصف", title="السبورة", demo=None,
         bullets=["ارسم واشرح على الشاشة", "ألوان وممحاة، وتنقّل بين الصفحات"],
         subs=[("tour", 350.3, 1.0, 6.5)]),
    dict(key="flow", group="داخل الصف", title="مسار الدرس الكامل", demo="ai",
         bullets=["ست خطوات تُجهَّز بالتتابع", "النشاط التفاعلي والتدريب الموجّه جاهزان للعرض"],
         subs=[("tour", 360.5, 0.0, 2.5), ("tour", 364.5, 0.0, 3.0), ("tour", 367.8, 0.25, 3.0), ("tour", 370.5, 0.0, 3.0),
               ("tour", 372.0, 0.0, 3.0)]),
    dict(key="eval", group="التقويم والتواصل", title="التقييمات", demo="ai",
         bullets=["ولّد أسئلة التقييم من المنهاج", "امتحان يُرصَد ويُصحَّح، وتشاركه برابط"],
         subs=[("tour", 330.2, 1.2, 8.5), ("tour", 341.5, 0.8, 5.5)]),
    dict(key="parent", group="التقويم والتواصل", title="رسالة لوليّ الأمر", demo="ai",
         bullets=["اختر موضوع الرسالة ونبرتها", "صياغة رسمية جاهزة للنسخ أو المشاركة"],
         subs=[("tour", 322.0, 1.0, 5.7)]),
    dict(key="messages", group="التقويم والتواصل", title="الرسائل", demo="acct",
         bullets=["رسالة لصفّك كله بنقرة", "ومحادثة مباشرة مع أولياء الأمور"],
         subs=[("r4_messages", 0.3, 1.0, 3.0), ("r4_messages", 4.0, 1.0, 3.0), ("r4_messages", 9.5, 1.5, 3.0),
               ("r4_messages", 15.6, 0.0, 3.0), ("r4_messages", 31.2, 0.0, 3.0)]),
    dict(key="classes", group="شعبك وجدولك", title="شُعَبي", demo="acct",
         bullets=["أضف شعبتك والمواد التي تدرّسها", "أضف الطلاب بأسمائهم دفعة واحدة"],
         subs=[("tour", 377.5, 1.1, 14.0)]),
    dict(key="teachplans", group="شعبك وجدولك", title="خطط التدريس", demo=None,
         bullets=["أنشئ خطة تدريس للفصل بتواريخها", "وارجع لها بأي وقت"],
         subs=[("tour", 396.0, 1.0, 9.5)]),
    dict(key="schedule", group="شعبك وجدولك", title="جدول الحصص", demo=None,
         bullets=["أعدّ جدولك الأسبوعي: الأيام والأوقات", "ومدة كل حصة"],
         subs=[("tour", 409.0, 1.2, 12.5)]),
    dict(key="calendar", group="شعبك وجدولك", title="التقويم", demo=None,
         bullets=["شاهد حصصك ومواعيدك", "يومًا بيوم"],
         subs=[("tour", 426.8, 0.0, 3.8)]),
    dict(key="files", group="شعبك وجدولك", title="ملفاتي", demo=None,
         bullets=["احفظ موادك في ملفاتك", "وأضِفها إلى الشعبة المناسبة"],
         subs=[("tour", 446.5, 1.0, 7.0)]),
    dict(key="help", group="دعم", title="مساعدة واقتراحات", demo=None,
         bullets=["أسئلة شائعة جاهزة داخل التطبيق", "واقترح الميزة التي تحتاجها"],
         subs=[("tour", 468.0, 1.0, 5.0), ("tour", 475.2, 0.9, 5.5)]),
]

INTRO_DUR = 9.0
END_DUR = 9.0
