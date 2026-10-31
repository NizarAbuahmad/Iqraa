/**
 * The privacy policy and terms of service, in both product languages.
 *
 * These are content, not chrome: they live here rather than in `i18n.ts`
 * because that file is a flat key/value map for UI strings, and a document
 * with headings and ordered paragraphs is neither. One renderer reads this
 * (`app/legal/[doc].tsx`) and both documents are reachable signed-out, which
 * is what the App Store and Play listings require of a policy URL.
 *
 * **Every factual claim below was written from the code, not from a
 * template.** The subprocessor list is `lib/r2.ts` (Cloudflare R2),
 * `lib/db` (Neon), `services/analytics.ts` (PostHog, EU cloud: the host is set
 * beside the key in every build, see `posthogProject.test.ts`, plus
 * Android session replay), `services/contentsquare.ts` (Contentsquare, web only),
 * `services/pushTokens.ts` (Expo), `routes/auth.ts` (Google Sign-In), `lib/email.ts`
 * (Resend) and the OpenAI client in `lib/aiBudget.ts`. The data inventory is `lib/db/src/schema`.
 * If one of those changes, this file is part of the same change — a policy
 * that describes a system that no longer exists is worse than none, because
 * it is a published false statement rather than a missing one.
 *
 * NOT LEGAL ADVICE, AND NOT REVIEWED BY A LAWYER. The governing-law clause
 * most needs one.
 *
 * **These documents describe a release in which students and parents hold
 * accounts and can message their teacher.** That is gated by
 * `STUDENT_ACCOUNTS` (`api-server/src/lib/features.ts`): while it is false the
 * server refuses those accounts outright, and the text below over-describes
 * what the deployment actually does. Over-describing is the safe direction;
 * under-describing is not. **Turning the flag back off, or changing what a
 * student account can reach, means editing this file in the same change.**
 *
 * **A student may sign up with an email and no teacher's code (since
 * 2026-10-23)**, confirming they are an adult or have a guardian's agreement
 * (`users.guardian_confirmed_at`). §5 and terms §1 say so; if that path closes,
 * they are wrong until rewritten. A parent still needs a teacher's code.
 *
 * What the student surface actually is, and what §5 below relies on: messaging,
 * the curriculum tab, and the student's own homework and exams in a teacher's
 * class (the School tab, `my-exams`), including the homework project upload.
 * iQra and the AI tools are hidden from these roles and refused server-side. A
 * direct thread always has exactly one teacher and one non-teacher, and a group
 * is announcement-only until its owning teacher enables student posting — so no
 * student-to-student channel exists. If any of that changes, §5 and the conduct
 * rules are wrong until they are rewritten.
 *
 * **A homework project (since 2026-10-31 in this text)** is up to six photos
 * and a note a student hands in (`api-server/src/lib/homeworkSubmission.ts`).
 * §1 says who sees it and §6 what deletes it, both read from that file, the
 * archive routes (`routes/homework.ts`, `routes/roster.ts`) and the account
 * delete (`routes/auth.ts`). The projects sit on the roster row, which stays
 * with the teacher, so nothing cascades from a student's account to them:
 * `purgeSubmissionsOfAuthor` deletes the ones the account wrote (by
 * `author_user_id`), and a parent's deletion touches none. A teacher clears one
 * student's project with `clearForTeacher` (`DELETE /homework/:id/submissions/
 * :studentId`, `routes/homeworkSubmissions.ts`). §6 relies on that. If any of
 * those paths changes, §1 and §6 change with it.
 *
 * **Recording (§1, §3, §4, §6, since 2026-10-31).** Three places use the
 * microphone: English speaking practice (`hooks/useSpeakingRecorder.ts`, kept on
 * the device, never uploaded), read-aloud practice (`routes/practice.ts`,
 * transcribed by OpenAI, nothing stored) and the exam's read-aloud question
 * (`routes/studentAttempt.ts`: R2 plus the transcript on the answer; played back
 * only on the teacher's marking screen, `routes/attempts.ts`). What deletes an
 * exam recording is in `lib/attemptAudio.ts`'s callers. Change any of them and
 * this text changes with it.
 */

/**
 * Must be a real, monitored mailbox before either store listing goes in — a
 * reviewer may write to it, and a data-subject request has a statutory clock.
 */
export const LEGAL_CONTACT_EMAIL = 'info@iqrra.com';

/** Shown on both documents. Bump when the text below changes materially. */
export const LEGAL_LAST_UPDATED = { ar: '31 تشرين الأول 2026', en: '31 October 2026' };

/**
 * The same date, as the version a new account records it accepted
 * (`users.termsVersion`, see `api-server/src/lib/termsAcceptance.ts`). Bump
 * the two together — `legalVersion.test.ts` fails if they disagree, because
 * an acceptance record naming a version the documents never carried is a
 * record of nothing.
 *
 * Only a NEW account sends it (the three sign-up calls in
 * `context/AuthContext.tsx`). Nothing asks an existing account to accept a
 * new version: there is no re-acceptance flow, so a bump changes what the
 * next sign-ups record and nothing else.
 */
export const LEGAL_VERSION = '2026-10-31.c';

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
export type LegalDocId = 'privacy' | 'terms';

