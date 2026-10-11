/**
 * "Where do I find X?" — answered from the app's own map, not the model.
 *
 * Those questions used to enter the teaching pipeline and come back as a
 * curriculum answer about whatever lesson was on the card. They are answered
 * here, locally: no AI cost, works in demo mode, and it cannot name a screen
 * that does not exist, because every place below is a real route.
 *
 * Tools come from the shared catalog, so a tool added there is findable here
 * without an edit. The screens that live under Profile are listed by hand —
 * nothing else enumerates them.
 *
 * Pure TypeScript (the catalog's only runtime import is data), so `node --test`
 * can run it.
 */
import { WORKFLOW } from './toolCatalog.ts';
import { normalize } from './commandPalette.ts';

export type AppPlace = {
  id: string;
  route: string;
  /** i18n key of the place's own name. */
  labelKey: string;
  /** i18n keys of where it sits, outermost first: tab, then section. */
  pathKeys: string[];
  /** True for generators — opening one should carry the current lesson. */
  isTool: boolean;
  /** Normalised words that point at this place. */
  keywords: string[];
  routeParams?: Record<string, string>;
  /** i18n key of the steps to give when the question is "how do I…", not "where is…". */
  howKey?: string;
};

/** Extra words per catalog tool id; the tool's id is always a keyword too. */
const TOOL_KEYWORDS: Record<string, string[]> = {
  slides: ['عرض', 'شرائح', 'بوربوينت', 'باوربوينت', 'بريزنتيشن', 'slides', 'presentation', 'deck'],
  'lesson-plan': ['خطه درس', 'تحضير', 'تحضير درس', 'lesson plan'],
  worksheet: ['ورقه عمل', 'اوراق عمل', 'worksheet'],
  classroom: ['تحدي', 'تحديات', 'غرفه الهروب', 'بنغو', 'escape', 'bingo'],
  game: ['لعبه', 'مسابقه', 'مسابقات', 'game', 'quiz game'],
  activity: ['نشاط', 'انشطه', 'activity'],
  games: ['العاب', 'ألعاب', 'games', 'play'],
  quiz: ['اختبار قصير', 'كويز', 'quiz'],
  evaluations: ['اختبارات', 'امتحان', 'امتحانات', 'تقييم', 'تقييمات', 'علامات', 'نتائج', 'exam', 'test', 'tests', 'grades', 'results'],
  'parent-msg': ['رساله ولي امر', 'رساله للاهل', 'parent message'],
};

