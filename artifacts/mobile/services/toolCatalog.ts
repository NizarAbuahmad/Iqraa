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
];

export const DURING_CLASS: ToolDef[] = [
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
];

/** Secondary / specialized — available but not part of the core prep flow. */
export const MORE_TOOLS: ToolDef[] = [
  {
    id: 'classroom',
    titleKey: 'toolClassroomTitle',
    descKey: 'toolClassroomDesc',
    icon: 'tv-outline',
    color: '#4F46E5',
    route: '/ai-tools/classroom',
  },
  {
    id: 'lesson-flow',
    titleKey: 'toolLessonFlowTitle',
    descKey: 'toolLessonFlowSub',
    icon: 'git-branch-outline',
    color: '#0EA5E9',
    route: '/ai-tools/lesson-flow',
  },
  {
    id: 'parent-msg',
    titleKey: 'toolParentMsgTitle',
    descKey: 'toolParentMsgDesc',
    icon: 'mail-outline',
    color: '#8B5CF6',
    route: '/ai-tools/coming-soon',
    routeParams: { tool: 'parent-msg' },
    badgeKey: 'comingSoon',
  },
  {
    id: 'exam',
    titleKey: 'toolExamTitle',
    descKey: 'toolExamDesc',
    icon: 'school-outline',
    color: '#64748B',
    route: '/ai-tools/coming-soon',
    routeParams: { tool: 'exam' },
    badgeKey: 'comingSoon',
  },
];

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
  ...MORE_TOOLS,
];
