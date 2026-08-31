/**
 * Pure routing helpers for the classroom hub → builder flow.
 *
 * Extracted so they can be imported by both the index and builder screens
 * and exercised directly in unit tests without React-Native dependencies.
 */

export interface ActivityCard {
  id: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  available: boolean;
  difficulty: string;
  groupType: string;
  duration: string;
  /** Minutes, for the marketplace hub's "Quick" filter. */
  durationMin: number;
  isTeam: boolean;
  isSolo: boolean;
  isNew: boolean;
  isFeatured: boolean;
  accentColor: string;
}

/**
 * The one card list for the classroom hub (marketplace grid) and the builder
 * (header lookup). Previously the hub and this module each kept their own
 * list and drifted — the hub had 7 cards, this one had 5 — so opening the
 * builder from `error-detective` or `gallery-walk` fell back to generic
 * header copy because this module didn't know those ids. See STATUS.md.
 */
export const ACTIVITY_CARDS: ActivityCard[] = [
  // escape-challenge stays first: resolveActivityType()'s fallback must match
  // the first card (see classroomRouting.test.ts consistency check).
  {
    id: 'escape-challenge', emoji: '🔐',
    titleKey: 'activityEscapeTitle', descKey: 'activityEscapeDesc',
    available: true, difficulty: 'Easy–Advanced', groupType: 'Groups', duration: '10–30 min',
    durationMin: 30, isTeam: true, isSolo: false, isNew: false, isFeatured: true,
    accentColor: '#4F46E5',
  },
  {
    id: 'quick-check', emoji: '🙋',
    titleKey: 'activityQuickCheckTitle', descKey: 'activityQuickCheckDesc',
    available: true, difficulty: 'Easy–Advanced', groupType: 'Whole Class', duration: '5–15 min',
    // isFeatured must stay false: the hub renders ONE hero card
    // (find(isFeatured)) and drops every other featured card from the list.
    durationMin: 15, isTeam: false, isSolo: false, isNew: true, isFeatured: false,
    accentColor: '#3B82F6',
  },
  {
    id: 'error-detective', emoji: '🔍',
    titleKey: 'activityErrorTitle', descKey: 'activityErrorDesc',
    available: true, difficulty: 'Medium', groupType: 'Pairs', duration: '15–25 min',
    durationMin: 25, isTeam: true, isSolo: false, isNew: true, isFeatured: false,
    accentColor: '#E67E22',
  },
  {
    id: 'exit-ticket', emoji: '🎫',
    titleKey: 'activityExitTitle', descKey: 'activityExitDesc',
    available: true, difficulty: 'Easy', groupType: 'Individual', duration: '5–10 min',
    durationMin: 10, isTeam: false, isSolo: true, isNew: true, isFeatured: false,
    accentColor: '#10B981',
  },
  {
    id: 'bingo', emoji: '🎱',
    titleKey: 'activityBingoTitle', descKey: 'activityBingoDesc',
    available: true, difficulty: 'Easy–Medium', groupType: 'Whole Class', duration: '15–25 min',
    durationMin: 25, isTeam: true, isSolo: false, isNew: false, isFeatured: false,
    accentColor: '#A855F7',
  },
  {
    id: 'relay', emoji: '🏃',
    titleKey: 'activityRelayTitle', descKey: 'activityRelayDesc',
    available: true, difficulty: 'Medium–Advanced', groupType: 'Teams', duration: '20–35 min',
    durationMin: 35, isTeam: true, isSolo: false, isNew: false, isFeatured: false,
    accentColor: '#F43F5E',
  },
  {
    id: 'gallery-walk', emoji: '🖼️',
    titleKey: 'activityGalleryTitle', descKey: 'activityGalleryDesc',
    available: true, difficulty: 'Medium', groupType: 'Groups', duration: '20–30 min',
    durationMin: 30, isTeam: true, isSolo: false, isNew: true, isFeatured: false,
    accentColor: '#0EA5E9',
  },
];

/**
 * Builds the Expo Router push payload for navigating from the hub to the
 * builder.  The `activityType` param carries the selected card's id.
 *
 * Accepts any object that has at least an `id` string so it works with both
 * the minimal ActivityCard exported from this module and the richer local
 * ActivityCard used by the marketplace UI in index.tsx.
 *
 * Mirrors the router.push() call in ClassroomHubScreen.handleSelect().
 */
export function buildBuilderRoute(card: { id: string }): {
  pathname: string;
  params: { activityType: string };
} {
  return {
    pathname: '/ai-tools/classroom/builder',
    params: { activityType: card.id },
  };
}

/**
 * Resolves the activityType that the builder passes to generateClassroomActivity.
 *
 * Mirrors builder.tsx line 67:
 *   activityType: params.activityType ?? 'escape-challenge'
 */
export function resolveActivityType(params: { activityType?: string }): string {
  return params.activityType ?? 'escape-challenge';
}

