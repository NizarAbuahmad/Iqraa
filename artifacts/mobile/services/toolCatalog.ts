/**
 * The teaching-tool catalog — one list, two surfaces.
 *
 * These definitions used to live inside the AI Tools screen. The chat composer
 * now offers the same tools from its "+" menu, and two hand-maintained copies
 * of a product's tool list drift: a tool added to one surface quietly does not
 * exist on the other. Screens decide what tapping a tool *does* (chat generates
 * inline, the tools tab navigates); this file only says what the tools are.
 */
import type { Ionicons } from '@expo/vector-icons';
import { conceptOf, type ConceptId } from '../constants/icons.ts';
import type { GlyphId } from '../constants/glyphs.ts';

export interface ToolDef {
  id: string;
  titleKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Iqraa's own drawing, when the concept has one; drawn by `ConceptIcon`. */
  glyph?: GlyphId;
  color: string;
  route?: string;
  routeParams?: Record<string, string>;
  badgeKey?: string;
  /** External tool (e.g. GeoGebra) — opens browser instead of in-app route. */
  externalAction?: 'geogebra-graphing';
  /** Hide from non-math surfaces when we add subject filtering later. */
  mathOnly?: boolean;
  /**
   * Kept in the catalog but off both menus (2026-08-18). The pilot is
   * focusing on the five tools that carry the product — slides, lesson plan,
   * worksheet, quiz, evaluations — so the rest are parked rather than
   * deleted: their routes still resolve, so saved materials and deep links
   * keep working, and unhiding is deleting one line.
   *
   * The mirror of this lives in `homeAiTools.ts` (`enabled: false`), which
   * drives the related-tools panel and hero chips. Hiding here alone would
   * leave those still pointing teachers at parked tools.
   */
  hidden?: boolean;
  /**
   * Not its own card on the Tools tab (2026-10-18): it is reached through
   * another tool's card. Every other surface (chat "+" menu, home, command
   * palette, help) still lists it, so this is narrower than `hidden`.
   */
  tabHidden?: boolean;
  /** What the Tools-tab card says when it differs from the tool's own name. */
  tabTitleKey?: string;
  tabDescKey?: string;
}

export type WorkflowSection = {
  id: string;
  titleKey: string;
  tools: ToolDef[];
};

/**
 * A tool's icon and colour are its concept's (`constants/icons.ts`), the same
 * pair the prep board draws, so the quiz is one icon in one colour wherever a
 * teacher meets it. `iconSystem.test.ts` fails a literal colour in this file.
 */
const look = (concept: ConceptId): Pick<ToolDef, 'icon' | 'color' | 'glyph'> => {
  const c = conceptOf(concept);
  return { icon: c.icon, color: c.color, ...(c.glyph ? { glyph: c.glyph } : {}) };
};

/** Core teaching jobs — ordered by when teachers use them. */
const BEFORE_CLASS_ALL: ToolDef[] = [
  // Pinned first: teachers build slides as prep, even though they're
  // projected during class — leading with it surfaces the newest tool on
  // both the tools tab and the chat "+" menu, which render sections in
  // WORKFLOW order.
  {
    id: 'slides',
    titleKey: 'toolSlidesTitle',
    descKey: 'toolSlidesDesc',
    ...look('slides'),
    route: '/ai-tools/slides',
  },
  // Folded into Lesson slides as a link (2026-09-24): two cards, one output.
  {
    id: 'prompt-slides',
    hidden: true,
    titleKey: 'toolPromptSlidesTitle',
    descKey: 'toolPromptSlidesDesc',
    ...look('prompt-slides'),
    route: '/ai-tools/prompt-slides',
  },
  {
    id: 'lesson-plan',
    titleKey: 'toolLessonPlanTitle',
    descKey: 'toolLessonPlanDesc',
    ...look('lesson-plan'),
    route: '/ai-tools/lesson-plan',
  },
  // Generates the whole lesson journey in one pass, so it belongs with prep
  // rather than in a drawer of leftovers.
  {
    id: 'lesson-flow',
    hidden: true,
    titleKey: 'toolLessonFlowTitle',
    descKey: 'toolLessonFlowSub',
    ...look('lesson-flow'),
    route: '/ai-tools/lesson-flow',
  },
];

// Overlaps with Slides Maker and Class Challenge — all three end in the same
// presentation player, and it is still the obvious candidate if the three entry
// points ever need collapsing into one. Un-parked 2026-08-25 anyway: it is the
// only door to the escape / bingo / relay / gallery-walk formats, and with it
// hidden those were reachable only by typing the URL. Nobody found them.
const CLASSROOM_HUB: ToolDef = {
  id: 'classroom',
  titleKey: 'toolClassroomTitle',
  descKey: 'toolClassroomDesc',
  ...look('classroom'),
  route: '/ai-tools/classroom',
};

