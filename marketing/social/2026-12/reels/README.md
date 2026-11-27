# December reels

Layout: 1080×1920, brand navy, the screen recording inside a phone bezel (828×1472 window),
captions in the strip above it so they never cover the app. Every caption is a Chrome PNG.

```bash
node reels/overlays.cjs reels/r1.json        # captions, bezel, end card
python reels/build.py reels/r1.json --music <bed.m4a>
```

Outputs in `reels/out/`: `<id>.mp4` (with a quiet music bed) and `<id>-silent.mp4`.
On Instagram/TikTok prefer the **silent** file plus a trending sound picked in the app at
~20% volume; use the scored file on Facebook and YouTube Shorts.

Music beds are the Pixabay tracks already used in `marketing/reel/build.py`, taken from those
reels' audio. They are not committed.

## Scripts (on-screen text; times are set in each `<id>.json` against the recording)

| Id | Hook (0–3 s) | Then | End card |
| --- | --- | --- | --- |
| R1 | ورقة مراجعة… ومفتاحها جاهز؟ | «المكتبة» ← اختر الصف والدرس · افتح الورقة · مفتاح الإجابات في آخرها · اطبعها | أوراق عمل جاهزة للرياضيات من الصف 1 إلى 9 |
| R2 | اختبار قصير… بنسختين | اختر الدرس من المنهاج · عدد الأسئلة وأنواعها · «تصدير» ← نسخة الطالب أو نسخة المعلم | حضّر اختبارك في دقائق |
| R3 | الطالب يعرف أخطاءه… لحظة التسليم | «فعّل التغذية الراجعة الفورية» · يسلّم الطالب · علامته وأخطاؤه فورًا · الحلول حين تعرضها أنت | تغذية راجعة فورية |
| R4 | بدل صور الورقة على الجروب… | «تصدير» ← «مشاركة رابط» · ابعثه على واتساب · يفتح كما هو بلا حساب | شارك موادك برابط |
| R5 | حصة مراجعة؟ استعمل السبورة | اكتب وأضف نصًا · صفحة جديدة وألوان · أيقونة الرابط ← لطلبتك | السبورة في «الأدوات» ← «أثناء الحصة» |
| R6 | مدرسة ولا مدرسه؟ جرّب! | اختر الكتابة الصحيحة · بعد كل إجابة: القاعدة | «كيف تُكتب؟» مجانية وبلا حساب |
| R7 | العطلة جاية… وهاي ألعاب بتعلّم | اختر المادة والصف · جملة تشرح السبب · «محافظات الأردن» مع الخريطة | app.iqrra.com/play |
| R8 | قرارات المعلّم لـ 2027 | five cards | اكتب قرارك بالتعليقات |

Rules: name the grade/subject/lesson on screen whenever generated material is shown; leave any
demo label visible; read every question and key on screen before posting.
