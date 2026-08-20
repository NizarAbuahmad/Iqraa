/**
 * Homepage AI creation catalog — tools, templates, chips, and routing helpers.
 * Investor MVP: only enabled tools are visible; others stay registered as coming_soon.
 */

export type GeneratorRoute =
  | '/ai-tools/lesson-plan'
  | '/ai-tools/worksheet'
  | '/ai-tools/quiz'
  | '/ai-tools/activity'
  | '/ai-tools/lesson-flow'
  | '/ai-tools/classroom';

export type HomeToolId =
  | 'lesson-plan'
  | 'worksheet'
  | 'quiz'
  | 'homework'
  | 'activity'
  | 'simplify'
  | 'bloom'
  | 'formative'
  | 'rubric'
  | 'exit-ticket'
  | 'summary'
  | 'learning-objectives'
  | 'game'
  | 'video'
  | 'stem'
  | 'differentiated'
  | 'discussion'
  | 'test-review';

export type ToolStatus = 'enabled' | 'coming_soon';

export type HomeToolDef = {
  id: HomeToolId;
  emoji: string;
  labelAr: string;
  labelEn: string;
  route: GeneratorRoute;
  /** Investor MVP visibility — coming_soon tools stay registered but hidden */
  status: ToolStatus;
  enabled: boolean;
  /** Prefixed into topic so Demo Mode generators stay contextual */
  topicHintAr?: string;
  topicHintEn?: string;
  homework?: boolean;
  simplify?: boolean;
};

/** Primary tools in teaching-workflow order (before → during → after). */
export const PRIMARY_TOOL_ORDER: HomeToolId[] = [
  'lesson-plan',
  'simplify',
  'activity',
  'worksheet',
  'quiz',
  'homework',
];

export const HOME_AI_TOOLS: HomeToolDef[] = [
  // ── Before class ────────────────────────────────────────────────────────
  {
    id: 'lesson-plan', emoji: '📘', labelAr: 'خطة درس', labelEn: 'Lesson plan',
    route: '/ai-tools/lesson-plan', status: 'enabled', enabled: true,
  },
  {
    id: 'simplify', emoji: '💡', labelAr: 'تبسيط الشرح', labelEn: 'Simplify explanation',
    route: '/ai-tools/lesson-plan', status: 'enabled', enabled: false,
    simplify: true,
    topicHintAr: 'تبسيط الشرح',
    topicHintEn: 'Simplify explanation',
  },
  // ── During class ────────────────────────────────────────────────────────
  {
    id: 'activity', emoji: '🎯', labelAr: 'نشاط صفي', labelEn: 'Class activity',
    route: '/ai-tools/activity', status: 'enabled', enabled: false,
  },
  {
    id: 'worksheet', emoji: '📝', labelAr: 'ورقة عمل', labelEn: 'Worksheet',
    route: '/ai-tools/worksheet', status: 'enabled', enabled: true,
  },
  // ── After class ─────────────────────────────────────────────────────────
  {
    id: 'quiz', emoji: '✅', labelAr: 'اختبار قصير', labelEn: 'Short quiz',
    route: '/ai-tools/quiz', status: 'enabled', enabled: true,
  },
  {
    id: 'homework', emoji: '🏠', labelAr: 'واجب منزلي', labelEn: 'Homework',
    route: '/ai-tools/worksheet', status: 'enabled', enabled: false, homework: true,
  },

  // ── Coming soon (hidden — do not delete) ────────────────────────────────
  {
    id: 'bloom', emoji: '🧠', labelAr: 'أسئلة بلوم', labelEn: 'Bloom questions',
    route: '/ai-tools/quiz', status: 'coming_soon', enabled: false,
    topicHintAr: 'أسئلة حسب مستويات بلوم', topicHintEn: 'Bloom taxonomy questions',
  },
  {
    id: 'learning-objectives', emoji: '🎓', labelAr: 'أهداف تعلم', labelEn: 'Learning objectives',
    route: '/ai-tools/lesson-plan', status: 'coming_soon', enabled: false,
    topicHintAr: 'أهداف التعلم', topicHintEn: 'Learning objectives',
  },
  {
    id: 'formative', emoji: '📊', labelAr: 'تقييم تكويني', labelEn: 'Formative assessment',
    route: '/ai-tools/quiz', status: 'coming_soon', enabled: false,
    topicHintAr: 'تقييم تكويني', topicHintEn: 'Formative assessment',
  },
  {
    id: 'rubric', emoji: '📋', labelAr: 'سلم تقدير', labelEn: 'Rubric',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'سلم تقدير (Rubric)', topicHintEn: 'Assessment rubric',
  },
  {
    id: 'exit-ticket', emoji: '🎫', labelAr: 'بطاقة خروج', labelEn: 'Exit Ticket',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'بطاقة خروج', topicHintEn: 'Exit ticket',
  },
  {
    id: 'summary', emoji: '📖', labelAr: 'ملخص الدرس', labelEn: 'Lesson summary',
    route: '/ai-tools/lesson-plan', status: 'coming_soon', enabled: false,
    topicHintAr: 'ملخص الدرس', topicHintEn: 'Lesson summary',
  },
  {
    id: 'game', emoji: '🎮', labelAr: 'لعبة تعليمية', labelEn: 'Learning game',
    route: '/ai-tools/classroom', status: 'coming_soon', enabled: false,
  },
  {
    id: 'video', emoji: '🎥', labelAr: 'فكرة فيديو', labelEn: 'Video idea',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'فكرة فيديو تعليمي', topicHintEn: 'Educational video idea',
  },
  {
    id: 'stem', emoji: '🔬', labelAr: 'نشاط STEM', labelEn: 'STEM activity',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'نشاط STEM', topicHintEn: 'STEM activity',
  },
  {
    id: 'differentiated', emoji: '👥', labelAr: 'نشاط متمايز', labelEn: 'Differentiated activity',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'نشاط متمايز', topicHintEn: 'Differentiated activity',
  },
  {
    id: 'discussion', emoji: '💬', labelAr: 'أسئلة نقاش', labelEn: 'Discussion questions',
    route: '/ai-tools/activity', status: 'coming_soon', enabled: false,
    topicHintAr: 'أسئلة نقاش', topicHintEn: 'Discussion questions',
  },
  {
    id: 'test-review', emoji: '🧩', labelAr: 'مراجعة قبل الاختبار', labelEn: 'Test review',
    route: '/ai-tools/quiz', status: 'coming_soon', enabled: false,
    topicHintAr: 'مراجعة قبل الاختبار', topicHintEn: 'Pre-test review',
  },
];