const PRIVACY_AR: LegalDoc = {
  title: 'سياسة الخصوصية',
  intro:
    'توضّح هذه السياسة ما الذي يجمعه تطبيق «إقرأ» من بيانات، ولماذا يجمعه، ومع من يُشارَك، وكيف يمكنك حذفه. وهي تنطبق على التطبيق وعلى نسخته على الويب وعلى الخدمات التي تقف خلفهما.',
  sections: [
    {
      heading: '1) البيانات التي نجمعها',
      body: [
        'بيانات الحساب: الاسم الأول واسم العائلة، والبريد الإلكتروني، وكلمة المرور مخزَّنة بصيغة مشفَّرة لا يمكن الرجوع منها إلى الكلمة الأصلية (bcrypt)، ولغتك المفضَّلة، وصفتك في التطبيق (معلّم أو وليّ أمر أو طالب)، وتاريخ آخر دخول. وإن اخترت الدخول بحساب Google فإننا نحفظ المعرّف الذي تزوّدنا به Google بدلاً من كلمة مرور.',
        'بيانات الصفّ التي يُدخلها المعلّم: أسماء الطلبة كما يكتبها المعلّم، ورقم القيد إن أضافه، وملاحظته المكتوبة عن الطالب، وتوزيع الطلبة على الشُّعَب. هذه بيانات يُدخلها المعلّم عن طلبته، ومسؤوليته تجاهها موضَّحة في شروط الخدمة.',
        'سجلّات التعلّم: الاختبارات وأوراق العمل التي يُنشئها المعلّم، وإجابات الطلبة عليها، والعلامات والتقديرات الناتجة عنها.',
        'الرسائل: نحفظ نصّ الرسائل داخل التطبيق ووقتها ومَن أرسلها، والصور المرفقة بها إن وُجدت، ورمز الإشعارات الخاصّ بجهازك لإيصال التنبيهات. لا نقرأ الرسائل إلّا عند مراجعة بلاغ.',
        'الملفات: ما يرفعه المعلّم من صور أو مستندات ويربطه بدرس.',
        'مشاريع الواجبات: حين يطلب المعلّم مشروعًا في واجب، يرفع الطالب من صور جهازه حتى ستّ صور لعمله، وملاحظة مكتوبة لا تتجاوز 2000 حرف، ويكفي أحدهما للتسليم. تُحفظ الصور في مخزن ملفات خاصّ (Cloudflare R2) لا تُفتح منه إلّا عبر روابط مؤقّتة تنتهي صلاحيتها بعد عشر دقائق، وتُحفظ الملاحظة ووقت التسليم في قاعدة البيانات. قد تُظهر الصورة وجهًا أو اسمًا أو تفاصيل شخصية أخرى، فلا يصوّر الطالب إلّا عمله. والمشروع محفوظ على سجلّ الطالب في صفّ الواجب باسم حساب الطالب الذي كتبه: ما دام مسودّة لم تُسلَّم فلا يراه إلّا ذلك الحساب. فإذا سُلِّم رآه أيضًا المعلّم الذي وضع الواجب وأولياء الأمور المرتبطون بالسجلّ نفسه، ولا يراه أحد غيرهم داخل التطبيق. وإن فكّ المعلّم ارتباط ذلك الحساب بالسجلّ وربطه بحساب آخر، بقي المشروع المُسلَّم على السجلّ يراه المعلّم وأولياء الأمور، ولا يُعرض على الحساب الجديد، ولا يستطيع تعديله ولا تسليم مشروع غيره في ذلك الواجب ما لم يحذفه المعلّم (البند السادس)، ولا يراه الحساب الأوّل ما دام غير مرتبط بالسجلّ. أمّا المسودّة التي لم تُسلَّم فلا يراها الحساب الجديد، وتُحذف بصورها وملاحظتها حين يبدأ مشروعه في الواجب نفسه. ويستطيع الطالب تعديل مشروعه المسلَّم حتى نهاية يوم التسليم، وما يعدّله يراه المعلّم وأولياء الأمور فورًا، ثم يصبح المشروع للقراءة فقط.',
        'بيانات تقنية: رمز الإشعارات الخاص بجهازك إن فعّلت الإشعارات، وأحداث استخدام مجهّلة نسبيًا (أيّ شاشة فُتحت، وأيّ أداة استُخدمت) — وهذه الأخيرة لا تُجمع إطلاقًا ما لم يكن مفتاح التحليلات مضبوطًا في النسخة التي تستخدمها.',
        'تسجيلات الشاشة: قد نسجّل ما يظهر على شاشتك وأين تلمس أو تنقر أثناء استخدامك التطبيق، لنفهم أين يتعثّر المستخدمون. يشمل ذلك المعلّمين والطلبة وأولياء الأمور، وصفحة الاختبار التي يفتحها الطالب من رابط. يتولّى ذلك على الويب Contentsquare (التي أصبحت Hotjar جزءًا منها)، وعلى أندرويد PostHog. تُحجب النصوص المعروضة وحقول الإدخال والصور في التسجيلات، فلا يظهر فيها اسم طالب ولا علامة ولا إجابة ولا رسالة. لا نسجّل صفحة موافقة وليّ الأمر لأنّ رابطها يحمل رمز الموافقة. لا يُسجَّل شيء ما لم تكن هذه الأدوات مضبوطة في النسخة التي تستخدمها.',
        'لا نطلب موقعك الجغرافي ولا نستخدمه، ولا نصل إلى الكاميرا. يطلب التطبيق الإذن بالوصول إلى صور جهازك عند إرفاق صورة بنفسك فقط، والصورة التي ترفقها قد تُحفظ كما أنتجها جهازك، ومعها البيانات المضمَّنة فيها، وقد تشمل مكان التقاطها إن كان هاتفك يضيفه.',
        'الميكروفون: يطلب التطبيق الإذن به حين يضغط الطالب زرّ التسجيل، ولا يسجّل إلّا من تلك الضغطة حتى يوقفه الطالب أو تنتهي مدّة التسجيل. تمرين النطق في ركن الإنجليزية يُبقي التسجيل على الجهاز ليسمعه الطالب، ولا يُرفع إلينا. وتمرين القراءة الجهرية في الدرس يُرسل التسجيل إلى OpenAI ليُحوَّل إلى نصّ يُقارَن بالنصّ المقروء، ولا نحفظ منه شيئًا. أمّا سؤال القراءة الجهرية في الاختبار فنحفظ تسجيله في مخزن الملفات الخاصّ (Cloudflare R2)، ومعه النصّ الذي تستخرجه OpenAI منه، ولا يستمع إليه داخل التطبيق إلّا معلّم الاختبار.',
      ],
    },
    {
      heading: '2) لماذا نستخدمها',
      body: [
        'لتشغيل ما طلبته: إنشاء الحساب والدخول إليه، وتوليد الخطط وأوراق العمل والاختبارات، وتصحيحها، وإيصال الرسائل والإشعارات.',
        'لحماية الخدمة: الحدّ من محاولات الدخول المتكرّرة، ومعالجة بلاغات الإساءة.',
        'لتحسين الخدمة: قياس أيّ الأدوات تُستخدم فعلًا، ومشاهدة تسجيلات الشاشة لفهم أين يتعثّر المستخدمون. هذا الاستخدام هو الوحيد الذي يعتمد على التحليلات، وهو الأقلّ ضرورة.',
        'لمراسلتك بالبريد الإلكتروني: رمز التحقّق ورمز استعادة كلمة المرور، وطلب موافقة وليّ الأمر حين يكتب الطالب بريده، ودعوة التطبيق وأخبار إطلاقه لمن سجّل اهتمامه. في أسفل كلّ رسالة رابط «إلغاء الاشتراك» يوقف رسائلنا إلى ذلك البريد، ما عدا رمزًا تطلبه أنت لإنشاء حساب أو لاستعادة كلمة المرور، فبدونه لا تصل إلى حسابك.',
        'لا نبيع بياناتك، ولا نستخدمها في إعلانات، ولا نبني منها ملفًّا إعلانيًّا عنك.',
      ],
    },
    {
      heading: '3) الذكاء الاصطناعي',
      body: [
        'حين تطلب توليد خطة درس أو ورقة عمل أو اختبار، يُرسَل نصّ طلبك — ومعه ما اخترته من الدرس والمنهاج، وأيّ مادة ألصقتها بنفسك في حقل السياق — إلى مزوّد نماذج لغوية خارجي (OpenAI) لمعالجته وإعادة النتيجة.',
        'لا تُرسَل أسماء الطلبة ولا علاماتهم ولا ملاحظات المعلّم عنهم إلى هذا المزوّد ضمن طلبات التوليد.',
        'وتُرسَل إليه تسجيلات القراءة الجهرية لتحويلها إلى نصّ فقط، كما في البند الأوّل.',
        'المحتوى المولَّد قد يكون خاطئًا. المعلّم هو من يراجعه قبل استخدامه مع الطلبة، ومفاتيح إجابات الرياضيات وحدها تمرّ على مُتحقِّق رمزيّ مستقلّ يُظهر التطبيق نتيجته صراحةً.',
      ],
    },
    {
      heading: '4) مع من تُشارَك',
      body: [
        'مزوّدو خدمة يعالجون البيانات نيابةً عنّا، لا أكثر: Neon لقاعدة البيانات (تُستضاف في فرانكفورت داخل الاتحاد الأوروبي)، وCloudflare R2 لتخزين الملفات والصور، وGoogle Cloud Run لتشغيل الخادم (أوروبا الغربية)، وCloudflare Pages لاستضافة نسخة الويب، وContentsquare لتسجيل الشاشة على نسخة الويب، وOpenAI لتوليد المحتوى وتحويل التسجيلات الصوتية إلى نصّ، وExpo لإيصال الإشعارات، وResend لإرسال البريد الإلكتروني، وPostHog لقياس الاستخدام وتسجيل الشاشة على أندرويد (خوادمها في الاتحاد الأوروبي)، وGoogle لخدمة الدخول بحساب Google.',
        'ويعني ذلك أنّ بعض بياناتك تُعالَج خارج الأردن وخارج الاتحاد الأوروبي.',
        'قد نُفصح عن بيانات إذا ألزمنا القانون بذلك، أو لحماية سلامة شخص ما.',
      ],
    },
    {
      heading: '5) الطلبة والقاصرون',
      body: [
        'يستطيع الطالب ووليّ الأمر إنشاء حساب في هذا الإصدار. فوليّ الأمر لا ينشئ حسابه إلّا برمز يمنحه المعلّم من قائمة صفّه، أمّا الطالب فينشئ حسابه بإحدى طريقتين: برمز المعلّم، أو ببريد إلكتروني دون رمز — وفي هذه الحالة الثانية يُقرّ بأنّه بالغ أو بأنّ وليّ أمره موافق على الحساب، ونحفظ وقت هذا الإقرار. وهذا يعني أنّ قاصرين يحملون حسابات هنا ويسجّلون الدخول إليها، وأنّ بعض الحسابات يُنشأ دون أن يعلم معلّم بوجوده.',
        'لا يصل حساب الطالب إلى أدوات المعلّم ولا إلى التوليد بالذكاء الاصطناعيّ. وما يصل إليه: مراسلة معلّمه، وتصفّح المنهاج، وواجباته واختباراته في صفّ معلّمه، ومنها تسليم مشروع الواجب (صور وملاحظة) حين يطلبه المعلّم، كما في البند الأوّل. والحساب الذي أُنشئ ببريد إلكتروني لا يرى واجبات ولا اختبارات ولا رسائل حتى يدخل رمز صفّ معلّمه.',
        'كلّ محادثة فرديّة تضمّ معلّمًا واحدًا وطرفًا واحدًا غير معلّم، ومحادثة المجموعة للإعلانات فقط ما لم يسمح معلّمها بالكتابة. فلا توجد قناة بين طالب وطالب.',
        'ومع ذلك يُدخل المعلّم بيانات عن طلبته: أسماءهم، ورقم القيد إن أضافه، وملاحظته عن الطالب. هذه بيانات شخصية تخصّ قاصرين وإن لم يكن لهم حساب.',
        'قبل أن يُدخل المعلّم أيّ اسم، يُقرّ داخل التطبيق بأنّ مدرسته حصلت على موافقة وليّ الأمر اللازمة. نحفظ وقت الإقرار ونصّه، ونمنع إدخال بيانات الطلبة قبله.',
        'يُقرّ المعلّم ووليّ الأمر عند التسجيل بأنّ عمره 18 سنة أو أكثر، ونحفظ وقت هذا الإقرار ونصّه مع موافقته على الشروط.',
        'لا يطلب التطبيق تاريخ ميلاد ولا يتحقّق من العمر، لأنّه لا يحتاج إليهما: جمع تاريخ ميلاد طفل دون حاجة إليه زيادة في البيانات لا نقصان.',
        'إن كنت وليّ أمر وتريد الاطّلاع على بيانات ابنك أو حذفها، فالطريق الأقصر هو معلّمه — فهو من أنشأ سجلّ الطالب ويملك حذفه — ويمكنك أيضًا مراسلتنا مباشرةً.',
      ],
    },
    {
      heading: '6) مدّة الحفظ والحذف',
      body: [
        'نحتفظ ببياناتك ما دام حسابك قائمًا.',
        'يمكنك حذف حسابك من داخل التطبيق: الإعدادات ← حذف الحساب. الحذف نهائي ولا رجعة فيه، ويجري فورًا لا بعد مهلة.',
        'حذف حساب المعلّم يحذف معه شُعَبه وسجلّات طلبته والاختبارات والمواد المحفوظة والرسائل التي أرسلها والملفات التي رفعها. وحذف حساب وليّ الأمر أو الطالب يحذف رسائله وارتباطه بسجلّ الصفّ، ويبقى سجلّ الطالب نفسه عند معلّمه لأنّه من بيانات المعلّم.',
        'مشاريع الواجبات: حين يحذف الطالب صورة من مشروعه تُزال من التخزين. وحذف حساب الطالب يحذف معه المشاريع التي كتبها، المسلَّمة منها والمسودّات، بصورها وملاحظاتها، في كلّ صفّ، حتى على سجلّ فُكّ ارتباطه به، ولا يحذف ما كتبه حساب آخر على السجلّ نفسه. وتُحذف المسودّة التي كتبها حساب لم يعد مرتبطًا بالسجلّ حين يبدأ الحساب المرتبط به الآن مشروعه في الواجب نفسه. وحين يحذف المعلّم الواجب، أو يحذف صفّه أو يؤرشفه، تُحذف صور كلّ المشاريع وملاحظاتها فيه، المسلَّمة منها والمسودّات، وكذلك كلّ مشروع في واجباته حين يحذف المعلّم حسابه. ويستطيع المعلّم الذي وضع الواجب أن يحذف مشروع طالب واحد فيه، المسلَّم أو المسودّة، فتُحذف صوره وملاحظته، ويعود الواجب غير مسلَّم لذلك الطالب. أمّا حذف حساب وليّ الأمر فلا يحذف شيئًا من مشاريع الطالب. وفي غير ذلك يبقى المشروع محفوظًا إلى أن يحدث أحد هذه الأمور.',
        'تسجيلات القراءة الجهرية في الاختبارات: يُحذف التسجيل حين يعيد الطالب تسجيل السؤال نفسه، أو حين يعيد اختبارًا قصيرًا، أو حين يحذف المعلّم محاولته، أو حين يحذف المعلّم حسابه. ولا يحذفه حذف المعلّم الاختبار من قائمته ولا حذف حساب الطالب، لأنّ إجابات الطالب من سجلّه عند معلّمه.',
        'يبقى بعد الحذف سجلّ محاسبيّ لتكلفة استخدام نماذج الذكاء الاصطناعي، منزوع الارتباط بأيّ شخص.',
        'وإن ألغيت اشتراكك في رسائلنا، نحتفظ بعنوان بريدك وحده في قائمة «لا تراسل» لنلتزم بطلبك، حتى بعد حذف الحساب، إلى أن تتراجع عن الإلغاء من الرابط نفسه أو تطلب منّا حذفه.',
      ],
    },
    {
      heading: '7) حقوقك',
      body: [
        'لك أن تطلب نسخة من بياناتك، أو تصحيحها، أو حذفها، أو الاعتراض على معالجتها. راسلنا على العنوان أدناه.',
        'وإن كان الحذف هو ما تريده فحسب، فزرّ الحذف داخل التطبيق أسرع من أيّ رسالة.',
      ],
    },
    {
      heading: '8) الأمان',
      body: [
        'تُنقل البيانات عبر اتصال مشفَّر، وتُخزَّن كلمات المرور مشفَّرة بخوارزمية bcrypt، وتُحفظ رموز الدخول على جهازك في المخزن الآمن الذي يوفّره نظام التشغيل.',
        'ولا توجد خدمة آمنة تمامًا. إن اطّلعنا على خرق يمسّ بياناتك، سنُعلمك.',
      ],
    },
    {
      heading: '9) تعديل هذه السياسة',
      body: [
        'قد نُحدّث هذه السياسة. التاريخ المثبَّت في أعلى الصفحة هو تاريخ آخر تحديث، وسنُعلمك داخل التطبيق بأيّ تغيير جوهريّ.',
      ],
    },
    {
      heading: '10) التواصل',
      body: [`لأيّ سؤال عن الخصوصية أو لطلب يخصّ بياناتك: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'This policy explains what data Iqrra collects, why, who it is shared with, and how you can delete it. It covers the mobile app, the web version, and the services behind them.',
  sections: [
    {
      heading: '1) What we collect',
      body: [
        'Account data: first and last name, email address, your password stored as a one-way bcrypt hash, your preferred language, your role (teacher, parent or student), and the time you last signed in. If you sign in with Google we store the identifier Google gives us instead of a password.',
        'Class data entered by a teacher: student names as the teacher types them, a register number if they add one, the teacher\'s written note about a student, and which classes a student belongs to. This is data a teacher enters about their own students; their responsibility for it is set out in the Terms of Service.',
        'Learning records: the tests and worksheets a teacher creates, students\' answers to them, and the marks and levels that result.',
        'Messages: we store the text of in-app messages, when they were sent and by whom, any image attached to them, and your device push token so notifications can be delivered. We do not read messages except when reviewing a report.',
        'Files: images or documents a teacher uploads and attaches to a lesson.',
        'Homework projects: when a teacher asks for a project on a homework, the student uploads up to six photos of their work from the device\'s photo library, and a written note of up to 2,000 characters; either one is enough to hand it in. The photos are kept in private file storage (Cloudflare R2) and are only ever opened through temporary links that expire after ten minutes; the note and the hand-in time are kept in the database. A photo can show a face, a name or other personal details, so a student should photograph nothing but their work. A project is stored on the student\'s record in the homework\'s class, under the student account that wrote it: while it is a draft that has not been handed in, only that account sees it. Once it is handed in, the teacher who set the homework and the parents linked to the same record see it too, and no one else in the app does. If the teacher unlinks that account from the record and links another, a handed-in project stays on the record for the teacher and the parents; it is not shown to the new account, which cannot change it or hand in another for that homework unless the teacher deletes it (section 6), and the first account does not see it while it is not linked to the record. A draft that was not handed in is not shown to the new account, and is deleted, with its photos and note, when the new account starts its own project on the same homework. A student can change a handed-in project until the due day ends, and the teacher and the parents see each change at once; after that the project is read-only.',
        'Technical data: your device\'s push notification token if you enable notifications, and usage events (which screen was opened, which tool was used). Usage events are not collected at all unless an analytics key is configured in the build you are using.',
        'Screen recordings: we may record what appears on your screen and where you tap or click while you use the app, to see where people get stuck. This includes teachers, students and parents, and the exam page a student opens from a link. On the web this is done by Contentsquare (of which Hotjar is now part), on Android by PostHog. Displayed text, input fields and images are masked in the recordings, so no student name, mark, answer or message appears in them. We do not record the parent consent page, because its link carries the approval token. Nothing is recorded unless these tools are configured in the build you are using.',
        'We do not ask for or use your location, and we do not access your camera. The app asks for photo library access only when you attach an image yourself. An image you attach may be stored as your device produced it, with the metadata embedded in it, which can include where it was taken if your phone adds that.',
        'Microphone: the app asks for it when a student presses record, and records only from that press until the student stops it or the time limit is reached. Speaking practice in the English corner keeps the recording on the device for the student to play back; it is never uploaded. Read-aloud practice in a lesson sends the recording to OpenAI to be turned into text and compared with the passage, and we keep nothing of it. For a read-aloud question in an exam we keep the recording in private file storage (Cloudflare R2), with the text OpenAI makes of it, and in the app only the exam\'s teacher can listen to it.',
      ],
    },
    {
      heading: '2) Why we use it',
      body: [
        'To run what you asked for: creating and signing in to an account, generating lesson plans, worksheets and tests, marking them, and delivering messages and notifications.',
        'To protect the service: limiting repeated sign-in attempts and acting on abuse reports.',
        'To improve the service: measuring which tools are actually used, and watching screen recordings to see where people get stuck. This is the only purpose that relies on analytics, and the least necessary one.',
        'To email you: verification and password-reset codes, a request for a parent\'s approval when a student gives their address, and the app invitation and launch news to people who registered interest. Every email has an Unsubscribe link at the bottom that stops our email to that address, except a code you ask for yourself to create an account or reset a password, without which you could not reach your account.',
        'We do not sell your data, we do not use it for advertising, and we do not build an advertising profile from it.',
      ],
    },
    {
      heading: '3) Artificial intelligence',
      body: [
        'When you ask for a lesson plan, worksheet or test, the text of your request — along with the lesson and curriculum you selected, and any material you pasted into the context field yourself — is sent to an external language model provider (OpenAI) to be processed and returned.',
        'Student names, marks and teacher notes about students are not sent to that provider as part of generation requests.',
        'Read-aloud recordings are sent to it only to be turned into text, as described in section 1.',
        'Generated content can be wrong. The teacher reviews it before using it with students. Mathematics answer keys alone are additionally checked by an independent symbolic verifier, whose result the app shows explicitly.',
      ],
    },
    {
      heading: '4) Who it is shared with',
      body: [
        'Service providers that process data on our behalf, and nothing more: Neon for the database (hosted in Frankfurt, in the EU), Cloudflare R2 for file and image storage, Google Cloud Run to run the server (western Europe), Cloudflare Pages to host the web version, Contentsquare for screen recording on the web version, OpenAI for content generation and speech-to-text, Expo to deliver notifications, Resend to send email, PostHog for usage measurement and screen recording on Android (its servers are in the European Union), and Google for Google Sign-In.',
        'This means some of your data is processed outside Jordan and outside the EU.',
        'We may disclose data where the law requires it, or to protect someone\'s safety.',
      ],
    },
    {
      heading: '5) Students and minors',
      body: [
        'Students and parents can hold an account in this release. A parent creates one only with a code the teacher issues from their own class list. A student creates one either with that code, or with an email and no code — in which case they confirm that they are an adult or that a parent or guardian agrees to the account, and we record when. This does mean minors hold accounts here and sign in to them, and that some accounts are created without any teacher knowing.',
        'A student account does not reach the teacher tools or any AI generation. What it reaches: messaging their teacher, browsing the curriculum, and their own homework and exams in their teacher\'s class, including handing in a homework project (photos and a note) when the teacher asks for one, as described in section 1. An account created with an email sees no homework, exams or messages until it enters its teacher\'s class code.',
        'Every direct conversation has exactly one teacher and one non-teacher, and a group is announcement-only unless its owning teacher allows students to post. There is no student-to-student channel.',
        'Teachers do, however, enter data about their students: names, a register number if they add one, and the teacher\'s note. That is personal data about a minor whether or not the child has an account.',
        'Before a teacher can enter any name, they confirm in the app that their school has obtained the parental consent required. We record when they confirmed and the wording they were shown, and we block student data from being entered until they do.',
        'A teacher or a parent confirms when signing up that they are 18 or older, and we record when, and the wording, with their acceptance of the terms.',
        'The app does not ask for a date of birth and does not verify age, because it needs neither. Collecting a birthdate we have no use for would be more data held about a child, not less.',
        'If you are a parent and want to see or delete your child\'s data, the shortest route is their teacher — the teacher created the student record and can delete it — and you can also write to us directly.',
      ],
    },
    {
      heading: '6) Retention and deletion',
      body: [
        'We keep your data for as long as your account exists.',
        'You can delete your account from inside the app: Settings → Delete account. Deletion is permanent, cannot be undone, and happens immediately rather than after a waiting period.',
        'Deleting a teacher account also deletes their classes, student records, evaluations, saved materials, messages they sent and files they uploaded. Deleting a parent or student account deletes their messages and their link to a class record; the student record itself stays with the teacher, because it is the teacher\'s data.',
        'Homework projects: when a student removes a photo from their project, it is removed from storage. Deleting a student account deletes the projects that account wrote, handed-in and draft, photos and notes, in every class, including on a record it has since been unlinked from; it does not delete what another account wrote on the same record. A draft written by an account that is no longer linked to the record is deleted when the account linked to it now starts its own project on the same homework. When the teacher deletes the homework, or deletes or archives its class, every project photo and note in it is deleted, handed-in or draft, and so is every project on the teacher\'s homework when the teacher deletes their account. The teacher who set a homework can also delete one student\'s project on it, handed-in or draft, which deletes its photos and note; the homework then shows as not handed in for that student. Deleting a parent account deletes none of the student\'s projects. Otherwise a project is kept until one of these happens.',
        'Read-aloud recordings in exams: a recording is deleted when the student records the same question again, when they retake a quiz, when the teacher deletes their attempt, or when the teacher deletes their account. Removing the exam from the teacher\'s list does not delete it, and neither does deleting the student\'s account, because a student\'s answers are part of their record with the teacher.',
        'What survives deletion is an accounting row for the cost of AI usage, with no person attached to it.',
        'If you unsubscribe from our email, we keep your address alone on a do-not-email list so we can honour that, even after your account is deleted, until you undo it from the same link or ask us to remove it.',
      ],
    },
    {
      heading: '7) Your rights',
      body: [
        'You may ask for a copy of your data, or ask us to correct it, delete it, or stop processing it. Write to the address below.',
        'If deletion is all you want, the button inside the app is faster than any email.',
      ],
    },
    {
      heading: '8) Security',
      body: [
        'Data travels over an encrypted connection, passwords are stored hashed with bcrypt, and sign-in tokens are held on your device in the secure storage the operating system provides.',
        'No service is perfectly secure. If we learn of a breach affecting your data, we will tell you.',
      ],
    },
    {
      heading: '9) Changes to this policy',
      body: [
        'We may update this policy. The date at the top of this page is when it last changed, and we will tell you in the app about any material change.',
      ],
    },
    {
      heading: '10) Contact',
      body: [`For any privacy question or a request about your data: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const TERMS_AR: LegalDoc = {
  title: 'شروط الخدمة',
  intro:
    'باستخدامك تطبيق «إقرأ» فإنك توافق على هذه الشروط. اقرأها قبل إنشاء حساب؛ فإن لم توافق عليها فلا تستخدم التطبيق.',
  sections: [
    {
      heading: '1) من يستطيع استخدام التطبيق',
      body: [
        'التطبيق لمعلّمي المنهاج الوطني الأردني، ولطلبتهم وأولياء أمورهم. ينضمّ وليّ الأمر برمز من المعلّم، وينضمّ الطالب برمز من المعلّم أو ببريد إلكتروني. حساب الطالب ووليّ الأمر للمراسلة، ومتابعة واجبات الطالب واختباراته في صفّ معلّمه (ومنها مشروع الواجب الذي يسلّمه الطالب)، وتصفّح المنهاج، لا لأدوات المعلّم.',
        'يجب أن يكون عمر المعلّم ووليّ الأمر 18 سنة أو أكثر لإنشاء حساب، ويُقرّ بذلك عند التسجيل. وإن تبيّن لنا أنّ حساب معلّم أو وليّ أمر لشخص دون 18 سنة، فلنا أن نوقفه أو نحذفه.',
        'وللطالب دون 18 سنة أن يستخدم حسابًا أُنشئ برمز من معلّمه، أو أنشأه بموافقة وليّ أمره.',
        'أنت مسؤول عن سرّية كلمة مرورك وعن كلّ ما يجري عبر حسابك.',
      ],
    },
    {
      heading: '2) مسؤولية المعلّم عن بيانات طلبته',
      body: [
        'حين تُدخل أسماء طلبتك وملاحظاتك عنهم، فأنت من يقرّر ما يُدخَل ولماذا، ونحن نعالجه نيابةً عنك.',
        'قبل أن تُدخل أيّ اسم، يطلب التطبيق إقرارك بأنّ مدرستك حصلت على موافقة وليّ الأمر اللازمة. الإقرار عنك أنت، ونحن نحفظ وقته ونصّه.',
        'أَدخِل الحدّ الأدنى اللازم، والتزم بما تفرضه مدرستك ووزارة التربية والتعليم من قواعد بشأن بيانات الطلبة.',
      ],
    },
    {
      heading: '3) قواعد السلوك',
      body: [
        'يُمنع نشر ما هو مسيء أو تهديديّ أو مخلّ أو غير قانونيّ، ويُمنع التحرّش بأيّ مستخدم، ويُمنع انتحال صفة غيرك.',
        'في مشروع الواجب لا يرفع الطالب إلّا صور عمله، لا صور أشخاص ولا وثائق شخصية ولا شيئًا تمنعه هذه القواعد.',
        'المراسلة في هذا الإصدار بين المعلّم وطلبته وأولياء أمورهم فقط، ولا توجد قناة بين طالب وطالب: كلّ محادثة فرديّة تضمّ معلّمًا واحدًا، والمجموعة للإعلانات ما لم يسمح معلّمها بالكتابة.',
        'في كلّ محادثة زرّان «حظر» و«إبلاغ»، ونراجع البلاغات، ولنا أن نحذف المحتوى المخالف وأن نوقف الحساب المخالف أو نحذفه. ويبقى معلّم المجموعة مطّلعًا على ما يُكتب فيها.',
      ],
    },
    {
      heading: '4) المحتوى المولَّد بالذكاء الاصطناعي',
      body: [
        'يولّد التطبيق خططًا وأوراق عمل واختبارات ومفاتيح إجابات. قد تحتوي على أخطاء أو على ما لا يناسب صفّك.',
        'المعلّم هو المسؤول عن مراجعة كلّ ما يولّده التطبيق قبل استخدامه مع الطلبة أو بناء علامة عليه. لا نقدّم أيّ ضمان بصحّة المحتوى المولَّد.',
        'حيث يُظهر التطبيق شارة تحقُّق رمزيّ على مفتاح إجابة رياضيّات، فذلك يعني أنّ مُتحقِّقًا مستقلًّا اشتقّ الإجابة نفسها — لا أنّ السؤال كلّه صحيح أو مناسب.',
      ],
    },
    {
      heading: '5) المناهج وحقوق المؤلّف',
      body: [
        'كتب المنهاج الوطني ملك للمركز الوطني لتطوير المناهج، والمواد التي أعدّها معلّمون تبقى ملكًا لأصحابها. يستعين التطبيق بها ويحيل إليها، ولا يمنحك حقًّا في إعادة نشرها.',
        'ما تُنشئه أنت من مواد يبقى لك، وتمنحنا إذنًا بتخزينه ومعالجته لتقديم الخدمة لك فقط.',
      ],
    },
    {
      heading: '6) توفّر الخدمة',
      body: [
        'نقدّم الخدمة «كما هي». قد تنقطع أو تتغيّر ميزاتها أو تُوقف بعضها.',
        'احتفظ بنسخة من أيّ مادة تعتمد عليها في عملك؛ فالتصدير إلى Word وPowerPoint وPDF متاح داخل التطبيق لهذا الغرض.',
      ],
    },
    {
      heading: '7) إنهاء الاستخدام',
      body: [
        'يمكنك حذف حسابك متى شئت من الإعدادات، والحذف نهائيّ.',
        'ولنا أن نوقف حسابًا أو نحذفه إذا خالف هذه الشروط، ولا سيّما قواعد السلوك في البند الثالث.',
      ],
    },
    {
      heading: '8) حدود المسؤولية',
      body: [
        'إلى الحدّ الذي يسمح به القانون، لا نتحمّل مسؤولية أيّ ضرر غير مباشر ناتج عن استخدام التطبيق، بما في ذلك ما ينشأ عن الاعتماد على محتوى مولَّد دون مراجعته.',
      ],
    },
    {
      heading: '9) القانون الواجب التطبيق',
      body: ['تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية.'],
    },
    {
      heading: '10) التواصل',
      body: [`لأيّ سؤال عن هذه الشروط: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const TERMS_EN: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'By using Iqrra you agree to these terms. Read them before creating an account; if you do not agree to them, do not use the app.',
  sections: [
    {
      heading: '1) Who may use the app',
      body: [
        'The app is for teachers of the Jordanian national curriculum, and for their students and parents. A parent joins with a code from their teacher; a student joins with a code from their teacher or with an email. A student or parent account is for messaging, following the student\'s homework and exams in their teacher\'s class (including a homework project the student hands in), and browsing the curriculum, not for the teacher tools.',
        'A teacher or a parent must be 18 or older to create an account, and confirms it when signing up. If we learn that a teacher or parent account belongs to someone under 18, we may suspend or delete it.',
        'A student under 18 may use an account created with a code from their teacher, or created with the agreement of their parent or guardian.',
        'You are responsible for keeping your password confidential and for everything done through your account.',
      ],
    },
    {
      heading: '2) A teacher\'s responsibility for student data',
      body: [
        'When you enter your students\' names and your notes about them, you decide what is entered and why, and we process it on your behalf.',
        'Before you can enter any name, the app asks you to confirm that your school has obtained the parental consent required. That confirmation is yours to give, and we record when you gave it and the wording you were shown.',
        'Enter the minimum you need, and follow whatever rules your school and the Ministry of Education set for student data.',
      ],
    },
    {
      heading: '3) Rules of conduct',
      body: [
        'Do not post anything abusive, threatening, obscene or unlawful, do not harass any user, and do not impersonate anyone.',
        'In a homework project a student uploads photos of their own work and nothing else: not photos of people, not personal documents, nothing these rules forbid.',
        'Messaging in this release is between a teacher and their students and parents only, and there is no student-to-student channel: every direct conversation has exactly one teacher, and a group is announcement-only unless its owning teacher allows posting.',
        'Every conversation has Block and Report, we review reports, and we may remove offending content and suspend or delete an offending account. A group\'s owning teacher always sees what is posted in it.',
      ],
    },
    {
      heading: '4) AI-generated content',
      body: [
        'The app generates lesson plans, worksheets, tests and answer keys. They can contain errors, or content that does not suit your class.',
        'The teacher is responsible for reviewing everything the app generates before using it with students or basing a mark on it. We give no warranty that generated content is correct.',
        'Where the app shows a symbolic verification badge on a mathematics answer key, that means an independent verifier derived the same answer — not that the whole question is correct or appropriate.',
      ],
    },
    {
      heading: '5) Curriculum and copyright',
      body: [
        'National curriculum books belong to the National Center for Curriculum Development, and teacher-made materials remain their authors\'. The app draws on them and refers to them; it does not grant you a right to republish them.',
        'Material you create stays yours, and you give us permission to store and process it solely to provide the service to you.',
      ],
    },
    {
      heading: '6) Availability',
      body: [
        'The service is provided "as is". It may be interrupted, its features may change, and parts of it may be discontinued.',
        'Keep your own copy of any material your work depends on — export to Word, PowerPoint and PDF is available in the app for exactly this reason.',
      ],
    },
    {
      heading: '7) Ending your use',
      body: [
        'You can delete your account at any time from Settings. Deletion is permanent.',
        'We may suspend or delete an account that breaks these terms, in particular the rules of conduct in section 3.',
      ],
    },
    {
      heading: '8) Limitation of liability',
      body: [
        'To the extent the law allows, we are not liable for indirect loss arising from your use of the app, including loss arising from relying on generated content without reviewing it.',
      ],
    },
    {
      heading: '9) Governing law',
      body: ['These terms are governed by the laws of the Hashemite Kingdom of Jordan.'],
    },
    {
      heading: '10) Contact',
      body: [`For any question about these terms: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const DOCS: Record<LegalDocId, { ar: LegalDoc; en: LegalDoc }> = {
  privacy: { ar: PRIVACY_AR, en: PRIVACY_EN },
  terms: { ar: TERMS_AR, en: TERMS_EN },
};

export function isLegalDocId(value: string | undefined): value is LegalDocId {
  return value === 'privacy' || value === 'terms';
}

export function getLegalDoc(id: LegalDocId, lang: 'ar' | 'en'): LegalDoc {
  return DOCS[id][lang];
}
