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
 * `lib/db` (Neon), `services/analytics.ts` (PostHog, US host by default),
 * `services/pushTokens.ts` (Expo), `routes/auth.ts` (Google Sign-In) and the
 * OpenAI client in `lib/aiBudget.ts`. The data inventory is `lib/db/src/schema`.
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
 * What the student surface actually is, and what §5 below relies on: messaging
 * and the curriculum tab. iQra and the AI tools are hidden from these roles and
 * refused server-side. A direct thread always has exactly one teacher and one
 * non-teacher, and a group is announcement-only until its owning teacher
 * enables student posting — so no student-to-student channel exists. If any of
 * that changes, §5 and the conduct rules are wrong until they are rewritten.
 */

/**
 * Must be a real, monitored mailbox before either store listing goes in — a
 * reviewer may write to it, and a data-subject request has a statutory clock.
 * Nothing in the repo establishes an existing address, so this is a
 * placeholder and is deliberately obvious.
 */
export const LEGAL_CONTACT_EMAIL = 'privacy@iqraa.app';

/** Shown on both documents. Bump when the text below changes materially. */
export const LEGAL_LAST_UPDATED = { ar: '٦ أيلول ٢٠٢٦', en: '6 September 2026' };

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };
export type LegalDocId = 'privacy' | 'terms';