export function isToolEnabled(id: HomeToolId | string): boolean {
  const tool = HOME_AI_TOOLS.find(t => t.id === id);
  return !!tool?.enabled;
}

export function getVisibleHomeTools(): HomeToolDef[] {
  const enabled = HOME_AI_TOOLS.filter(t => t.enabled && t.status === 'enabled');
  return PRIMARY_TOOL_ORDER
    .map(id => enabled.find(t => t.id === id))
    .filter((t): t is HomeToolDef => !!t);
}

/** Compact suggestion chips under the hero prompt — workflow order. */
export const HERO_SUGGESTIONS: { id: HomeToolId; emoji: string; labelAr: string; labelEn: string; enabled: boolean }[] = [
  { id: 'lesson-plan', emoji: '📘', labelAr: 'خطة درس', labelEn: 'Lesson plan', enabled: true },
  { id: 'simplify', emoji: '💡', labelAr: 'تبسيط الشرح', labelEn: 'Simplify explanation', enabled: true },
  { id: 'activity', emoji: '🎯', labelAr: 'نشاط صفي', labelEn: 'Class activity', enabled: true },
  { id: 'worksheet', emoji: '📝', labelAr: 'ورقة عمل', labelEn: 'Worksheet', enabled: true },
  { id: 'quiz', emoji: '✅', labelAr: 'اختبار قصير', labelEn: 'Short quiz', enabled: true },
  { id: 'homework', emoji: '🏠', labelAr: 'واجب منزلي', labelEn: 'Homework', enabled: true },
  // Hidden until fully implemented
  { id: 'bloom', emoji: '🧠', labelAr: 'أسئلة بلوم', labelEn: 'Bloom questions', enabled: false },
  { id: 'learning-objectives', emoji: '🎓', labelAr: 'أهداف تعلم', labelEn: 'Learning objectives', enabled: false },
];

export function getVisibleHeroSuggestions() {
  return HERO_SUGGESTIONS.filter(s => s.enabled && isToolEnabled(s.id));
}

export type PromptChip = {
  id: string;
  labelAr: string;
  labelEn: string;
  promptAr: string;
  promptEn: string;
  enabled: boolean;
};

