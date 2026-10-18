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
  // Bare «اختبار» too: «كيف أسوي اختبار» found no place. The plural stays the exams'.
  quiz: ['اختبار قصير', 'اختبار', 'كويز', 'quiz'],
  evaluations: ['اختبارات', 'امتحان', 'امتحانات', 'تقييم', 'تقييمات', 'علامات', 'نتائج', 'exam', 'test', 'tests', 'grades', 'results'],
  'parent-msg': ['رساله ولي امر', 'رساله للاهل', 'parent message'],
};

/** Steps for "how do I make one" — the generators the chat can also make itself. */
const TOOL_HOW: Record<string, string> = {
  'lesson-plan': 'howMakeLessonPlan',
  worksheet: 'howMakeWorksheet',
  quiz: 'howMakeQuiz',
  activity: 'howMakeActivity',
};

/** Screens reached from Profile or a tab, which no catalog lists. */
const SCREENS: AppPlace[] = [
  {
    id: 'classes', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    // «clases» is the typo that actually got typed.
    keywords: ['شعب', 'شعبه', 'شعبي', 'شعبتي', 'طلابي', 'طلبتي', 'classes', 'clases', 'my class', 'add class', 'add a class', 'new class', 'another class', 'extra class', 'students'],
    howKey: 'howAddClass',
  },
  {
    // Students are added inside a class that already exists, not by making one,
    // so this has its own steps. No keywords: «add a student» is reached only
    // through `ADD_STUDENT`, which is anchored (see there).
    id: 'add-student', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: [],
    howKey: 'howAddStudent',
  },
  // The four below are reached through `RULE_PLACES` (anchored, see there), or
  // through their keywords. Each has its own steps because the screen alone
  // does not say how: archiving is a bin icon on the list, the link code a
  // button on the class page, sign-out the last row of Profile, and there is
  // no change-password screen at all.
  {
    id: 'archive-class', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: [],
    howKey: 'howArchiveClass',
  },
  {
    id: 'link-code', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['رمز الربط', 'رمز الانضمام', 'link code', 'join code'],
    howKey: 'howShareLinkCode',
  },
  {
    id: 'sign-out', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    keywords: ['تسجيل الخروج', 'sign out', 'log out'],
    howKey: 'howSignOut',
  },
  {
    id: 'password', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    keywords: [],
    howKey: 'howChangePassword',
  },
  // Reached through `RULE_PLACES` (2026-10-17's second live pass); steps taken
  // from the screens they name. Three say plainly that something is not in the
  // app: a dark-mode switch (the scheme follows the device, read at start-up),
  // a name editor (only sign-up sets it), and a report button on a result that
  // was not shared (`GeneratorResultActions` shows it only with a variant id).
  { id: 'homework', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howAddHomework' },
  { id: 'exam-date', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howExamDate' },
  { id: 'class-scan', route: '/evaluations', labelKey: 'evaluations', pathKeys: ['tabTools', 'toolsAfterClass'], isTool: false, keywords: [], howKey: 'howClassScan' },
  { id: 'class-chat', route: '/classes', labelKey: 'myClasses', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howClassChat' },
  { id: 'block', route: '/notifications', labelKey: 'tabAlerts', pathKeys: [], isTool: false, keywords: [], howKey: 'howBlock' },
  { id: 'change-name', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false, keywords: [], howKey: 'howChangeName' },
  { id: 'delete-account', route: '/settings', labelKey: 'settings', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howDeleteAccount' },
  { id: 'suggest-feature', route: '/suggest-feature', labelKey: 'suggestFeature', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howSuggestFeature' },
  { id: 'report-problem', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howReportProblem' },
  { id: 'regenerate', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false, keywords: [], howKey: 'howRegenerate' },
  { id: 'save-material', route: '/workspace', labelKey: 'myWorkspace', pathKeys: ['tabProfile'], isTool: false, keywords: [], howKey: 'howSaveMaterial' },
  {
    id: 'dark-mode', route: '/faq', labelKey: 'faqTitle', pathKeys: [], isTool: false,
    keywords: ['الوضع الليلي', 'الوضع الداكن', 'الوضع المظلم', 'dark mode', 'dark theme', 'night mode'],
    howKey: 'howDarkMode',
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
    keywords: ['اعدادات', 'الاعدادات', 'اللغه', 'settings', 'language'],
  },
  {
    id: 'faq', route: '/faq', labelKey: 'faqTitle', pathKeys: ['tabProfile'], isTool: false,
    keywords: ['مساعده', 'الاسئله الشائعه', 'اسئله شائعه', 'help', 'faq'],
  },
  {
    id: 'profile', route: '/profile', labelKey: 'tabProfile', pathKeys: [], isTool: false,
    // No bare «الحساب»: it is also arithmetic («كيف أحذف الحساب من المعادلة»).
    keywords: ['حسابي', 'الملف الشخصي', 'account', 'profile'],
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
        howKey: TOOL_HOW[tool.id],
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
  return normalize(foldAccusative(s.replace(/[؟?!.,،]/g, ' '))).replace(/(^|\s)ال(?=\S{2,})/g, '$1');
}

/**
 * «كيف أضيف صفاً جديداً؟» is «كيف أضيف صف جديد» in its correct written form, and
 * came back as «أيّ مادة تقصد؟» (found on app.iqrra.com, 2026-10-16): `normalize`
 * drops the tanween but not the alif it sits on, so «صفا جديدا» matched nothing.
 * The marked ending (اً or ًا) is dropped from any word. Typed without the mark it
 * is only dropped from the words a grade is added with — «صفا», «جديدا» and the
 * ordinals — since an alif ending is otherwise part of the word.
 */
function foldAccusative(s: string): string {
  return s
    .replace(/(\S)(?:اً|ًا)(?=\s|$)/g, '$1')
    .replace(/(^|\s)((?:ال)?(?:صف|جديد|اضافي|إضافي|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر))ا(?=\s|$)/g, '$1$2');
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
const HOW_ACCOUNT =
  /(كيف|طريقه|خطوات)\s*(يمكنني\s*|ممكن\s*)?((ا|ن)?(ضيف|ضف|ضافه|نشي|نشئ|نشاء|عمل|غير|عدل|حذف|صدر|طبع|حفظ|بدا|شارك|ربط|دعو|ستخدم|فعل|شغل)|تغيير|تعديل|تصدير|طباعه|تفعيل|تشغيل|بدء)|\bhow\s+(?:(?:do|can|should)\s+(?:i|we)\s+)?(?:to\s+)?(?:add|create|make|change|edit|delete|remove|export|print|save|share|start|use|link|invite|enable|turn\s+on|switch\s+to)\b|\bcan\s+i\s+(?:add|change|edit|delete|remove|export|print|save|share|link|invite)\b|\b(?:is\s+there\s+(?:a|any|some)\s+way|is\s+it\s+possible|any\s+way)\s+to\s+(?:add|change|edit|delete|remove|export|save|share|link|invite)\b|(?:^|\s)(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?(?:اضيف|اضافه|اغير|اعدل|احذف|اصدر|احفظ|اشارك|اربط|ادعو)(?:\s|$)/i;

/**
 * «how to generate worksheet», «كيف أجهّز ورقة عمل» — how a material is made.
 * These verbs said nothing to the pattern above, so the question fell through
 * to the generator: it made a worksheet titled «how» (found on app.iqrra.com,
 * 2026-10-17). They count only right before a material's name, because «how
 * do I prepare students for the exam» and «كيف أحضّر طلابي» are teaching
 * questions that happen to name a place.
 */
const HOW_MAKE =
  /\bhow\s+(?:(?:do|can|could|should)\s+(?:i|we)\s+)?(?:to\s+)?(?:generate|prepare|build|write|design|produce|get)\s+(?:(?:a|an|the|my|some|new)\s+)?(?:worksheets?|quiz(?:zes)?|(?:lesson\s+)?plans?|activit(?:y|ies)|homework|exams?|tests?|slides|presentations?)\b|(كيف|طريقه|خطوات)\s*(يمكنني\s*|ممكن\s*)?(ا|ن)?(جهز|حضر|سوي|ولد|كتب)\s+(ال)?(ورقه|اوراق|خطه|اختبار|امتحان|نشاط|واجب|عرض)/i;

const HOW_PATTERN = new RegExp(`${HOW_ACCOUNT.source}|${HOW_MAKE.source}`, 'i');

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
/**
 * «i want to change the grade», «اريد ان اغير الصف» and «i need to add lesson»
 * say what the teacher wants without naming the screen that does it: the grades
 * they teach live under «المواد التي أُدرّسها», and a lesson is picked from the bar
 * above the chat, not added. Each maps to the place that answers it. As with the
 * bare «add a grade» they need first-person intent and must end the message —
 * «change the grade of the quiz», «i want to add a lesson plan» and «اريد اضافة
 * درس عن الكسور» stay teaching — and «grade» here can still mean a mark, a guess
 * kept for the same reason as the bare add.
 */
const STATEMENT_PLACES: { re: RegExp; id: string }[] = [
  {
    id: 'subjects',
    re: new RegExp(
      `^${EN_INTENT}(?:change|switch|edit|update|swap)\\s+(?:(?:my|the)\\s+)?(?:grades?|year)(?:\\s+(?:please|pls|plz|now|here))*$`,
    ),
  },
  {
    id: 'subjects',
    re: new RegExp(
      `^${AR_INTENT}(?:اغير|تغيير|اعدل|تعديل|ابدل|تبديل)\\s+(?:ال)?(?:صف|صفي|صفوف|صفوفي)(?:\\s+(?:لي|من\\s+فضلك|لو\\s+سمحت|هنا|الان))*$`,
    ),
  },
  {
    id: 'change-lesson',
    re: new RegExp(
      `^${EN_INTENT}(?:add|pick|choose|select)\\s+(?:(?:an?|another|one\\s+more|new|a\\s+new|the)\\s+)?lessons?(?:\\s+(?:please|pls|plz|now|here))*$`,
    ),
  },
  {
    id: 'change-lesson',
    re: new RegExp(
      `^${AR_INTENT}(?:اضيف|اضافه|اضف|اختار|اختيار|اخير)\\s+(?:ال)?درس(?:\\s+(?:جديد|اخر|ثاني))?(?:\\s+(?:لي|من\\s+فضلك|لو\\s+سمحت|هنا|الان))*$`,
    ),
  },
];
/**
 * «كيف أضيف طالباً جديداً؟», «how do i add a student», «بدي اضيف طلاب للشعبة».
 * Found on app.iqrra.com (2026-10-17): with live AI on, the first went to the
 * model, which said it was a question about the app and gave no steps — no
 * keyword names a student being added, and the bare «students» keyword alone
 * claims nothing. The how-word or intent is optional, but the student must end
 * the message, bar a new / another, and «to my class / الى الشعبة»: «كيف أضيف
 * طالباً إلى مجموعة النقاش» and «add a student to the group work» stay teaching.
 * Written against `plain()` output (hamza and ة folded, accusative dropped).
 */
/** The optional opening of an anchored rule: a how / where / can-I word, or first-person intent. */
const EN_RULE_LEAD = String.raw`^(?:(?:please|pls|plz)\s+)?(?:(?:how\s+(?:do|can|should)\s+(?:i|we)|where\s+(?:do|can|should)\s+(?:i|we)|how\s+to|can\s+(?:i|we)|(?:i|we)\s+(?:want|need|wanna)\s+to|(?:i|we)(?:'d|\s+would)\s+like\s+to|let\s+me|help\s+me(?:\s+to)?)\s+)?`;
const AR_RULE_LEAD = String.raw`^(?:(?:كيف|طريقه|خطوات|وين|اين|من\s+وين|من\s+اين)\s+(?:يمكنني\s+|ممكن\s+|بقدر\s+)?|(?:هل\s+)?(?:يمكنني|يمكن|اقدر|استطيع|ممكن)\s+(?:ان\s+)?|${AR_INTENT})?`;
const EN_RULE_TAIL = String.raw`(?:\s+(?:please|pls|plz|now|here))*$`;
const AR_RULE_TAIL = String.raw`(?:\s+(?:لي|من\s+فضلك|لو\s+سمحت|هنا|الان))*$`;

const ADD_STUDENT: RegExp[] = [
  new RegExp(
    EN_RULE_LEAD +
      String.raw`add\s+(?:(?:a|an|another|one\s+more|more|new|some|my|the)\s+)*students?(?:\s+names?)?` +
      String.raw`(?:\s+(?:to|in|into)\s+(?:my|the|a|this)\s+(?:class(?:es)?|section|roster|class\s+list))?` + EN_RULE_TAIL,
  ),
  new RegExp(
    AR_RULE_LEAD +
      String.raw`(?:اضيف|اضافه|اضف|نضيف|اسجل|تسجيل|ادخل|ادخال)\s+(?:اسم\s+|اسماء\s+)?(?:ال)?(?:طالب|طالبا|طالبه|طلاب|طلابا|طلبه|طالبات)` +
      String.raw`(?:\s+(?:جديد|جدد|جديده|اخر|اخري|اخرين))?` +
      String.raw`(?:\s+(?:الي|في|ل|لل)\s*(?:ال)?(?:شعبه|شعبتي|صف|صفي|قائمه))?` + AR_RULE_TAIL,
  ),
];

/**
 * Found on app.iqrra.com (2026-10-17), each with live AI on: «كيف أحذف شعبة؟» got
 * the add-a-class steps (a how-word plus «شعبة» was all the matcher saw), and
 * «كيف أسجل الخروج؟», «كيف أغير كلمة المرور؟» and «كيف أشوف نتائج الطلاب؟» went to
 * the model, which guessed or asked which app was meant. Anchored as `ADD_STUDENT`
 * is: the thing asked about ends the message, so «how do i change a password in
 * excel», «كيف أعرف نتائج التجربة» and «how do i delete a class of compounds from
 * the table» stay teaching. Results get the path to the evaluations, where marks
 * are read; the rest have steps.
 */
const AR_PASSWORD = String.raw`(?:ال)?(?:كلمه\s+(?:ال)?(?:مرور|سر)|رقم\s+(?:ال)?سري|باسورد|باسوورد)`;
const RULE_PLACES: { id: string; res: RegExp[] }[] = [
  { id: 'add-student', res: ADD_STUDENT },
  {
    id: 'archive-class',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:delete|remove|archive)\s+(?:(?:a|an|the|my|this|that|old)\s+)*class(?:es)?(?:\s+from\s+(?:my|the)\s+(?:list|account|app))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احذف|حذف|امسح|مسح|ازيل|ازاله|ارشف|ارشفه|الغي|الغاء)\s+(?:ال)?(?:شعبه|شعب|شعبتي)(?:\s+(?:القديمه|قديمه|هذه|من\s+(?:ال)?(?:قائمه|قائمتي|حسابي|تطبيق)))*` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'sign-out',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:sign|log)\s*out(?:\s+of\s+(?:my\s+account|the\s+app))?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اسجل|تسجيل|اعمل)\s+(?:ال)?خروج(?:\s+من\s+(?:ال)?(?:حساب|حسابي|تطبيق))?|اخرج\s+من\s+(?:ال)?(?:حساب|حسابي|تطبيق))` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'password',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|reset|update|recover)\s+(?:(?:my|the|a)\s+)?password` + EN_RULE_TAIL),
      new RegExp(String.raw`^(?:i\s+)?forgot\s+(?:my\s+)?password` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اغير|تغيير|ابدل|تبديل|اعدل|تعديل|استرجع|استرجاع|استعيد|استعاده|اعيد\s+تعيين|اعاده\s+تعيين)\s+` + AR_PASSWORD +
          String.raw`(?:\s+(?:تبعي|حقي|حسابي|لحسابي|الخاصه\s+بي))?` + AR_RULE_TAIL,
      ),
      new RegExp(String.raw`^(?:لقد\s+)?نسيت\s+` + AR_PASSWORD + AR_RULE_TAIL),
    ],
  },
  {
    id: 'tool:evaluations',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:see|view|check|find)\s+(?:(?:my|the)\s+)?(?:(?:students?'?|class|exam|test)\s+)?(?:results|marks|grades|scores)` +
          String.raw`(?:\s+(?:of|for|from)\s+(?:my|the|this)\s+(?:students|class|exam|test|quiz))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اشوف|اري|اعرف|اتابع|اطلع\s+علي|اعرض|عرض|متابعه)\s+(?:ال)?(?:نتائج|علامات|درجات)\s+` +
          String.raw`(?:ال)?(?:طلاب|طلبه|طلابي|طلبتي|شعبه|شعبتي|امتحان|امتحانات|اختبار|اختبارات|تقييم|تقييمات)` + AR_RULE_TAIL,
      ),
    ],
  },
  // The second live pass (2026-10-17): each of these went to the model, which
  // invented a menu. Same anchoring: what is asked about ends the message, so
  // «أريد واجباً عن الكسور», «كيف أكتب رسالة للطلاب عن القراءة» and «كيف أحفظ جدول
  // الضرب» stay teaching. Verbs that also mean "make me one" («أنشئ», «اكتب»,
  // «أعطني») are left out on purpose: those are asks for the generator.
  {
    id: 'homework',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:add|give|set|assign|post|send)\s+(?:(?:a|the|some|new)\s+)*homework(?:\s+(?:to|for)\s+(?:my|the)\s+(?:students|class))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|اضيف|اضافه|اضف|اكلف|انشر|ابعث|ابعت)\s+(?:ال)?(?:واجب|واجبات)(?:\s+(?:منزلي|بيتي|جديد))?` +
          String.raw`(?:\s+(?:ل|الي|لل)\s*(?:ال)?(?:طلاب|طلابي|طلبه|طلبتي|شعبه|شعبتي|صف|صفي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'exam-date',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:(?:set|add|choose|pick)\s+(?:(?:an|a|the)\s+)?(?:exam|test)\s+date|schedule\s+(?:(?:an|a|the|my)\s+)?(?:exam|test))` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اضع|احدد|اضيف|تحديد|وضع|اختار)\s+(?:ال)?(?:موعد|تاريخ)\s+(?:لل|ل|ال)?(?:امتحان|اختبار|تقييم)` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-scan',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:scan|photograph)\s+(?:(?:the|my)\s+)?(?:answer\s+sheets?|exam\s+papers?|class\s+papers?|students'?\s+papers?|papers)(?:\s+with\s+(?:the|my)\s+(?:camera|phone))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:امسح|مسح|اصور|تصوير)\s+(?:ال)?(?:اوراق|ورقه)\s+(?:ال)?(?:اجابه|اجابات|امتحان|اختبار|طلاب|طلبه|صف|شعبه)` +
          String.raw`(?:\s+(?:ب|عبر)\s*(?:ال)?(?:كاميرا|جوال|هاتف))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'class-chat',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`(?:send|post)\s+(?:an?\s+)?(?:message|announcement)\s+to\s+(?:all\s+(?:of\s+)?)?(?:my\s+|the\s+)?(?:whole\s+)?(?:class|students)` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ارسل|ابعث|ابعت)\s+(?:رساله|رسائل|اعلان|تعميم)\s+(?:ل|الي|لل)\s*(?:كل\s+)?(?:ال)?(?:شعبه|شعبتي|صف|طلاب|طلابي|طلبه|طلبتي)` +
          String.raw`(?:\s+(?:كلها|كلهم|جميعا))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'block',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:block|unblock)\s+(?:(?:a|this|that|the)\s+)?(?:parent|person|user|student|someone|contact)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احظر|حظر|الغي\s+حظر|افك\s+حظر)\s+(?:ولي\s+(?:ال)?امر|شخص|مستخدم|طالب|احد|حدا)(?:\s+من\s+مراسلتي)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-name',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:change|edit|update|fix)\s+my\s+(?:display\s+|account\s+)?name` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:اغير|تغيير|اعدل|تعديل|ابدل|اصحح)\s+(?:اسمي|(?:ال)?اسم\s+(?:ال)?(?:ظاهر|حساب))(?:\s+في\s+(?:ال)?تطبيق)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'delete-account',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:delete|remove|close|deactivate)\s+(?:my\s+|the\s+)?account(?:\s+permanently)?` + EN_RULE_TAIL),
      new RegExp(AR_RULE_LEAD + String.raw`(?:احذف|حذف|الغي|الغاء|اغلق|اغلاق|امسح|مسح)\s+(?:ال)?(?:حساب|حسابي)(?:\s+نهائيا)?` + AR_RULE_TAIL),
    ],
  },
  {
    id: 'suggest-feature',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:suggest|request)\s+(?:an?\s+)?(?:new\s+)?(?:feature|idea)(?:\s+for\s+the\s+app)?` + EN_RULE_TAIL),
      new RegExp(EN_RULE_LEAD + String.raw`(?:send|give|leave)\s+(?:some\s+)?feedback(?:\s+(?:on|about)\s+(?:the\s+)?app)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:(?:اقترح|اقتراح|اطلب|طلب)\s+(?:ميزه|خاصيه|ميزات|خصائص|فكره)(?:\s+(?:جديده|جديد))?|(?:ارسل|اقدم)\s+(?:اقتراح|ملاحظه|ملاحظات))` +
          String.raw`(?:\s+(?:ل|في|علي|عن)\s*(?:ال)?تطبيق)?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'report-problem',
    res: [
      new RegExp(
        EN_RULE_LEAD + String.raw`report\s+(?:an?\s+)?(?:problem|error|mistake|issue)(?:\s+(?:in|with|on)\s+(?:the|a|this)\s+(?:worksheet|quiz|lesson\s+plan|activity|slides|answer|result))?` + EN_RULE_TAIL,
      ),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:ابلغ|ابلاغ|بلغ|تبليغ)\s+(?:عن\s+)?(?:خطا|مشكله|غلط)` +
          String.raw`(?:\s+في\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|امتحان|خطه\s+(?:ال)?درس|نشاط|عرض|اجابه|نتيجه))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'regenerate',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:regenerate|redo|remake)\s+(?:(?:the|a|my|this)\s+)?(?:worksheet|quiz|lesson\s+plan|activity|slides|exam)?` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اعيد|اعاده)\s+(?:توليد|تجهيز|انشاء|صنع)(?:\s+(?:ال)?(?:ورقه\s+(?:ال)?عمل|اختبار|امتحان|خطه\s+(?:ال)?درس|نشاط|عرض|شرائح|واجب|اسئله))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'save-material',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:save|keep)\s+(?:(?:the|a|my|this)\s+)?(?:lesson\s+plan|worksheet|quiz|activity|slides|exam)` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:احفظ|حفظ|نحفظ)\s+(?:ال)?(?:خطه\s+(?:ال)?درس|ورقه\s+(?:ال)?عمل|اختبار|امتحان|نشاط|عرض|شرائح|واجب)(?:\s+(?:هذه|هذا|في\s+(?:ال)?ملفاتي|عندي))?` + AR_RULE_TAIL,
      ),
    ],
  },
  {
    id: 'change-lesson',
    res: [
      new RegExp(EN_RULE_LEAD + String.raw`(?:choose|pick|select|change|switch)\s+(?:to\s+)?(?:(?:a|another|the|a\s+different)\s+)?lesson` + EN_RULE_TAIL),
      new RegExp(
        AR_RULE_LEAD + String.raw`(?:اختار|اختيار|اغير|تغيير|ابدل|تبديل|انتقل\s+(?:الي|ل))\s+(?:ال)?درس(?:\s+(?:اخر|ثاني|جديد|غيره))?` + AR_RULE_TAIL,
      ),
    ],
  },
];

/**
 * «وين ألاقي خطة الدرس اللي حفظتها؟» opened the lesson-plan generator: the tool's
 * name was the only keyword. Something the teacher saved is in «ملفاتي», whatever
 * kind it is, so a where / how question that says it was saved goes there.
 */
const DARK_MODE = /(?:^|\s)(?:ال)?وضع\s+(?:ال)?(?:ليلي|داكن|مظلم)(?:\s|$)|\b(?:dark|night)\s+(?:mode|theme)\b/;
const SAVED_WORD = /(?:^|\s)(?:حفظتها|حفظته|حفظتهم|حفظت|المحفوظه|المحفوظات|محفوظه|محفوظ)(?:\s|$)|\bsaved\b/;

/**
 * «كيف أشارك رمز الربط مع أولياء الأمور؟» opened Messages: «أولياء الأمور» is a
 * longer keyword than «رمز الربط», and the longest keyword wins. The link code is
 * the app's own word, so wherever it is named in a how / where question, it is
 * what the question is about.
 */
const LINK_CODE = /(?:^|\s)(?:رمز\s+(?:ال)?(?:ربط|انضمام)|link\s+code|join\s+code|class\s+code)(?:\s|$)/;
const AR_INTENT_START = new RegExp(`^${AR_INTENT}`);
const EN_INTENT_START = new RegExp(`^${EN_INTENT}`);

const statementPlaceId = (plainQuery: string): string | undefined => {
  const rule = RULE_PLACES.find(r => r.res.some(re => re.test(plainQuery)));
  if (rule) return rule.id;
  if (
    LINK_CODE.test(plainQuery) &&
    (HOW_PATTERN.test(plainQuery) || WHERE_PATTERN.test(plainQuery) || AR_INTENT_START.test(plainQuery) || EN_INTENT_START.test(plainQuery))
  ) {
    return 'link-code';
  }
  if (SAVED_WORD.test(plainQuery) && (WHERE_PATTERN.test(plainQuery) || HOW_PATTERN.test(plainQuery))) return 'workspace';
  // There is no switch to point at, so «وين الوضع الليلي» gets the explanation,
  // not a path to a screen that does not have one.
  if (
    DARK_MODE.test(plainQuery) &&
    (HOW_PATTERN.test(plainQuery) || WHERE_PATTERN.test(plainQuery) || AR_INTENT_START.test(plainQuery) || EN_INTENT_START.test(plainQuery))
  ) {
    return 'dark-mode';
  }
  return STATEMENT_PLACES.find(s => s.re.test(plainQuery))?.id;
};
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

/** «جدول الضرب» and «الجدول الدوري» are the times table and the periodic table, not the timetable. */
const NOT_A_TIMETABLE = /(?:^|\s)جدول(?=\s+(?:ضرب|دوري)(?:\s|$))/g;

/**
 * «كيف أضيف صفاً إلى المصفوفة» is a matrix row, not a grade: dropped before the
 * keywords are matched, so «اضيف صف» no longer finds the grade steps. Only when
 * the matrix follows («صف جديد للمصفوفة», «صفوف في المصفوفة»).
 */
const NOT_A_GRADE = /(?:^|\s)(?:صف|صفوف)(?=(?:\s+(?:جديد|اخر|ثاني|اضافي))?\s+(?:(?:الي|في|من)\s+)?(?:لل|ل)?مصفوف)/g;

/** A word that says the question is about the app, even when no place matched. */
const APP_NOUN = /تطبيق|البرنامج|صفحه|قسم|تبويب|زر|قائمه|\bapp\b|\bpage\b|\bscreen\b|\btab\b|\bbutton\b|\bmenu\b/i;

/**
 * Places the question names, best first, at most `limit`. A keyword counts
 * only as whole words — «جدول» must not claim «الجدول الدوري» on a chemistry
 * question, so multi-word keywords win over their single-word prefixes.
 */
export function findAppPlaces(query: string, limit = 3): AppPlace[] {
  const statementId = statementPlaceId(plain(query));
  if (statementId) return APP_PLACES.filter(p => p.id === statementId);
  const q = ` ${matchForm(query).replace(NOT_A_SCHOOL_CLASS, ' ').replace(NOT_A_TIMETABLE, ' ').replace(NOT_A_GRADE, ' ')} `;
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

const plain = (query: string) => normalize(foldAccusative(query.replace(/[؟?!.,،]/g, ' ')));

/** "How do I…" rather than "where is…" — the answer is steps, not a path. */
export function isHowQuery(query: string): boolean {
  const q = plain(query);
  // «add more classes to my account» is a «how do I» in disguise: it gets the steps.
  // So is «i can't add a class», and a statement about a screen gets that screen's
  // steps when it has any (answerAppHelp falls back to the path when it has none).
  return HOW_PATTERN.test(q) || isAddToAccount(q) || Boolean(statementPlaceId(q)) || (isProblemWithScreen(q) && PROBLEM_ADDING.test(q)) || isScreenStatement(query);
}

/**
 * True when the teacher is asking where something is in the app, or how to do
 * something in it. Needs both a "where / how do I" phrase and something
 * app-shaped — «أين تقع البتراء؟» is a geography question and must stay one.
 */
export function isAppHelpQuery(query: string): boolean {
  const q = plain(query);
  if (isAddToAccount(q) || statementPlaceId(q) || isProblemWithScreen(q) || isScreenStatement(query)) return true;
  if (!WHERE_PATTERN.test(q) && !HOW_PATTERN.test(q)) return false;
  return findAppPlaces(q, 1).length > 0 || APP_NOUN.test(q);
}

export type AppHelpAnswer = { text: string; places: AppPlace[] };

const PRINT_VERB = /(?:^|\s)(?:اطبع|نطبع|طباعه)(?:\s|$)|\bprint/;
const REMOVE_VERB = /(?:^|\s)(?:احذف|حذف|امسح|مسح|ازيل|ازاله|ارشف|ارشفه|الغي|الغاء)(?:\s|$)|\b(?:delete|remove|archive|erase)\b/;
/** Steps that add something, which must not answer a question about removing it. */
const ADD_HOWS = new Set(['howAddClass', 'howAddGrade', 'howAddStudent']);

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
  // Printing is exporting: «كيف أطبع ورقة العمل» gets the export steps, which
  // end in a PDF or Word file ready to print. And steps for adding never answer
  // a question about removing: «كيف أحذف صفاً» gets the path to the grades, not
  // «اضغط إضافة صف» (the class version has its own steps, `archive-class`).
  const q = plain(query);
  const exportHow = places.find(p => p.id === 'export')?.howKey
    ?? (PRINT_VERB.test(q) ? APP_PLACES.find(p => p.id === 'export')?.howKey : undefined);
  const firstHow = places[0]!.howKey && !(ADD_HOWS.has(places[0]!.howKey) && REMOVE_VERB.test(q))
    ? places[0]!.howKey
    : undefined;
  // A generator's own steps say how to make one, so «how do I export my
  // worksheet» still gets the export's.
  const how = isHowQuery(query)
    ? places[0]!.isTool ? exportHow ?? firstHow : firstHow ?? exportHow
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