/**
 * Whether the room the activity runs in has a projector/screen, or only a
 * board. Teachers in the same school have both, so it is a per-activity choice
 * rather than a setting.
 */
export type ClassroomSetup = 'screen' | 'board';

/**
 * What an activity needs when the deck is projected instead of handed out.
 *
 * The generators' own materials list is the BOARD list — board, markers,
 * printed cards — because that is what these activities were written for. Run
 * on a screen, that list tells the teacher to print the very solutions the
 * app is already showing on the slide behind them, which is the complaint
 * this table answers.
 *
 * Explicit per activity rather than a keyword filter over the board list:
 * "strip anything printed" also strips the bingo card each student marks and
 * the exit ticket each student writes on, neither of which a screen replaces.
 * Every entry below therefore keeps the student's own artifact and drops only
 * what the slides genuinely take over — the teacher's printouts, the board
 * copy of a question, the physical timer the deck already runs.
 *
 * `gallery-walk` is deliberately absent: its five wall stations are the
 * activity, and a projector replaces none of them. It keeps its own materials
 * and simply gains the projector line, as does anything else not listed here.
 */
const SCREEN_SETUP: Record<string, { ar: string[]; en: string[]; prepAr: string; prepEn: string }> = {
  'error-detective': {
    ar: ['شاشة عرض أو جهاز عرض (بروجكتر)', 'دفاتر الطلاب', 'أقلام تصحيح حمراء'],
    en: ['Projector or screen', 'Student notebooks', 'Red correction pens'],
    prepAr: 'اعرض كل حل خاطئ من الشرائح. اطلب من الطلاب العمل في ثنائيات وتدوين التصحيح في دفاترهم.',
    prepEn: 'Show each faulty solution from the slides. Students work in pairs and write the correction in their notebooks.',
  },
  'escape-challenge': {
    ar: ['شاشة عرض أو جهاز عرض (بروجكتر)', 'ورقة وقلم لكل مجموعة'],
    en: ['Projector or screen', 'Paper and pen per group'],
    prepAr: 'اعرض التحديات من الشرائح بالترتيب. رتّب الطلاب في مجموعات من 3-4 أفراد، ويظهر كل كود على الشاشة عند حلّ التحدي.',
    prepEn: 'Run the challenges from the slides in order. Arrange groups of 3-4; each code appears on screen as its challenge is solved.',
  },
  // The bingo card each student marks stays — a screen does not replace it.
  // The caller list and the physical timer do: both are on the slides.
  bingo: {
    ar: ['شاشة عرض أو جهاز عرض (بروجكتر)', 'بطاقات بينجو مطبوعة (بطاقة لكل طالب)', 'قصاصات ورقية للتغطية'],
    en: ['Projector or screen', 'Printed bingo cards (one per student)', 'Paper scraps for covering squares'],
    prepAr: 'اطبع بطاقة بينجو لكل طالب فقط. تُستدعى المسائل من الشرائح بالترتيب، والمؤقت يعمل على الشاشة.',
    prepEn: 'Print only the per-student bingo cards. Problems are called from the slides in order and the timer runs on screen.',
  },
  // Each team still writes on and passes one relay sheet; the problems and the
  // countdown come off the slides, so the board copy and the timer go.
  relay: {
    ar: ['شاشة عرض أو جهاز عرض (بروجكتر)', 'ورقة تتابع واحدة لكل فريق', 'أقلام ملونة (لون لكل فريق)'],
    en: ['Projector or screen', 'One relay sheet per team', 'Coloured markers (one per team)'],
    prepAr: 'اعرض مسائل التتابع من الشرائح. وزّع ورقة تتابع واحدة لكل فريق يمرّرها الطلاب بينهم، والمؤقت يعمل على الشاشة.',
    prepEn: 'Show the relay problems from the slides. Give each team one sheet to pass along; the timer runs on screen.',
  },
  // The questions come off the slide, so nothing needs printing — but the
  // teacher still collects a slip per student at the door.
  'exit-ticket': {
    ar: ['شاشة عرض أو جهاز عرض (بروجكتر)', 'ورقة صغيرة لكل طالب (لا تحتاج طباعة)', 'قلم'],
    en: ['Projector or screen', 'A small slip of paper per student (nothing to print)', 'Pen'],
    prepAr: 'اعرض أسئلة بطاقة الخروج من الشريحة. يكتب كل طالب إجابته على ورقة صغيرة ويسلّمها عند الباب.',
    prepEn: 'Show the exit-ticket questions on the slide. Each student writes their answers on a slip and hands it in at the door.',
  },
};

const PROJECTOR_AR = 'شاشة عرض أو جهاز عرض (بروجكتر)';
const PROJECTOR_EN = 'Projector or screen';
const BOARD_AR = 'السبورة';
const BOARD_EN = 'Whiteboard';

/** Matches a materials line whose subject is the projector itself. */
const PROJECTOR_LINE = /شاشة|بروجكتر|جهاز عرض|projector|screen/i;

