/**
 * Intent Router — classifies chat messages BEFORE curriculum / Teaching Assistant.
 * Demo Mode only; fully local. Greetings & small talk never trigger lesson generation.
 */

export type ChatRouteIntent =
  | 'greeting'
  | 'small_talk'
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

function greetingReply(isAr: boolean): string {
  if (isAr) {
    return [
      'أهلاً بك 👋',
      '',
      'أنا اقرأ، رفيقك في تحضير الحصص.',
      '',
      'أستطيع أن أساعدك في:',
      '• شرح مفهوم لطلابك',
      '• تحضير خطة درس',
      '• إعداد ورقة عمل',
      '• بناء أداة تقييم',
      '• تصميم نشاط صفي',
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
    '• Explaining concepts',
    '• Preparing a lesson plan',
    '• Creating a worksheet',
    '• Building a quiz',
    '• Designing a classroom activity',
    '',
    'What would you like to start with today?',
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