/** Screens reached from Profile or a tab, which no catalog lists. */
const SCREENS: AppPlace[] = [
  {
    id: 'classes', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    // «clases» is the typo that actually got typed.
    keywords: ['شعب', 'شعبه', 'شعبي', 'شعبتي', 'طلابي', 'طلبتي', 'رمز الانضمام', 'classes', 'clases', 'my class', 'add class', 'add a class', 'new class', 'another class', 'extra class', 'students'],
    howKey: 'howAddClass',
  },
  {
    id: 'subjects', route: '/setup-subjects', routeParams: { mode: 'edit' }, labelKey: 'mySubjects', pathKeys: ['tabProfile'], isTool: false,
    // No bare «grade» / «صف»: they sit inside every «grade 10 quiz» and «للصف العاشر».
    keywords: ['الصفوف', 'صفوفي', 'مواد ادرسها', 'المواد التي ادرسها', 'اضافه صف', 'اضيف صف', 'صف جديد', 'add grade', 'add a grade', 'new grade', 'another grade', 'add subject', 'add a subject', 'another subject', 'subjects i teach', 'اضافه ماده', 'اضيف ماده'],
    howKey: 'howAddGrade',
  },
  // The FAQ's own answers, reachable from the chat. They have no screen of
  // their own, so the button opens the FAQ.
  {
    id: 'start-class', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['ابدا الحصه', 'بدء الحصه', 'شاشه العرض', 'start class', 'start the class', 'projector'],
    howKey: 'faqA7',
  },
  {
    id: 'change-lesson', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['تغيير الدرس', 'تغير الدرس', 'اغير الدرس', 'change lesson', 'change the lesson', 'switch lesson'],
    howKey: 'faqA2',
  },
  {
    id: 'export', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['تصدير', 'اصدر', 'pdf', 'export'],
    howKey: 'faqA4',
  },
  {
    id: 'teaching-plans', route: '/teaching-plans', labelKey: 'myTeachingPlans', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['خطط التدريس', 'خطه فصليه', 'الخطه الفصليه', 'teaching plan', 'pacing'],
  },
  {
    id: 'schedule', route: '/schedule', labelKey: 'myWeeklySchedule', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['جدول', 'الجدول', 'جدول الحصص', 'schedule', 'timetable'],
  },
  {
    id: 'calendar', route: '/calendar', labelKey: 'myCalendar', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['تقويم', 'التقويم', 'calendar'],
  },
  {
    id: 'workspace', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['محفوظ', 'المحفوظه', 'المحفوظات', 'موادي', 'ملفاتي', 'مساحه العمل', 'saved', 'workspace', 'my materials', 'saved materials', 'saved material', 'مواد محفوظه', 'ملفات محفوظه'],
  },
  {
    id: 'settings', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['اعدادات', 'الاعدادات', 'اللغه', 'الوضع الليلي', 'الوضع الداكن', 'settings', 'language', 'dark mode'],
  },
  {
    id: 'faq', route: '/faq', labelKey: 'faqTitle', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['مساعده', 'الاسئله الشائعه', 'اسئله شائعه', 'help', 'faq'],
  },
  {
    id: 'profile', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    keywords: ['حسابي', 'الحساب', 'الملف الشخصي', 'تسجيل الخروج', 'account', 'profile', 'sign out', 'log out'],
  },
  {
    id: 'curriculum', route: '/curriculum/browse', labelKey: 'tabCurriculum', pathKeys: [], isTool: false,
    keywords: ['المنهاج', 'المنهج', 'الكتب', 'الكتاب المدرسي', 'الدروس', 'curriculum', 'textbook', 'books'],
  },
  {
    id: 'notifications', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false,
    keywords: ['رسائل', 'الرسائل', 'تنبيهات', 'اشعارات', 'الاشعارات', 'اولياء الامور', 'messages', 'notifications', 'inbox'],
  },
  {
    id: 'tools', route: '/ai-tools', labelKey: 'tabTools', pathKeys: [], isTool: false,
    keywords: ['الادوات', 'ادوات', 'tools'],
  },
];

function toolPlaces(): AppPlace[] {
  const out: AppPlace[] = [];
  for (const section of WORKFLOW) {
    for (const tool of section.tools) {
      if (!tool.route) continue;
      out.push({
        id: `tool:${tool.id}`,
        route: tool.route,
        routeParams: tool.routeParams,
        labelKey: tool.titleKey,
        pathKeys: ['tabTools', section.titleKey],
        isTool: true,
        keywords: [tool.id, ...(TOOL_KEYWORDS[tool.id] ?? [])],
      });
    }
  }
  return out;
}

/**
 * Normalised, punctuation-free, and with «ال» dropped from every word, on both
 * sides of the match — so «ورقة العمل» finds «ورقه عمل» and «الاختبار القصير»
 * finds «اختبار قصير» without listing each article-bearing spelling.
 */
function matchForm(s: string): string {
  return normalize(s.replace(/[؟?!.,،]/g, ' ')).replace(/(^|\s)ال(?=\S{2,})/g, '$1');
}

export const APP_PLACES: AppPlace[] = [
  ...toolPlaces(),
  ...SCREENS,
].map(p => ({ ...p, keywords: p.keywords.map(matchForm) }));

const WHERE_PATTERN =
  /(^|\s)(وين|وينه|وينها|اين|فين|من وين)(\s|$)|كيف\s*(ا|ن)?(لاقي|لقي|جد|وصل|فتح|روح)|where\s+(?:is|are|can|do|to|(?:i|we)\s+(?:can|could|should|do|would)|should\s+(?:i|we))\b|how\s+(do|can)\s+i\s+(find|open|get\s+to|reach|access)/i;

