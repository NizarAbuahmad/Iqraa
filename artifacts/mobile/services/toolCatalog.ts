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

export interface ToolDef {
  id: string;
  titleKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route?: string;
  routeParams?: Record<string, string>;
  badgeKey?: string;
  /** External tool (e.g. GeoGebra) — opens browser instead of in-app route. */
  externalAction?: 'geogebra-graphing';
  /** Hide from non-math surfaces when we add subject filtering later. */
  mathOnly?: boolean;
}

export type WorkflowSection = {
  id: string;
  titleKey: string;
  tools: ToolDef[];
};

/** Core teaching jobs — ordered by when teachers use them. */
export const BEFORE_CLASS: ToolDef[] = [
  // Pinned first: teachers build slides as prep, even though they're
  // projected during class — leading with it surfaces the newest tool on
  // both the tools tab and the chat "+" menu, which render sections in
  // WORKFLOW order.
  {
    id: 'slides',
    titleKey: 'toolSlidesTitle',
    descKey: 'toolSlidesDesc',
    icon: 'tv-outline',
    color: '#0EA5E9',
    route: '/ai-tools/slides',
  },
  {
    id: 'lesson-plan',
    titleKey: 'toolLessonPlanTitle',
    descKey: 'toolLessonPlanDesc',
    icon: 'document-text-outline',
    color: '#1B6B62',
    route: '/ai-tools/lesson-plan',
  },
  {
    id: 'simplify',
    titleKey: 'simplifyExplanationTitle',
    descKey: 'simplifyExplanationSubtitle',
    icon: 'bulb-outline',
    color: '#00A99D',
    route: '/ai-tools/lesson-plan',
    routeParams: { simplify: '1' },
  },
  // Generates the whole lesson journey in one pass, so it belongs with prep
  // rather than in a drawer of leftovers.
  {
    id: 'lesson-flow',
    titleKey: 'toolLessonFlowTitle',
    descKey: 'toolLessonFlowSub',
    icon: 'git-branch-outline',
    color: '#0EA5E9',
    route: '/ai-tools/lesson-flow',
  },
];

// Overlaps with Slides Maker and Class Challenge — all three end in the same
// presentation player. Kept because it carries activity formats the other two
// do not (bingo, relay, gallery walk), but it is the obvious candidate if the
// three entry points ever need collapsing into one.
const CLASSROOM_HUB: ToolDef = {
  id: 'classroom',
  titleKey: 'toolClassroomTitle',
  descKey: 'toolClassroomDesc',
  icon: 'grid-outline',
  color: '#4F46E5',
  route: '/ai-tools/classroom',
};

export const DURING_CLASS: ToolDef[] = [
  {
    id: 'game',
    titleKey: 'toolGameTitle',
    descKey: 'toolGameDesc',
    icon: 'trophy-outline',
    color: '#F59E0B',
    route: '/ai-tools/game',
  },
  {
    id: 'activity',
    titleKey: 'toolActivityTitle',
    descKey: 'toolActivityDesc',
    icon: 'people-outline',
    color: '#E67E22',
    route: '/ai-tools/activity',
  },
  {
    id: 'geogebra',
    titleKey: 'toolGeogebraTitle',
    descKey: 'toolGeogebraDesc',
    icon: 'analytics-outline',
    color: '#990000',
    badgeKey: 'toolGeogebraBadge',
    externalAction: 'geogebra-graphing',
    mathOnly: true,
  },
  {
    id: 'worksheet',
    titleKey: 'toolWorksheetTitle',
    descKey: 'toolWorksheetDesc',
    icon: 'list-outline',
    color: '#0E8F86',
    route: '/ai-tools/worksheet',
  },
  CLASSROOM_HUB,
  // The retired home screen, now named for the only two things it still
  // uniquely does: attaching media to the current lesson (which becomes deck
  // slides in Class Mode) and Smart Templates. It used to hide behind a card
  // labelled "أدوات إضافية / useful when you need them", which told a teacher
  // nothing and quietly dropped them onto an old screen.
  {
    id: 'lesson-media',
    titleKey: 'toolLessonMediaTitle',
    descKey: 'toolLessonMediaDesc',
    icon: 'images-outline',
    color: '#6366F1',
    route: '/home',
  },
];

export const AFTER_CLASS: ToolDef[] = [
  {
    id: 'quiz',
    titleKey: 'toolQuizTitle',
    descKey: 'toolQuizDesc',
    icon: 'checkmark-circle-outline',
    color: '#F59E0B',
    route: '/ai-tools/quiz',
  },
  {
    id: 'homework',
    titleKey: 'toolHomeworkTitle',
    descKey: 'toolHomeworkDesc',
    icon: 'home-outline',
    color: '#1B6B62',
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
    icon: 'clipboard-outline',
    color: '#64748B',
    route: '/evaluations',
  },
  {
    id: 'parent-msg',
    titleKey: 'toolParentMsgTitle',
    descKey: 'toolParentMsgDesc',
    icon: 'mail-outline',
    color: '#8B5CF6',
    route: '/ai-tools/parent-message',
  },
];

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
