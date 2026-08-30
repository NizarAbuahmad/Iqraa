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
 * Anything not listed here keeps its own materials and simply gains the
 * projector line.
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
};

const PROJECTOR_AR = 'شاشة عرض أو جهاز عرض (بروجكتر)';
const PROJECTOR_EN = 'Projector or screen';

/**
 * Retunes a generated activity for the room it will run in.
 *
 * Board mode returns the activity untouched: the generators (and the model
 * prompt) already write for a board, so "no screen" is today's behaviour and
 * carries no risk of losing something the teacher needs.
 */
export function applyClassroomSetup<
  T extends { activityType: string; materials: string[]; teacherPreparation: string },
>(activity: T, setup: ClassroomSetup, isAr: boolean): T {
  if (setup !== 'screen') return activity;
  const override = SCREEN_SETUP[activity.activityType];
  if (override) {
    return {
      ...activity,
      materials: isAr ? override.ar : override.en,
      teacherPreparation: isAr ? override.prepAr : override.prepEn,
    };
  }
  const projector = isAr ? PROJECTOR_AR : PROJECTOR_EN;
  // `materials` is model output and the server's usability check does not
  // require it — REQUIRED_FIELDS['classroom-activity'] is activityName + slides
  // only. A generation that omits it used to reach `.some` on undefined and
  // throw here, which the builder reports as «تعذر إتمام العملية»: a complete,
  // usable deck discarded on its way to the screen over a cosmetic field.
  const materials = Array.isArray(activity.materials) ? activity.materials : [];
  const alreadyThere = materials.some(m => /شاشة|بروجكتر|projector|screen/i.test(m));
  return alreadyThere
    ? activity
    : { ...activity, materials: [projector, ...materials] };
}