export const PROMPT_CHIPS: PromptChip[] = [
  { id: 'act', labelAr: 'أنشئ نشاطاً', labelEn: 'Create an activity', promptAr: 'أنشئ نشاطاً صفياً عن', promptEn: 'Create a class activity about', enabled: true },
  { id: 'quiz', labelAr: 'أنشئ اختباراً', labelEn: 'Create a quiz', promptAr: 'أنشئ اختباراً قصيراً عن', promptEn: 'Create a short quiz about', enabled: true },
  { id: 'simplify', labelAr: 'بسّط الشرح', labelEn: 'Simplify', promptAr: 'بسّط شرح', promptEn: 'Simplify the explanation of', enabled: true },
  { id: 'real', labelAr: 'اربطه بالواقع', labelEn: 'Real-life example', promptAr: 'أعطني مثالاً من الواقع عن', promptEn: 'Give me a real-life example of', enabled: true },
  { id: 'hw', labelAr: 'أنشئ واجباً', labelEn: 'Create homework', promptAr: 'أنشئ واجباً منزلياً عن', promptEn: 'Create homework about', enabled: true },
  { id: 'hook', labelAr: 'افتتح الحصة', labelEn: 'Opening activity', promptAr: 'اقترح نشاطاً افتتاحياً عن', promptEn: 'Suggest an opening activity for', enabled: true },
  // Hidden until fully implemented
  { id: 'bloom', labelAr: 'أضف أسئلة بلوم', labelEn: 'Add Bloom questions', promptAr: 'أضف أسئلة بلوم عن', promptEn: 'Add Bloom taxonomy questions about', enabled: false },
  { id: 'review', labelAr: 'راجع المحتوى', labelEn: 'Review content', promptAr: 'راجع محتوى درس', promptEn: 'Review the lesson content for', enabled: false },
];

export function getVisiblePromptChips() {
  return PROMPT_CHIPS.filter(c => c.enabled);
}

export type SmartTemplate = {
  id: string;
  labelAr: string;
  labelEn: string;
  toolId: HomeToolId;
  topicHintAr: string;
  topicHintEn: string;
  enabled: boolean;
};

export const SMART_TEMPLATES: SmartTemplate[] = [
  // Core workflow starters
  { id: 'lp45', labelAr: 'خطة درس 45 دقيقة', labelEn: '45-min lesson plan', toolId: 'lesson-plan', topicHintAr: 'خطة درس 45 دقيقة', topicHintEn: '45-minute lesson plan', enabled: true },
  { id: 'simplify', labelAr: 'تبسيط الشرح', labelEn: 'Simplify explanation', toolId: 'simplify', topicHintAr: 'تبسيط الشرح', topicHintEn: 'Simplify explanation', enabled: true },
  { id: 'opener', labelAr: 'نشاط افتتاحي', labelEn: 'Opening activity', toolId: 'activity', topicHintAr: 'نشاط افتتاحي', topicHintEn: 'Opening warm-up activity', enabled: true },
  { id: 'remedial', labelAr: 'ورقة عمل صفية', labelEn: 'Class worksheet', toolId: 'worksheet', topicHintAr: 'ورقة عمل صفية', topicHintEn: 'In-class worksheet', enabled: true },
  { id: 'short-quiz', labelAr: 'اختبار قصير', labelEn: 'Short quiz', toolId: 'quiz', topicHintAr: 'اختبار قصير', topicHintEn: 'Short quiz', enabled: true },
  { id: 'hw-pack', labelAr: 'واجب منزلي', labelEn: 'Homework set', toolId: 'homework', topicHintAr: 'واجب منزلي', topicHintEn: 'Homework assignment', enabled: true },
  // Specialized — keep registered, hide from primary “start fast” strip
  { id: 'collab', labelAr: 'تعلم تعاوني', labelEn: 'Collaborative learning', toolId: 'activity', topicHintAr: 'تعلم تعاوني', topicHintEn: 'Collaborative learning activity', enabled: false },
  { id: 'pretest', labelAr: 'مراجعة قبل الاختبار', labelEn: 'Pre-test review', toolId: 'test-review', topicHintAr: 'مراجعة قبل الاختبار', topicHintEn: 'Pre-test review', enabled: false },
  { id: 'stem', labelAr: 'درس STEM', labelEn: 'STEM Lesson', toolId: 'stem', topicHintAr: 'درس STEM', topicHintEn: 'STEM lesson', enabled: false },
];

export function getVisibleSmartTemplates() {
  return SMART_TEMPLATES.filter(t => t.enabled && isToolEnabled(t.toolId));
}

