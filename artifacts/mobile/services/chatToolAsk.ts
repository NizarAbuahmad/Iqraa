/**
 * Chat asks for material that has its own screen — a game, slides, a test,
 * a dictation (إملاء).
 *
 * Chat generates plans, worksheets, quizzes and activities inline. These four
 * are full screens (a game player, a slide deck, the evaluations flow), so the
 * reply is a button that opens that screen on the current lesson instead of a
 * wall of text pretending to be one. Before this, «أعطني لعبة لهذا الدرس» went
 * through the teaching pipeline and came back as a description of a game.
 *
 * Pure TypeScript, so `node --test` can run it.
 */
import { normalize } from './commandPalette.ts';

export type ToolAsk = 'game' | 'slides' | 'test' | 'dictation';

export type ToolAskTarget = {
  route: string;
  /** i18n key for the button label. */
  labelKey: string;
  /** A generator screen: open it on the current lesson's grade and subject. */
  isTool: boolean;
};

export const TOOL_ASK_TARGETS: Record<ToolAsk, ToolAskTarget> = {
  game: { route: '/ai-tools/game', labelKey: 'toolGameTitle', isTool: true },
  slides: { route: '/ai-tools/slides', labelKey: 'toolSlidesTitle', isTool: true },
  // The evaluations flow reads no route params — the teacher picks grade,
  // subject and objectives there — so these open it bare.
  test: { route: '/evaluations/new', labelKey: 'evaluations', isTool: false },
  dictation: { route: '/evaluations/new', labelKey: 'evaluations', isTool: false },
};

// Checked in this order: «إملاء» is a kind of test, and "a quiz game" is a game.
const PATTERNS: Array<[ToolAsk, RegExp]> = [
  ['dictation', /املاء|dictation/],
  ['slides', /عرض\s*(تقديمي|شرائح)|شرائح|بوربوينت|باوربوينت|بريزنتيشن|\bslides?\b|presentation|\bdeck\b/],
  // «اختبار قصير» / quiz is generated inline and deliberately absent here.
  ['test', /امتحان|تقييم|اختبار\s*(شهري|نهائي|رسمي|فصلي)|\bexam\b|\btest\b/],
  ['game', /لعبه|العاب|مسابقه|\bgames?\b/],
];

/**
 * Words that make a message a request rather than a question about the
 * subject. «ما أنواع التقييم؟» is a teaching question; «جهّز تقييم» is not.
 */
const REQUEST_CUE =
  /(^|\s)(انشئ|اعمل|سوي|جهز|حضر|اعد|ولد|اصنع|صمم|بدي|بدنا|اريد|نريد|ابغي|ابي|اعطني|عطني|هات|اقترح)(\s|$)|\b(create|make|build|prepare|generate|give\s+me|i\s+want|i\s+need|suggest)\b/;

/** The tool screen a chat message is asking for, or null. */
export function toolAskFromQuery(query: string): ToolAsk | null {
  const q = normalize(query.replace(/[؟?!.,،]/g, ' '));
  const kind = PATTERNS.find(([, re]) => re.test(q))?.[0] ?? null;
  if (!kind) return null;
  // A bare «إملاء» / «عرض شرائح» typed alone is a request too.
  const short = q.split(' ').length <= 3;
  return short || REQUEST_CUE.test(q) ? kind : null;
}

/** The reply that goes with the button. `topic` is the lesson on the card, if any. */
export function toolAskReply(kind: ToolAsk, lang: 'ar' | 'en', topic?: string | null): string {
  const isAr = lang === 'ar';
  const onLesson = topic?.trim()
    ? (isAr ? ` على درس «${topic.trim()}»` : ` on “${topic.trim()}”`)
    : '';
  switch (kind) {
    case 'game':
      return isAr
        ? `جهّزت لك أداة الألعاب${onLesson}. اضغط الزر لفتحها واختيار نوع اللعبة:`
        : `The game builder is ready${onLesson}. Tap to open it and pick a game:`;
    case 'slides':
      return isAr
        ? `جهّزت لك أداة العروض${onLesson}. اضغط الزر لبناء الشرائح:`
        : `The slides tool is ready${onLesson}. Tap to build the deck:`;
    case 'test':
      return isAr
        ? 'الاختبارات تُبنى من شاشة التقييمات: اختر الصف والمادة والأهداف، وتُولَّد الأسئلة لك. اضغط الزر للبدء:'
        : 'Tests are built in Evaluations: pick the grade, subject and objectives and the questions are generated for you. Tap to start:';
    case 'dictation':
      return isAr
        ? 'الإملاء سؤال داخل الاختبار: أنشئ اختبارًا، ثم اضغط «أضِف إملاء» داخله لاختيار الكلمات. اضغط الزر للبدء:'
        : 'Dictation is a question inside a test: create the test, then tap “Add a dictation” inside it to pick the words. Tap to start:';
  }
}