/**
 * Matches a materials line that names a screen but is really about something
 * else the teacher still needs — a mini-whiteboard, a phone, a tablet.
 * Without this, «ألواح صغيرة (شاشة اختيارية)» would be dropped from a
 * board-only room along with the projector.
 */
const NOT_ONLY_A_PROJECTOR = /لوح|ألواح|whiteboard|mini|هاتف|phone|tablet|لوحي/i;

/**
 * Board-only rooms: drop the lines that are purely about a projector.
 *
 * Narrow on purpose. The rest of the list is untouched, because "no screen" is
 * what these activities were authored for and must never quietly lose
 * something the teacher is about to need. But a teacher who just answered
 * "board only" and is then handed «شاشة عرض» as a required material has been
 * told the setting did nothing — which is exactly what it did before this.
 */
function stripProjector(materials: string[], isAr: boolean): string[] {
  const kept = materials.filter(m => !PROJECTOR_LINE.test(m) || NOT_ONLY_A_PROJECTOR.test(m));
  if (kept.length === materials.length) return materials;
  // Removing the projector can leave an activity whose questions now have
  // nowhere to appear, so name the board unless the list already does.
  return kept.some(namesClassBoard) ? kept : [isAr ? BOARD_AR : BOARD_EN, ...kept];
}

/**
 * Whether a materials line names the class board the teacher writes on.
 *
 * The mini-whiteboard exclusion is the point: «ألواح صغيرة» / "mini
 * whiteboards" are what each student holds up, so a list containing only
 * those still needs the class board added, not skipped.
 */
function namesClassBoard(m: string): boolean {
  if (/mini|صغير/i.test(m)) return false;
  return /السبورة|whiteboard|blackboard|\bboard\b/i.test(m);
}

/**
 * Student-facing copy that points at a screen the room does not have.
 *
 * Applied to intro slides only — those carry the rules a class reads together
 * ("each challenge has a timer on screen"). Question and challenge slides hold
 * the maths itself, and rewriting those would edit content, not staging.
 */
const BOARD_SLIDE_COPY_AR: [RegExp, string][] = [
  [/يظهر على الشاشة/g, 'يعلنه معلّمك'],
  [/تظهر على الشاشة/g, 'يعلنها معلّمك'],
  [/على الشاشة/g, 'على السبورة'],
];

const BOARD_SLIDE_COPY_EN: [RegExp, string][] = [
  [/\bon (?:the )?screen\b/gi, 'announced by your teacher'],
];

function boardSlideContent(content: string, isAr: boolean): string {
  const rules = isAr ? BOARD_SLIDE_COPY_AR : BOARD_SLIDE_COPY_EN;
  return rules.reduce((out, [pattern, to]) => out.replace(pattern, to), content);
}

/**
 * Retunes a generated activity for the room it will run in.
 *
 * Screen mode swaps in the projector materials table above. Board mode drops
 * the projector from the materials and rewrites intro-slide copy that tells
 * students to watch a screen — everything else the generator wrote is kept,
 * because the board is what these activities were authored for.
 */
export function applyClassroomSetup<
  T extends {
    activityType: string;
    materials: string[];
    teacherPreparation: string;
    slides?: { type?: string; content?: string }[];
  },
>(activity: T, setup: ClassroomSetup, isAr: boolean): T {
  // `materials` and `slides` are model output and the server's usability check
  // does not require the former — REQUIRED_FIELDS['classroom-activity'] is
  // activityName + slides only. A generation that omits it used to reach
  // `.some` on undefined and throw here, which the builder reports as «تعذر
  // إتمام العملية»: a complete, usable deck discarded on its way to the screen
  // over a cosmetic field.
  const materials = Array.isArray(activity.materials) ? activity.materials : [];

  if (setup === 'board') {
    const board = { ...activity, materials: stripProjector(materials, isAr) };
    // Assigned only when there are slides: spreading `slides: undefined` onto
    // a deck that never had the key materializes it, and a caller that asks
    // whether the field is present then gets a different answer than it did
    // before this function ran.
    if (Array.isArray(activity.slides)) {
      board.slides = activity.slides.map(s =>
        s?.type === 'intro' && typeof s.content === 'string'
          ? { ...s, content: boardSlideContent(s.content, isAr) }
          : s,
      );
    }
    return board;
  }

  const override = SCREEN_SETUP[activity.activityType];
  if (override) {
    return {
      ...activity,
      materials: isAr ? override.ar : override.en,
      teacherPreparation: isAr ? override.prepAr : override.prepEn,
    };
  }
  const projector = isAr ? PROJECTOR_AR : PROJECTOR_EN;
  const alreadyThere = materials.some(m => PROJECTOR_LINE.test(m));
  return alreadyThere
    ? { ...activity, materials }
    : { ...activity, materials: [projector, ...materials] };
}