/** Related resources shown after a successful generation (enabled tools only). */
export const RELATED_BY_TOOL: Record<string, HomeToolId[]> = {
  'lesson-plan': ['simplify', 'activity', 'worksheet', 'quiz', 'homework'],
  simplify: ['lesson-plan', 'activity', 'worksheet'],
  activity: ['worksheet', 'quiz', 'homework'],
  worksheet: ['activity', 'quiz', 'homework'],
  quiz: ['homework', 'worksheet', 'activity'],
  homework: ['quiz', 'worksheet'],
  default: ['lesson-plan', 'simplify', 'activity', 'worksheet', 'quiz', 'homework'],
};

export function getRelatedToolIds(toolId: string): HomeToolId[] {
  const list = RELATED_BY_TOOL[toolId] ?? RELATED_BY_TOOL.default;
  return list.filter(id => isToolEnabled(id));
}

export function getToolById(id: HomeToolId): HomeToolDef {
  return HOME_AI_TOOLS.find(t => t.id === id) ?? HOME_AI_TOOLS[0];
}

export function buildTopicForTool(
  baseTopic: string,
  tool: HomeToolDef,
  lang: 'ar' | 'en',
): string {
  const hint = lang === 'ar' ? tool.topicHintAr : tool.topicHintEn;
  const base = baseTopic.trim();
  if (!hint) return base;
  if (!base) return hint;
  if (base.includes(hint)) return base;
  // Avoid nesting "تبسيط الشرح: تبسيط الشرح: …"
  if (tool.simplify) {
    const stripped = base
      .replace(/^(تبسيط\s*الشرح|بسّط\s*الشرح|بسط\s*الشرح|simplify(\s+explanation)?)\s*[:：\-]?\s*/i, '')
      .trim();
    return lang === 'ar' ? `تبسيط الشرح: ${stripped || base}` : `Simplify explanation: ${stripped || base}`;
  }
  return `${hint}: ${base}`;
}

export function inferToolFromPrompt(prompt: string): HomeToolId {
  const p = prompt.toLowerCase();
  if (/واجب|homework|hw/.test(p)) return 'homework';
  if (/ورقة|worksheet/.test(p)) return 'worksheet';
  if (/اختبار|quiz|test|exam/.test(p)) return 'quiz';
  if (/بسّط|بسط|simplify|تبسيط/.test(p)) return 'simplify';
  if (/نشاط|activity|افتتاح/.test(p)) return 'activity';
  // Coming-soon intents fall back to closest enabled tool
  if (/بلوم|bloom/.test(p)) return 'quiz';
  if (/stem/.test(p)) return 'activity';
  if (/rubric|سلم/.test(p)) return 'activity';
  if (/exit|خروج/.test(p)) return 'quiz';
  if (/أهداف|اهداف|objectives/.test(p)) return 'lesson-plan';
  if (/خطة|lesson\s*plan|خطة درس/.test(p)) return 'lesson-plan';
  return 'lesson-plan';
}

export function extractLessonTopic(prompt: string, fallback: string): string {
  const cleaned = prompt
    .replace(/^(أنشئ|انشئ|اصنع|اعمل|create|make|generate|build)\s+/i, '')
    .replace(/^(خطة\s*درس|ورقة\s*عمل|اختبار(?:اً|ا)?\s*قصيرا?|واجبا?(?:\s*منزليا?)?|نشاطا?(?:\s*صفيا?)?|تبسيط\s*الشرح|بسّط\s*الشرح|lesson\s*plan|worksheet|quiz|homework|activity|simplify(\s+explanation)?)\s*(عن|حول|on|about|for)?\s*/i, '')
    .trim();
  return cleaned || fallback;
}

export type GeneratorNav = {
  pathname: GeneratorRoute;
  params: Record<string, string>;
};

export function buildGeneratorNav(
  toolId: HomeToolId,
  lessonTopic: string,
  lang: 'ar' | 'en',
): GeneratorNav {
  const tool = getToolById(toolId);
  // Never navigate to a coming_soon tool from the investor UI
  const resolved = tool.enabled ? tool : getToolById('lesson-plan');
  const topic = buildTopicForTool(lessonTopic, resolved, lang);
  const params: Record<string, string> = {};
  if (topic) params.topic = topic;
  if (resolved.homework) params.isHomework = '1';
  if (resolved.simplify) params.simplify = '1';
  return { pathname: resolved.route, params };
}
