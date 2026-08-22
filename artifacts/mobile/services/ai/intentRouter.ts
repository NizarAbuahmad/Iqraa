/**
 * Intent Router — classifies chat messages BEFORE curriculum / Teaching Assistant.
 * Demo Mode only; fully local. Greetings & small talk never trigger lesson generation.
 */

export type ChatRouteIntent =
  | 'greeting'
  | 'small_talk'
  | 'off_topic'
  | 'teaching'
  | 'artifact'
  | 'refinement'
  | 'ambiguous';

export type IntentRouteResult = {
  intent: ChatRouteIntent;
  /** True when Teaching Assistant + curriculum context may run. */
  useTeachingPipeline: boolean;
  /** Prebuilt reply for social / clarify paths (no KB). */
  socialReply?: string;
};

function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .replace(/^[\"'«»]+|[\"'«»]+$/g, '')
    .replace(/[!?؟.،,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGreeting(q: string): boolean {
  const lower = q.toLowerCase();
  // Exact / near-exact greetings only — keep short so "مرحبا كيف أشرح" is not a greeting
  if (/^(hi|hello|hey|yo|hiya|hola)\b/.test(lower) && lower.split(' ').length <= 3) {
    return true;
  }
  if (
    /^(مرحباً?|مرحبا|اهلاً?|أهلاً?|هلا|السلام\s*عليكم|سلام\s*عليكم|صباح\s*الخير|مساء\s*الخير|مساء الخير|صباح الخير)$/i.test(q)
  ) {
    return true;
  }
  // "السلام عليكم ورحمة الله" etc.
  if (/^السلام\s*عليكم/.test(q) && q.length <= 40) return true;
  if (/^(good\s*morning|good\s*evening|good\s*afternoon)$/i.test(lower)) return true;
  return false;
}

function isSmallTalk(q: string): boolean {
  const lower = q.toLowerCase();
  if (
    /^(شكراً?|شكراً\s*لك|thank\s*you|thanks|thx|ممتاز|رائع|جميل|تمام|حسناً?|حسنا|طيب|أوكي|اوكي|ok|okay|great|nice|cool|awesome|عفواً?|العفو|ماشي|يسلمو|يسلموا|الله\s*يعطيك\s*العافية)$/i.test(
      q,
    )
  ) {
    return true;
  }
  // How are you — must not fall through to teaching ("كيف…")
  if (/كيف\s*حالك/.test(q) && q.length <= 24) return true;
  if (/^how\s*are\s*you\b/.test(lower) && lower.split(/\s+/).length <= 5) return true;
  if (/^(الحمد\s*لله|بخير|منيح|كويس|fine|i'?m\s*good|doing\s*well)$/i.test(q)) return true;
  return false;
}

/**
 * Subjects Iqraa does not answer at all — news, politics, sport, markets,
 * entertainment, travel, health, and the rest of the open web.
 *
 * A general question used to fall through `isTeaching` (any message ending in
 * "؟" counted as teaching), so "ما أخبار الحرب في إيران؟" entered the teaching
 * pipeline and came back as a curriculum answer about something adjacent. It
 * has to be caught here, before that.
 */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  // News, politics, conflict
  /أخبار|اخبار|الحرب|حرب\s|حرب$|سياسة|سياسي|انتخابات|الرئيس(?![ء-ي])|رئيس\s*الوزراء|حكومة|برلمان|قصف|عسكري|جيش|صواريخ|هدنة|احتلال|إيران|ايران|غزة|أوكرانيا|اوكرانيا|روسيا|إسرائيل|اسرائيل/i,
  /\bnews\b|\bwar\b|\bpolitic|\belection|\bpresident\b|\bceasefire\b|\bmilitary\b|\bmissile|\biran\b|\bgaza\b|\bukraine\b/i,
  // Sport
  /كرة\s*القدم|كرة\s*السلة|مباراة|المباراة|الدوري\s*(الإنجليزي|الاسباني|الإسباني|الأردني)|ريال\s*مدريد|برشلونة|منتخب|بطولة\s*العالم|كأس\s*العالم/i,
  /\bfootball\b|\bsoccer\b|\bbasketball\b|\bworld\s*cup\b|\bpremier\s*league\b|\bnba\b/i,
  // Markets, money, crypto
  /سعر\s*(الدولار|الذهب|صرف)|أسعار\s*(العملات|النفط|الذهب)|البورصة|الأسهم|العملات\s*الرقمية|بيتكوين|عملة\s*رقمية/i,
  /\bstock\s*market\b|\bbitcoin\b|\bcrypto|\bexchange\s*rate\b|\bgold\s*price\b|\boil\s*price/i,
  // Weather
  /حالة\s*الطقس|الطقس\s*(اليوم|غداً|غدا)|توقعات\s*الطقس/i,
  /\bweather\b|\bforecast\b/i,
  // Entertainment, celebrities, jokes
  /فيلم|أفلام|مسلسل|مسلسلات|أغنية|اغنية|أغاني|ممثل|ممثلة|مغني|مشاهير|نكتة|نكت/i,
  /\bmovie|\bfilm\b|\btv\s*show|\bnetflix\b|\bcelebrit|\bsong\b|\bjoke\b/i,
  // Travel, shopping, food
  /حجز\s*(طيران|تذاكر|فندق)|تذاكر\s*طيران|فيزا|تأشيرة|مطعم|وصفة\s*(طبخ|أكل)|طبخة|أفضل\s*مطعم/i,
  /\bflight\b|\bhotel\b|\bvisa\b|\brestaurant\b|\brecipe\b|\bcook(ing)?\b/i,
  // Personal health / medical advice
  /علاج\s*(مرض|ألم)|دواء|أعراض\s*مرض|طبيب|وصفة\s*طبية/i,
  /\bmedicine\b|\bsymptoms?\b|\bdoctor\b|\bdiagnos/i,
];

/**
 * Curriculum / classroom markers. Any one of them means the message is teaching
 * work that merely *mentions* an outside subject — "أنشئ مسألة إحصاء عن أسعار
 * الذهب" is a statistics worksheet, not a markets question — so the off-topic
 * patterns above must not claim it.
 */
const TEACHING_SIGNAL =
  /منهج|درس|دروس|حصة|الصف|صف\s*عاشر|طلاب|طالب|طالبة|تلاميذ|خطة|ورقة\s*عمل|اختبار|امتحان|واجب|نشاط|تقييم|اشرح|أشرح|شرح|وضّح|وضح|مثال|مسألة|تمرين|سؤال\s*عن|رياضيات|كيمياء|معادلة|اقتران|اقترانات|مشتقة|المشتقات|متجه|متجهات|احتمال|إحصاء|احصاء|مثلثات|دائرة|الأسس|لوغاريتم|ذرة|الذرة|جدول\s*دوري|رابطة|تكافؤ|مول|تفاعل/i;

const TEACHING_SIGNAL_EN =
  /\blesson\b|\bteach|\bstudent|\bclassroom\b|\bcurriculum\b|\bworksheet\b|\bquiz\b|\bexam\b|\bhomework\b|\bactivity\b|\bexplain\b|\bexample\b|\bexercise\b|\bgrade\s*10\b|\bmath|\bchemistr|\bequation\b|\bfunction\b|\bderivative\b|\bvector\b|\bprobabilit|\bstatistic|\btrigonometr|\batom|\bbond(ing)?\b|\bmole\b/i;

function isOffTopic(q: string): boolean {
  if (TEACHING_SIGNAL.test(q) || TEACHING_SIGNAL_EN.test(q)) return false;
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(q));
}

function isRefinement(q: string): boolean {
  return (
    /اجعله\s*أبسط|أجعله\s*أبسط|ابسطه|أبسطه|بسّ?طه|اختصره|اختصار|أضف\s*مثالاً?|اضف\s*مثال|أضف\s*سؤال|اضف\s*سؤال|اجعله\s*أصعب|أجعله\s*أصعب|أصعب|اسهل|أسهل|للطلاب\s*الضعفاء|للطلاب\s*المتفوقين|للضعفاء|للمتفوقين|أكثر\s*تفصيلاً?|اقل\s*تفصيلاً?|نفس\s*(الخطة|الورقة|الاختبار|الواجب)|عدّل|عدل|حسّن|حسن|simplify|make\s*it\s*simpler|make\s*it\s*easier|make\s*it\s*harder|add\s*an?\s*example|add\s*\d*\s*questions?|shorten\s*it|for\s*struggling|for\s*advanced|too\s*long|too\s*short|another\s*quiz|same\s*lesson\s*plan/i.test(
      q,
    )
  );
}

function isArtifact(q: string): boolean {
  // Verb + artifact noun (e.g. "أنشئ خطة", "حضّر اختبار")
  if (
    /أنشئ|انشئ|ولّد|ولد|اعمل|أعمل|جهز|جهّز|حضّر|حضر|أعد|اعد|إعداد|اعداد|create|generate|make\s+(a|me)|build|prepare/i.test(q)
    && /خطة|ورقة|اختبار|نشاط|واجب|lesson\s*plan|worksheet|quiz|activity|homework/i.test(q)
  ) {
    return true;
  }
  // Full phrases anywhere in the message
  if (/خطة\s*درس|ورقة\s*عمل|اختبار\s*قصير|نشاط\s*صفي|واجب\s*منزلي|lesson\s*plan|classroom\s*activity/i.test(q)) {
    return true;
  }
  // Bare / short artifact shortcuts teachers tap or type (e.g. "خطة", "إعداد اختبار")
  if (
    /^(إعداد\s*)?(خطة(\s*درس)?|ورقة(\s*عمل)?|اختبار(\s*قصير)?|نشاط(\s*صفي)?|واجب(\s*منزلي)?|lesson(\s*plan)?|worksheet|quiz|homework|activity)$/i.test(
      q,
    )
  ) {
    return true;
  }
  return false;
}

function isTeaching(q: string): boolean {
  return (
    /شرح|كيف\s*أبسط|كيف\s*ابسط|ما\s*هو|ما\s*هي|ما\s*معنى|أعطني\s*مثالاً?|اعطني\s*مثال|وضح|وضّح|explain|concept|what\s+is|what\s+are|how\s+(do|can|to)\s+i\s+(explain|teach|simplify)|give\s+me\s+an?\s+example|help\s+me\s+(explain|teach)/i.test(
      q,
    )
    || (/[؟?]/.test(q) && !isGreeting(q) && !isSmallTalk(normalizeQuery(q)))
  );
}

/** The one list of what Iqraa does — greeting and off-topic must not drift apart. */
function capabilityLines(isAr: boolean): string[] {
  return isAr
    ? [
        '• شرح مفهوم لطلابك',
        '• تحضير خطة درس',
        '• إعداد ورقة عمل',
        '• بناء اختبار قصير',
        '• تصميم نشاط صفي',
      ]
    : [
        '• Explaining concepts',
        '• Preparing a lesson plan',
        '• Creating a worksheet',
        '• Building a quiz',
        '• Designing a classroom activity',
      ];
}

function greetingReply(isAr: boolean): string {
  if (isAr) {
    return [
      'أهلاً بك 👋',
      '',
      'أنا اقرأ، رفيقك في تحضير الحصص.',
      '',
      'أستطيع أن أساعدك في:',
      ...capabilityLines(true),
      '',
      'من أين نبدأ اليوم؟',
    ].join('\n');
  }
  return [
    'Welcome 👋',
    '',
    "I'm IQRA, your smart assistant for lesson preparation.",
    '',
    'I can help you with:',
    ...capabilityLines(false),
    '',
    'What would you like to start with today?',
  ].join('\n');
}

function offTopicReply(isAr: boolean): string {
  if (isAr) {
    return [
      'أنا اقرأ، مساعد تدريس مختص بالمنهج الوطني الأردني — رياضيات وكيمياء الصف العاشر.',
      'هذا السؤال خارج مجال عملي، فلا أتابع الأخبار أو المواضيع العامة.',
      '',
      'لكن يسعدني مساعدتك في:',
      ...capabilityLines(true),
      '',
      'بماذا نبدأ؟',
    ].join('\n');
  }
  return [
    "I'm IQRA, a teaching assistant for the Jordanian national curriculum — Grade 10 Maths and Chemistry.",
    "That question is outside what I do, so I don't cover news or general topics.",
    '',
    'I would be glad to help you with:',
    ...capabilityLines(false),
    '',
    'What shall we start with?',
  ].join('\n');
}

function smallTalkReply(q: string, isAr: boolean): string {
  if (/شكرا|thank|thanks|thx/i.test(q)) {
    return isAr
      ? 'العفو 🌿 أنا معك متى احتجت مساعدة في تحضير حصتك.'
      : "You're welcome 🌿 I'm here whenever you need help preparing your lesson.";
  }
  if (/ممتاز|رائع|جميل|great|nice|awesome|cool/i.test(q)) {
    return isAr
      ? 'يسعدني ذلك 🌿 نكمل تحضير الحصة، أم ننتقل إلى شيء آخر؟'
      : 'Glad to hear it. Shall we continue preparing the lesson, or something else?';
  }
  if (/كيف\s*حالك|how\s*are\s*you/i.test(q)) {
    return isAr
      ? 'بخير والحمد لله 🌿 جاهز لمساعدتك في دروسك متى شئت.\nمن أين نبدأ؟'
      : "I'm doing well, thanks 🌿 Ready to help with your lessons whenever you like.\nWhat shall we start with?";
  }
  if (/تمام|حسنا|طيب|ok|okay|ماشي/i.test(q)) {
    return isAr
      ? 'تمام. اكتب ما تحتاجه: شرح، خطة درس، ورقة عمل، أو نشاط صفي.'
      : 'Got it. Tell me what you need: an explanation, lesson plan, worksheet, or activity?';
  }
  return isAr
    ? 'أنا معك — اكتب ما تحتاجه متى شئت.'
    : "I'm with you — tell me what you need whenever you're ready.";
}

function ambiguousReply(isAr: boolean): string {
  return isAr
    ? 'وضّح لي أكثر: هل تريد شرح مفهوم، أم تحضير مادة (خطة درس / ورقة عمل / اختبار)؟'
    : 'So I can help precisely: do you want a concept explanation, or a teaching material (plan / worksheet / quiz)?';
}

/**
 * Classify an incoming chat message before any curriculum context is applied.
 *
 * `afterClarify` is what keeps the clarify path from becoming a dead end. The
 * question it asks ("شرح مفهوم، أم خطة درس؟") is answered in the teacher's own
 * words, and no keyword list covers all of them — so when an answer still does
 * not classify, the second turn goes to the teaching pipeline rather than
 * repeating the identical question at someone who already answered it.
 */
export function classifyChatIntent(
  query: string,
  lang: 'ar' | 'en' = 'ar',
  afterClarify = false,
): IntentRouteResult {
  const isAr = lang === 'ar';
  const q = normalizeQuery(query);
  const clarify = (): IntentRouteResult =>
    afterClarify
      ? { intent: 'teaching', useTeachingPipeline: true }
      : {
          intent: 'ambiguous',
          useTeachingPipeline: false,
          socialReply: ambiguousReply(isAr),
        };
  if (!q) {
    return {
      intent: 'ambiguous',
      useTeachingPipeline: false,
      socialReply: ambiguousReply(isAr),
    };
  }

  // Priority: social intents first — never enter teaching pipeline
  if (isGreeting(q)) {
    return {
      intent: 'greeting',
      useTeachingPipeline: false,
      socialReply: greetingReply(isAr),
    };
  }
  if (isSmallTalk(q)) {
    return {
      intent: 'small_talk',
      useTeachingPipeline: false,
      socialReply: smallTalkReply(q, isAr),
    };
  }

  // Off-topic subjects — answered with what Iqraa *is* for, never generated over.
  // Checked before the teaching heuristics because those treat any question mark
  // as a teaching ask.
  if (isOffTopic(q)) {
    return {
      intent: 'off_topic',
      useTeachingPipeline: false,
      socialReply: offTopicReply(isAr),
    };
  }

  // Refinement / artifact / teaching — Teaching Assistant may use lesson context
  if (isRefinement(q)) {
    return { intent: 'refinement', useTeachingPipeline: true };
  }
  if (isArtifact(q)) {
    return { intent: 'artifact', useTeachingPipeline: true };
  }
  if (isTeaching(q)) {
    return { intent: 'teaching', useTeachingPipeline: true };
  }

  // Short unknown tokens → clarify, don't invent a lesson
  const words = q.split(/\s+/);
  if (words.length <= 2 && q.length <= 18) {
    return clarify();
  }

  // Longer substantive text without clear markers — treat as teaching topic ask
  if (words.length >= 3) {
    return { intent: 'teaching', useTeachingPipeline: true };
  }

  return clarify();
}