/**
 * "How do I add / export / start…" — written against `normalize()` output (hamza
 * folded, ة → ه), so «أضيف» is «اضيف». Like WHERE_PATTERN it claims nothing alone:
 * «كيف أجمع الكسور» and «how to add fractions» name no place and stay teaching.
 *
 * «can I add …», «is there a way to add …» and «ممكن اضيف …» are the yes/no
 * forms of the same question, so only the first person and only the verbs that
 * act on the account («create» and «make» are left out, and so is «انشئ», which
 * reads the same as the imperative: «can we create a quiz on fractions» and
 * «ممكن انشئ اختبار» ask the assistant to make one).
 */
const HOW_PATTERN =
  /(كيف|طريقه|خطوات)\s*(يمكنني\s*|ممكن\s*)?((ا|ن)?(ضيف|ضف|ضافه|نشي|نشئ|نشاء|عمل|غير|عدل|حذف|صدر|حفظ|بدا|شارك|ربط|دعو|ستخدم)|تغيير|تعديل|تصدير|بدء)|\bhow\s+(?:(?:do|can|should)\s+(?:i|we)\s+)?(?:to\s+)?(?:add|create|make|change|edit|delete|remove|export|save|share|start|use|link|invite)\b|\bcan\s+i\s+(?:add|change|edit|delete|remove|export|save|share|link|invite)\b|\b(?:is\s+there\s+(?:a|any|some)\s+way|is\s+it\s+possible|any\s+way)\s+to\s+(?:add|change|edit|delete|remove|export|save|share|link|invite)\b|(?:^|\s)(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?(?:اضيف|اضافه|اغير|اعدل|احذف|اصدر|احفظ|اشارك|اربط|ادعو)(?:\s|$)/i;

/**
 * A plain statement that adds to the account's own lists: «add more classes to
 * my account», «i want to add another class», «بدي اضيف شعبة». It names no
 * where/how word, so unlike the patterns above it is trusted alone, which is why
 * it is this narrow: classes, and grades or subjects, only with a determiner
 * that makes the object a new one («add a grade» alone could be a mark), and
 * only when the object ends the message (bar «to my account» and «please»).
 * «add a class of compounds to the table» and «add a class activity on
 * fractions» fail the anchor and stay teaching. Written against `normalize()`
 * output, as the patterns above are.
 */
const EN_INTENT = String.raw`(?:(?:please|pls|plz)\s+)?(?:(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+`;
const EN_LEAD = String.raw`^(?:(?:please|pls|plz)\s+)?(?:(?:(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+)?`;
/** What may follow the object: a grade, a name or a count for the new class, then «to my account», then «please». */
const EN_QUAL = String.raw`(?:\s+(?:for|in)\s+(?:my\s+)?(?:grade|class|section|year)\s+\d{1,2}[a-z]?|\s+(?:called|named)\s+[a-z0-9]+(?:\s+[a-z0-9]+)?|\s+with\s+\d{1,3}\s+students)?`;
const EN_TAIL = EN_QUAL + String.raw`(?:\s+(?:to|in|into|on)\s+(?:my|the)\s+(?:account|profile|app|list))?(?:\s+(?:please|pls|plz|too|now|here|as\s+well))*$`;
const EN_ADD_TO_ACCOUNT = new RegExp(
  `${EN_LEAD}(?:add|register|set\\s*up)\\s+(?:` +
    String.raw`(?:(?:an?|another|one\s+more|more|new|extra|my|some)\s+)*class(?:es)?(?:\s+\d{1,2}[a-z]?)?` +
    String.raw`|(?:another|more|new|extra|one\s+more)\s+(?:grades?|subjects?)` +
    String.raw`|grades?\s+\d{1,2}` +
  `)${EN_TAIL}`,
);
/**
 * A bare «grade» or «subject» is ambiguous («add a grade» may be a mark), so it
 * needs first-person intent, or «to my account / profile», to be an account add.
 */
const EN_ADD_BARE_GRADE = new RegExp(
  `^${EN_INTENT}(?:add|register|set\\s*up)\\s+(?:(?:an?|another|more|new)\\s+)?(?:grades?|subjects?)${EN_TAIL}`,
);
const EN_ADD_GRADE_TO_MY = new RegExp(
  String.raw`^(?:(?:please|pls|plz)\s+)?add\s+(?:(?:an?|another|more|new)\s+)?(?:grades?|subjects?)\s+(?:to|in|into)\s+my\s+(?:account|profile|list|teaching|grades|subjects|classes)(?:\s+(?:please|pls|plz|too|now))*$`,
);
const AR_INTENT = String.raw`(?:ا?ريد|بدي|ابغي|ابي|ودي|احتاج|محتاج|لازم|عاوز|عايز|حابب|حابه)\s+(?:ان\s+)?`;
const AR_QUAL = String.raw`(?:جديده|جديد|اخري|اخر|اضافيه|اضافي|ثاني|ثانيه|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|\d{1,2})`;
const AR_TAIL =
  String.raw`(?:\s+(?:للصف|لصف|في\s+الصف)\s+\S+)?(?:\s+(?:باسم|اسمها|اسمه)\s+\S+(?:\s+\S+)?)?` +
  String.raw`(?:\s+(?:لي|من\s+فضلك|لو\s+سمحت|الي\s+حسابي|الي\s+التطبيق|في\s+حسابي|في\s+التطبيق))*$`;
const AR_ADD_VERB = String.raw`(?:اضيف|اضافه|اضف|اسجل|تسجيل|سجل)\s+`;
const AR_ADD_TO_ACCOUNT = new RegExp(
  `^(?:${AR_INTENT})?${AR_ADD_VERB}` +
    String.raw`(?:(?:شعبه|شعب)(?:\s+${AR_QUAL})*|(?:صف|صفوف)(?:\s+${AR_QUAL})+)` +
    AR_TAIL,
);
/** «صف» and «مادة» bare are ambiguous too («اضف صفا» is a row): first-person intent required. */
const AR_ADD_BARE_GRADE = new RegExp(
  `^${AR_INTENT}${AR_ADD_VERB}(?:صف|صفوف|ماده|مواد)(?:\\s+${AR_QUAL})*${AR_TAIL}`,
);
const isAddToAccount = (plainQuery: string) =>
  EN_ADD_TO_ACCOUNT.test(plainQuery) || EN_ADD_BARE_GRADE.test(plainQuery) || EN_ADD_GRADE_TO_MY.test(plainQuery) ||
  AR_ADD_TO_ACCOUNT.test(plainQuery) || AR_ADD_BARE_GRADE.test(plainQuery);

/**
 * «i want to change the language», «بدي افتح الاعدادات»: first-person intent, a
 * verb, an optional «my / the», then exactly the name of a screen and nothing
 * else — so «i want to change the lesson to be shorter» and «i want to find the
 * best game for students» stay teaching. Built from the places' own keywords so
 * a screen added there is covered here. A generator's name counts only after
 * «export / تصدير», which is a question about the app whatever it exports.
 * Written against `matchForm()` output, which also drops «ال».
 */
type ScreenPatterns = { en: RegExp; ar: RegExp; enProblem: RegExp[]; arProblem: RegExp };
let screenPatterns: ScreenPatterns | null = null;
function buildScreenPatterns(): ScreenPatterns {
  if (screenPatterns) return screenPatterns;
  const esc = (kw: string) => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const alt = (list: string[]) => [...new Set(list)].sort((a, b) => b.length - a.length).map(esc).join('|');
  const latin = (kw: string) => /^[\x00-\x7F]+$/.test(kw);
  const screens = APP_PLACES.filter(p => !p.isTool).flatMap(p => p.keywords);
  const tools = APP_PLACES.filter(p => p.isTool).flatMap(p => p.keywords);
  const enScreens = alt(screens.filter(latin));
  const arScreens = alt(screens.filter(k => !latin(k)));
  const verbBearing = /^(?:change|start|switch|تغيير|تغير|اغير|بدء|ابدا)(?:\s|$)/;
  const tail = String.raw`(?:\s+(?:please|pls|plz|now|today))*$`;
  const enDet = String.raw`(?:(?:my|the|a|an|our|your|all|some)\s+)?`;
  const enVerb = String.raw`(?:change|edit|open|see|view|find|go\s+to|delete|remove|link|invite|switch|start)`;
  const arVerb = String.raw`(?:اغير|اعدل|افتح|اشوف|اشاهد|اري|الاقي|احذف|اربط|ادعو|ابدا)`;
  const en = new RegExp(
    `^${EN_INTENT}(?:` +
      `${enVerb}\\s+${enDet}(?:${enScreens})` +
      `|(?:${alt(screens.filter(k => latin(k) && verbBearing.test(k)))})` +
      `|export\\s+${enDet}(?:${alt([...screens, ...tools].filter(latin))})` +
    `)${tail}`,
  );
  const ar = new RegExp(
    `^${AR_INTENT}(?:` +
      `${arVerb}\\s+(?:${arScreens})` +
      `|(?:${alt(screens.filter(k => !latin(k) && verbBearing.test(k)))})` +
      `|(?:تصدير|اصدر)\\s+(?:${alt([...screens, ...tools].filter(k => !latin(k)))})` +
    `)${tail}`,
  );
  // Problems: the same anchor, so «i can't find the settings of the equation» is
  // not «i can't find settings». Screens only: a generator's name never counts.
  const enNeg = String.raw`(?:i|we)\s+(?:am\s+|are\s+)?(?:can['’]?t|cannot|can\s+not|couldn['’]?t|could\s+not|unable\s+to|not\s+able\s+to|don['’]?t|do\s+not|didn['’]?t|did\s+not)\s+(?:seem\s+to\s+)?`;
  const enSubject = String.raw`(?:(?:my|the|all\s+my|all\s+the)\s+)?`;
  const enProblem = [
    // «i can't find my classes», «i can't add a class» (the keyword carries its own «add»)
    new RegExp(`^${enNeg}(?:(?:find|see|open|reach|access|get\\s+to|locate)\\s+${enDet})?(?:${enScreens})(?:\\s+(?:anymore|anywhere|now|again))*$`),
    // «my classes are missing», «my class list is empty»
    new RegExp(`^${enSubject}(?:${enScreens})(?:\\s+list)?\\s+(?:is|are)\\s+(?:missing|gone|empty|not\\s+(?:showing|there|appearing|visible)|disappeared)(?:\\s+(?:now|again|too))*$`),
    // «where did my classes go»
    new RegExp(`^where\\s+(?:did|has|have)\\s+${enSubject}(?:${enScreens})\\s+(?:go|gone|went|disappear(?:ed)?)$`),
  ];
  const arProblem = new RegExp(
    String.raw`^(?:(?:ما|مو|مش|لم|لن)\s*(?:ب)?(?:لقيت|لاقي|الاقي|اجد|شفت|اشوف|اري)\s+(?:${arScreens})(?:\s+(?:بعد|الان|ابدا))*` +
      String.raw`|(?:اختفت|اختفي|ضاعت|راحت)\s+(?:${arScreens})` +
      String.raw`|(?:${arScreens})\s+(?:اختفت|ضاعت|راحت|مفقوده|فاضيه|فارغه))$`,
  );
  screenPatterns = { en, ar, enProblem, arProblem };
  return screenPatterns;
}
const isScreenStatement = (query: string) => {
  const q = matchForm(query);
  const { en, ar } = buildScreenPatterns();
  return en.test(q) || ar.test(q);
};
/** A problem with adding gets the add steps, not the path to the screen. */
const PROBLEM_ADDING = /\b(?:add|create)\b|(?:^|\s)(?:اضيف|اضافه|انشي)(?:\s|$)/;
const isProblemWithScreen = (query: string) => {
  const q = matchForm(query);
  const { enProblem, arProblem } = buildScreenPatterns();
  return enProblem.some(re => re.test(q)) || arProblem.test(q);
};

/**
 * «class of compounds», «class activity», «class quiz» say «class» in the other
 * sense. Dropped before the keywords are matched, so «where can i find classes of
 * compounds» no longer finds My classes — the word after it still counts, so «the
 * class activity» still finds the activity generator.
 */
const NOT_A_SCHOOL_CLASS = /\bclass(?:es)?(?=\s+(?:of|activity|activities|quiz|quizzes|test|exam|worksheet)\b)/g;

/** A word that says the question is about the app, even when no place matched. */
const APP_NOUN = /تطبيق|البرنامج|صفحه|قسم|تبويب|زر|قائمه|\bapp\b|\bpage\b|\bscreen\b|\btab\b|\bbutton\b|\bmenu\b/i;

/**
 * Places the question names, best first, at most `limit`. A keyword counts
 * only as whole words — «جدول» must not claim «الجدول الدوري» on a chemistry
 * question, so multi-word keywords win over their single-word prefixes.
 */
export function findAppPlaces(query: string, limit = 3): AppPlace[] {
  const q = ` ${matchForm(query).replace(NOT_A_SCHOOL_CLASS, ' ')} `;
  const scored: { place: AppPlace; score: number }[] = [];
  for (const place of APP_PLACES) {
    let best = 0;
    for (const kw of place.keywords) {
      if (q.includes(` ${kw} `)) best = Math.max(best, kw.length);
    }
    if (best > 0) scored.push({ place, score: best });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.place);
}

const plain = (query: string) => normalize(query.replace(/[؟?!.,،]/g, ' '));

/** "How do I…" rather than "where is…" — the answer is steps, not a path. */
export function isHowQuery(query: string): boolean {
  const q = plain(query);
  // «add more classes to my account» is a «how do I» in disguise: it gets the steps.
  // So is «i can't add a class», and a statement about a screen gets that screen's
  // steps when it has any (answerAppHelp falls back to the path when it has none).
  return HOW_PATTERN.test(q) || isAddToAccount(q) || (isProblemWithScreen(q) && PROBLEM_ADDING.test(q)) || isScreenStatement(query);
}

/**
 * True when the teacher is asking where something is in the app, or how to do
 * something in it. Needs both a "where / how do I" phrase and something
 * app-shaped — «أين تقع البتراء؟» is a geography question and must stay one.
 */
export function isAppHelpQuery(query: string): boolean {
  const q = plain(query);
  if (isAddToAccount(q) || isProblemWithScreen(q) || isScreenStatement(query)) return true;
  if (!WHERE_PATTERN.test(q) && !HOW_PATTERN.test(q)) return false;
  return findAppPlaces(q, 1).length > 0 || APP_NOUN.test(q);
}

export type AppHelpAnswer = { text: string; places: AppPlace[] };

/** The reply text and the places to offer as buttons. */
export function answerAppHelp(
  query: string,
  lang: 'ar' | 'en',
  t: (key: string) => string,
): AppHelpAnswer {
  const isAr = lang === 'ar';
  const places = findAppPlaces(query);
  if (!places.length) {
    const faq = APP_PLACES.find(p => p.id === 'faq')!;
    return {
      text: isAr
        ? 'لم أعرف أي قسم تقصد. تجد شرحًا لأقسام التطبيق في «الأسئلة الشائعة» داخل الملف الشخصي، أو اكتب لي اسم ما تبحث عنه.'
        : "I couldn't tell which part you mean. The FAQ under Profile explains each part of the app, or tell me the name of what you're looking for.",
      places: [faq],
    };
  }
  // A how-to gets the steps of the best match when it has them, with the
  // button to open it; otherwise it falls through to the path listing.
  // «how do I export my lesson plan» names a generator first and the export
  // screen second: the steps asked for are the export's, so it is the one place
  // allowed to answer from behind another.
  const how = isHowQuery(query)
    ? places[0]!.howKey ?? places.find(p => p.id === 'export')?.howKey
    : undefined;
  if (how) return { text: t(how), places: [places[0]!] };
  const sep = isAr ? ' ← ' : ' → ';
  const lines = places.map(p => {
    const where = [...p.pathKeys, p.labelKey].map(t).join(sep);
    return `• **${t(p.labelKey)}**: ${where}`;
  });
  return {
    text: [isAr ? 'تجده هنا:' : "Here's where to find it:", ...lines, '', isAr ? 'أو اضغط الزر لأفتحه لك:' : 'Or tap the button to open it:'].join('\n'),
    places,
  };
}