const PRIVACY_AR: LegalDoc = {
  title: 'سياسة الخصوصية',
  intro:
    'توضّح هذه السياسة ما الذي يجمعه تطبيق «اقرأ» من بيانات، ولماذا يجمعه، ومع من يُشارَك، وكيف يمكنك حذفه. وهي تنطبق على التطبيق وعلى نسخته على الويب وعلى الخدمات التي تقف خلفهما.',
  sections: [
    {
      heading: '١) البيانات التي نجمعها',
      body: [
        'بيانات الحساب: الاسم الأول واسم العائلة، والبريد الإلكتروني، وكلمة المرور مخزَّنة بصيغة مشفَّرة لا يمكن الرجوع منها إلى الكلمة الأصلية (bcrypt)، ولغتك المفضَّلة، وصفتك في التطبيق (معلّم أو وليّ أمر أو طالب)، وتاريخ آخر دخول. وإن اخترت الدخول بحساب Google فإننا نحفظ المعرّف الذي تزوّدنا به Google بدلاً من كلمة مرور.',
        'بيانات الصفّ التي يُدخلها المعلّم: أسماء الطلبة كما يكتبها المعلّم، ورقم القيد إن أضافه، وملاحظته المكتوبة عن الطالب، وتوزيع الطلبة على الشُّعَب. هذه بيانات يُدخلها المعلّم عن طلبته، ومسؤوليته تجاهها موضَّحة في شروط الخدمة.',
        'سجلّات التعلّم: الاختبارات وأوراق العمل التي يُنشئها المعلّم، وإجابات الطلبة عليها، والعلامات والتقديرات الناتجة عنها.',
        'الرسائل: نحفظ نصّ الرسائل داخل التطبيق ووقتها ومَن أرسلها، والصور المرفقة بها إن وُجدت، ورمز الإشعارات الخاصّ بجهازك لإيصال التنبيهات. لا نقرأ الرسائل إلّا عند مراجعة بلاغ.',
        'الملفات: ما يرفعه المعلّم من صور أو مستندات ويربطه بدرس.',
        'بيانات تقنية: رمز الإشعارات الخاص بجهازك إن فعّلت الإشعارات، وأحداث استخدام مجهّلة نسبيًا (أيّ شاشة فُتحت، وأيّ أداة استُخدمت) — وهذه الأخيرة لا تُجمع إطلاقًا ما لم يكن مفتاح التحليلات مضبوطًا في النسخة التي تستخدمها.',
        'لا نجمع موقعك الجغرافي، ولا نصل إلى الكاميرا أو الميكروفون. التطبيق يطلب الإذن بالوصول إلى صور جهازك فقط، وفقط عند إرفاق صورة بنفسك.',
      ],
    },
    {
      heading: '٢) لماذا نستخدمها',
      body: [
        'لتشغيل ما طلبته: إنشاء الحساب والدخول إليه، وتوليد الخطط وأوراق العمل والاختبارات، وتصحيحها، وإيصال الرسائل والإشعارات.',
        'لحماية الخدمة: الحدّ من محاولات الدخول المتكرّرة، ومعالجة بلاغات الإساءة.',
        'لتحسين الخدمة: قياس أيّ الأدوات تُستخدم فعلًا. هذا الاستخدام هو الوحيد الذي يعتمد على التحليلات، وهو الأقلّ ضرورة.',
        'لا نبيع بياناتك، ولا نستخدمها في إعلانات، ولا نبني منها ملفًّا إعلانيًّا عنك.',
      ],
    },
    {
      heading: '٣) الذكاء الاصطناعي',
      body: [
        'حين تطلب توليد خطة درس أو ورقة عمل أو اختبار، يُرسَل نصّ طلبك — ومعه ما اخترته من الدرس والمنهاج، وأيّ مادة ألصقتها بنفسك في حقل السياق — إلى مزوّد نماذج لغوية خارجي (OpenAI) لمعالجته وإعادة النتيجة.',
        'لا تُرسَل أسماء الطلبة ولا علاماتهم ولا ملاحظات المعلّم عنهم إلى هذا المزوّد ضمن طلبات التوليد.',
        'المحتوى المولَّد قد يكون خاطئًا. المعلّم هو من يراجعه قبل استخدامه مع الطلبة، ومفاتيح إجابات الرياضيات وحدها تمرّ على مُتحقِّق رمزيّ مستقلّ يُظهر التطبيق نتيجته صراحةً.',
      ],
    },
    {
      heading: '٤) مع من تُشارَك',
      body: [
        'مزوّدو خدمة يعالجون البيانات نيابةً عنّا، لا أكثر: Neon لقاعدة البيانات (تُستضاف في فرانكفورت داخل الاتحاد الأوروبي)، وCloudflare R2 لتخزين الملفات والصور، وGoogle Cloud Run لتشغيل الخادم (أوروبا الغربية)، وRender لاستضافة نسخة الويب، وOpenAI لتوليد المحتوى، وExpo لإيصال الإشعارات، وPostHog لقياس الاستخدام (خوادمها في الولايات المتحدة افتراضيًّا)، وGoogle لخدمة الدخول بحساب Google.',
        'ويعني ذلك أنّ بعض بياناتك تُعالَج خارج الأردن وخارج الاتحاد الأوروبي.',
        'قد نُفصح عن بيانات إذا ألزمنا القانون بذلك، أو لحماية سلامة شخص ما.',
      ],
    },
    {
      heading: '٥) الطلبة والقاصرون',
      body: [
        'يستطيع الطالب ووليّ الأمر إنشاء حساب في هذا الإصدار، ولا يتمّ ذلك إلّا برمز يمنحه المعلّم من قائمة صفّه — فلا يُنشأ حساب من خارج الصفّ. وهذا يعني أنّ قاصرين يحملون حسابات هنا ويسجّلون الدخول إليها.',
        'ما يصل إليه حساب الطالب محصور في أمرين: مراسلة معلّمه، وتصفّح المنهاج. ولا يصل إلى أدوات المعلّم ولا إلى التوليد بالذكاء الاصطناعيّ.',
        'كلّ محادثة فرديّة تضمّ معلّمًا واحدًا وطرفًا واحدًا غير معلّم، ومحادثة المجموعة للإعلانات فقط ما لم يسمح معلّمها بالكتابة. فلا توجد قناة بين طالب وطالب.',
        'ومع ذلك يُدخل المعلّم بيانات عن طلبته: أسماءهم، ورقم القيد إن أضافه، وملاحظته عن الطالب. هذه بيانات شخصية تخصّ قاصرين وإن لم يكن لهم حساب.',
        'قبل أن يُدخل المعلّم أيّ اسم، يُقرّ داخل التطبيق بأنّ مدرسته حصلت على موافقة وليّ الأمر اللازمة. نحفظ وقت الإقرار ونصّه، ونمنع إدخال بيانات الطلبة قبله.',
        'لا يطلب التطبيق تاريخ ميلاد ولا يتحقّق من العمر، لأنّه لا يحتاج إليهما: جمع تاريخ ميلاد طفل دون حاجة إليه زيادة في البيانات لا نقصان.',
        'إن كنت وليّ أمر وتريد الاطّلاع على بيانات ابنك أو حذفها، فالطريق الأقصر هو معلّمه — فهو من أنشأ سجلّ الطالب ويملك حذفه — ويمكنك أيضًا مراسلتنا مباشرةً.',
      ],
    },
    {
      heading: '٦) مدّة الحفظ والحذف',
      body: [
        'نحتفظ ببياناتك ما دام حسابك قائمًا.',
        'يمكنك حذف حسابك من داخل التطبيق: الإعدادات ← حذف الحساب. الحذف نهائي ولا رجعة فيه، ويجري فورًا لا بعد مهلة.',
        'حذف حساب المعلّم يحذف معه شُعَبه وسجلّات طلبته والاختبارات والمواد المحفوظة والرسائل التي أرسلها والملفات التي رفعها. وحذف حساب وليّ الأمر أو الطالب يحذف رسائله وارتباطه بسجلّ الصفّ، ويبقى سجلّ الطالب نفسه عند معلّمه لأنّه من بيانات المعلّم.',
        'يبقى بعد الحذف سجلّ محاسبيّ لتكلفة استخدام نماذج الذكاء الاصطناعي، منزوع الارتباط بأيّ شخص.',
      ],
    },
    {
      heading: '٧) حقوقك',
      body: [
        'لك أن تطلب نسخة من بياناتك، أو تصحيحها، أو حذفها، أو الاعتراض على معالجتها. راسلنا على العنوان أدناه.',
        'وإن كان الحذف هو ما تريده فحسب، فزرّ الحذف داخل التطبيق أسرع من أيّ رسالة.',
      ],
    },
    {
      heading: '٨) الأمان',
      body: [
        'تُنقل البيانات عبر اتصال مشفَّر، وتُخزَّن كلمات المرور مشفَّرة بخوارزمية bcrypt، وتُحفظ رموز الدخول على جهازك في المخزن الآمن الذي يوفّره نظام التشغيل.',
        'ولا توجد خدمة آمنة تمامًا. إن اطّلعنا على خرق يمسّ بياناتك، سنُعلمك.',
      ],
    },
    {
      heading: '٩) تعديل هذه السياسة',
      body: [
        'قد نُحدّث هذه السياسة. التاريخ المثبَّت في أعلى الصفحة هو تاريخ آخر تحديث، وسنُعلمك داخل التطبيق بأيّ تغيير جوهريّ.',
      ],
    },
    {
      heading: '١٠) التواصل',
      body: [`لأيّ سؤال عن الخصوصية أو لطلب يخصّ بياناتك: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: 'Privacy Policy',
  intro:
    'This policy explains what data IQRA collects, why, who it is shared with, and how you can delete it. It covers the mobile app, the web version, and the services behind them.',
  sections: [
    {
      heading: '1) What we collect',
      body: [
        'Account data: first and last name, email address, your password stored as a one-way bcrypt hash, your preferred language, your role (teacher, parent or student), and the time you last signed in. If you sign in with Google we store the identifier Google gives us instead of a password.',
        'Class data entered by a teacher: student names as the teacher types them, a register number if they add one, the teacher\'s written note about a student, and which classes a student belongs to. This is data a teacher enters about their own students; their responsibility for it is set out in the Terms of Service.',
        'Learning records: the tests and worksheets a teacher creates, students\' answers to them, and the marks and levels that result.',
        'Messages: we store the text of in-app messages, when they were sent and by whom, any image attached to them, and your device push token so notifications can be delivered. We do not read messages except when reviewing a report.',
        'Files: images or documents a teacher uploads and attaches to a lesson.',
        'Technical data: your device\'s push notification token if you enable notifications, and usage events (which screen was opened, which tool was used). Usage events are not collected at all unless an analytics key is configured in the build you are using.',
        'We do not collect your location, and we do not access your camera or microphone. The app asks for photo library access only, and only when you attach an image yourself.',
      ],
    },
    {
      heading: '2) Why we use it',
      body: [
        'To run what you asked for: creating and signing in to an account, generating lesson plans, worksheets and tests, marking them, and delivering messages and notifications.',
        'To protect the service: limiting repeated sign-in attempts and acting on abuse reports.',
        'To improve the service: measuring which tools are actually used. This is the only purpose that relies on analytics, and the least necessary one.',
        'We do not sell your data, we do not use it for advertising, and we do not build an advertising profile from it.',
      ],
    },
    {
      heading: '3) Artificial intelligence',
      body: [
        'When you ask for a lesson plan, worksheet or test, the text of your request — along with the lesson and curriculum you selected, and any material you pasted into the context field yourself — is sent to an external language model provider (OpenAI) to be processed and returned.',
        'Student names, marks and teacher notes about students are not sent to that provider as part of generation requests.',
        'Generated content can be wrong. The teacher reviews it before using it with students. Mathematics answer keys alone are additionally checked by an independent symbolic verifier, whose result the app shows explicitly.',
      ],
    },
    {
      heading: '4) Who it is shared with',
      body: [
        'Service providers that process data on our behalf, and nothing more: Neon for the database (hosted in Frankfurt, in the EU), Cloudflare R2 for file and image storage, Google Cloud Run to run the server (western Europe), Render to host the web version, OpenAI for content generation, Expo to deliver notifications, PostHog for usage measurement (its servers are in the United States by default), and Google for Google Sign-In.',
        'This means some of your data is processed outside Jordan and outside the EU.',
        'We may disclose data where the law requires it, or to protect someone\'s safety.',
      ],
    },
    {
      heading: '5) Students and minors',
      body: [
        'Students and parents can hold an account in this release. One is created only with a code the teacher issues from their own class list, so no account is created from outside a class. This does mean minors hold accounts here and sign in to them.',
        'A student account reaches two things and no more: messaging their teacher, and browsing the curriculum. It does not reach the teacher tools or any AI generation.',
        'Every direct conversation has exactly one teacher and one non-teacher, and a group is announcement-only unless its owning teacher allows students to post. There is no student-to-student channel.',
        'Teachers do, however, enter data about their students: names, a register number if they add one, and the teacher\'s note. That is personal data about a minor whether or not the child has an account.',
        'Before a teacher can enter any name, they confirm in the app that their school has obtained the parental consent required. We record when they confirmed and the wording they were shown, and we block student data from being entered until they do.',
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
        'What survives deletion is an accounting row for the cost of AI usage, with no person attached to it.',
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
    'باستخدامك تطبيق «اقرأ» فإنك توافق على هذه الشروط. اقرأها قبل إنشاء حساب؛ فإن لم توافق عليها فلا تستخدم التطبيق.',
  sections: [
    {
      heading: '١) من يستطيع استخدام التطبيق',
      body: [
        'التطبيق لمعلّمي المنهاج الوطني الأردني، ولطلبتهم وأولياء أمورهم ممّن انضمّوا برمز من المعلّم. حساب الطالب ووليّ الأمر للمراسلة وتصفّح المنهاج فقط.',
        'يجب أن تكون بالغًا سنّ الرشد في بلدك لإنشاء حساب.',
        'أنت مسؤول عن سرّية كلمة مرورك وعن كلّ ما يجري عبر حسابك.',
      ],
    },
    {
      heading: '٢) مسؤولية المعلّم عن بيانات طلبته',
      body: [
        'حين تُدخل أسماء طلبتك وملاحظاتك عنهم، فأنت من يقرّر ما يُدخَل ولماذا، ونحن نعالجه نيابةً عنك.',
        'قبل أن تُدخل أيّ اسم، يطلب التطبيق إقرارك بأنّ مدرستك حصلت على موافقة وليّ الأمر اللازمة. الإقرار عنك أنت، ونحن نحفظ وقته ونصّه.',
        'أَدخِل الحدّ الأدنى اللازم، والتزم بما تفرضه مدرستك ووزارة التربية والتعليم من قواعد بشأن بيانات الطلبة.',
      ],
    },
    {
      heading: '٣) قواعد السلوك',
      body: [
        'يُمنع نشر ما هو مسيء أو تهديديّ أو مخلّ أو غير قانونيّ، ويُمنع التحرّش بأيّ مستخدم، ويُمنع انتحال صفة غيرك.',
        'المراسلة في هذا الإصدار بين المعلّم وطلبته وأولياء أمورهم فقط، ولا توجد قناة بين طالب وطالب: كلّ محادثة فرديّة تضمّ معلّمًا واحدًا، والمجموعة للإعلانات ما لم يسمح معلّمها بالكتابة.',
        'في كلّ محادثة زرّان «حظر» و«إبلاغ»، ونراجع البلاغات، ولنا أن نحذف المحتوى المخالف وأن نوقف الحساب المخالف أو نحذفه. ويبقى معلّم المجموعة مطّلعًا على ما يُكتب فيها.',
      ],
    },
    {
      heading: '٤) المحتوى المولَّد بالذكاء الاصطناعي',
      body: [
        'يولّد التطبيق خططًا وأوراق عمل واختبارات ومفاتيح إجابات. قد تحتوي على أخطاء أو على ما لا يناسب صفّك.',
        'المعلّم هو المسؤول عن مراجعة كلّ ما يولّده التطبيق قبل استخدامه مع الطلبة أو بناء علامة عليه. لا نقدّم أيّ ضمان بصحّة المحتوى المولَّد.',
        'حيث يُظهر التطبيق شارة تحقُّق رمزيّ على مفتاح إجابة رياضيّات، فذلك يعني أنّ مُتحقِّقًا مستقلًّا اشتقّ الإجابة نفسها — لا أنّ السؤال كلّه صحيح أو مناسب.',
      ],
    },
    {
      heading: '٥) المناهج وحقوق المؤلّف',
      body: [
        'كتب المنهاج الوطني ملك للمركز الوطني لتطوير المناهج، والمواد التي أعدّها معلّمون تبقى ملكًا لأصحابها. يستعين التطبيق بها ويحيل إليها، ولا يمنحك حقًّا في إعادة نشرها.',
        'ما تُنشئه أنت من مواد يبقى لك، وتمنحنا إذنًا بتخزينه ومعالجته لتقديم الخدمة لك فقط.',
      ],
    },
    {
      heading: '٦) توفّر الخدمة',
      body: [
        'نقدّم الخدمة «كما هي». قد تنقطع أو تتغيّر ميزاتها أو تُوقف بعضها.',
        'احتفظ بنسخة من أيّ مادة تعتمد عليها في عملك؛ فالتصدير إلى Word وPowerPoint وPDF متاح داخل التطبيق لهذا الغرض.',
      ],
    },
    {
      heading: '٧) إنهاء الاستخدام',
      body: [
        'يمكنك حذف حسابك متى شئت من الإعدادات، والحذف نهائيّ.',
        'ولنا أن نوقف حسابًا أو نحذفه إذا خالف هذه الشروط، ولا سيّما قواعد السلوك في البند الثالث.',
      ],
    },
    {
      heading: '٨) حدود المسؤولية',
      body: [
        'إلى الحدّ الذي يسمح به القانون، لا نتحمّل مسؤولية أيّ ضرر غير مباشر ناتج عن استخدام التطبيق، بما في ذلك ما ينشأ عن الاعتماد على محتوى مولَّد دون مراجعته.',
      ],
    },
    {
      heading: '٩) القانون الواجب التطبيق',
      body: ['تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية.'],
    },
    {
      heading: '١٠) التواصل',
      body: [`لأيّ سؤال عن هذه الشروط: ${LEGAL_CONTACT_EMAIL}`],
    },
  ],
};

const TERMS_EN: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'By using IQRA you agree to these terms. Read them before creating an account; if you do not agree to them, do not use the app.',
  sections: [
    {
      heading: '1) Who may use the app',
      body: [
        'The app is for teachers of the Jordanian national curriculum, and for their students and parents who joined with a code from their teacher. A student or parent account is for messaging and browsing the curriculum only.',
        'You must be of the age of majority where you live to create an account.',
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