const DURING_CLASS_ALL: ToolDef[] = [
  {
    id: 'worksheet',
    titleKey: 'toolWorksheetTitle',
    descKey: 'toolWorksheetDesc',
    ...look('worksheet'),
    route: '/ai-tools/worksheet',
  },
  CLASSROOM_HUB,
  {
    id: 'game',
    titleKey: 'toolGameTitle',
    descKey: 'toolGameDesc',
    ...look('challenge'),
    route: '/ai-tools/game',
  },
  {
    id: 'activity',
    titleKey: 'toolActivityTitle',
    descKey: 'toolActivityDesc',
    ...look('activity'),
    route: '/ai-tools/activity',
  },
  // The public, no-login games hub (app/play) — a share-with-students link,
  // not a generator. Linked here so a signed-in teacher can find it without
  // already knowing the URL; the page itself still works for anyone.
  {
    id: 'games',
    titleKey: 'toolGamesTitle',
    descKey: 'toolGamesDesc',
    ...look('games'),
    route: '/play',
  },
  {
    id: 'geogebra',
    hidden: true,
    titleKey: 'toolGeogebraTitle',
    descKey: 'toolGeogebraDesc',
    ...look('geogebra'),
    badgeKey: 'toolGeogebraBadge',
    externalAction: 'geogebra-graphing',
    mathOnly: true,
  },
];

const AFTER_CLASS_ALL: ToolDef[] = [
  {
    id: 'quiz',
    titleKey: 'toolQuizTitle',
    descKey: 'toolQuizDesc',
    ...look('quiz'),
    route: '/ai-tools/quiz',
    // One card for «ورقة للطباعة» and «تقييم يُرصد»: the quiz screen opens on
    // the paper and carries a switch to the evaluations list (see
    // `ExamKindSwitch`). Chat keeps the plain name — it only ever makes the paper.
    tabTitleKey: 'toolExamsTitle',
    tabDescKey: 'toolExamsDesc',
  },
  {
    id: 'homework',
    hidden: true,
    titleKey: 'toolHomeworkTitle',
    descKey: 'toolHomeworkDesc',
    ...look('homework'),
    route: '/ai-tools/worksheet',
    routeParams: { isHomework: '1' },
  },
  // Assessment is after-class work, and it is a full feature — it spent its
  // life collapsed inside a drawer labelled "extra", which is the opposite of
  // where a teacher looks for it.
  {
    id: 'evaluations',
    titleKey: 'evaluations',
    descKey: 'evaluationsSubtitle',
    ...look('evaluations'),
    route: '/evaluations',
    tabHidden: true,
  },
  {
    id: 'parent-msg',
    titleKey: 'toolParentMsgTitle',
    descKey: 'toolParentMsgDesc',
    ...look('parent-msg'),
    route: '/ai-tools/parent-message',
  },
];

/**
 * Both menus render the filtered lists, so parking a tool is one `hidden`
 * flag rather than an edit in every consuming screen. The unfiltered arrays
 * stay private — nothing should be iterating parked tools, and a screen that
 * wants one by id should route to it directly.
 */
const visible = (tools: ToolDef[]): ToolDef[] => tools.filter(t => !t.hidden);

export const BEFORE_CLASS: ToolDef[] = visible(BEFORE_CLASS_ALL);
export const DURING_CLASS: ToolDef[] = visible(DURING_CLASS_ALL);
export const AFTER_CLASS: ToolDef[] = visible(AFTER_CLASS_ALL);

// MORE_TOOLS is gone. It was a collapsed section holding four unrelated things
// — a live feature (evaluations), two working tools, and one dead stub — behind
// a disclosure a teacher had no reason to open. Everything moved into the stage
// where it is actually used; the stub became a real screen.

export const WORKFLOW: WorkflowSection[] = [
  { id: 'before', titleKey: 'toolsBeforeClass', tools: BEFORE_CLASS },
  { id: 'during', titleKey: 'toolsDuringClass', tools: DURING_CLASS },
  { id: 'after', titleKey: 'toolsAfterClass', tools: AFTER_CLASS },
];


/** Every tool, in the order a teacher meets them. */
export const ALL_TOOLS: ToolDef[] = [
  ...BEFORE_CLASS,
  ...DURING_CLASS,
  ...AFTER_CLASS,
];

/** The cards the Tools tab draws: `ALL_TOOLS` less the ones folded into another card. */
export const TAB_TOOLS: ToolDef[] = ALL_TOOLS.filter(t => !t.tabHidden);

/**
 * The tools the chat can carry out itself: tapping one sends a prompt and the
 * answer lands in the thread. Value is the artifact type chat generates.
 * `homework` is generable but parked in the catalog, so it never reaches the
 * menu — see `CHAT_MENU_TOOLS`.
 */
export const CHAT_NATIVE_TOOLS: Record<
  string,
  'lesson-plan' | 'worksheet' | 'quiz' | 'homework' | 'activity'
> = {
  'lesson-plan': 'lesson-plan',
  worksheet: 'worksheet',
  quiz: 'quiz',
  activity: 'activity',
  homework: 'homework',
};

/**
 * The chat composer's "+" menu. A "+" reads as "add something to this
 * message", so it lists only what the conversation answers itself. Everything
 * that opens another screen (slides, the class hub, the library, evaluations…)
 * lives on the Tools tab and the lesson card instead.
 */
export const CHAT_MENU_TOOLS: ToolDef[] = ALL_TOOLS.filter(t => CHAT_NATIVE_TOOLS[t.id]);
