/**
 * Starters for the resources library: a tool opened with its settings already
 * chosen.
 *
 * A template is not content. It is a route plus the params that tool already
 * reads (`useLocalSearchParams` in each `app/ai-tools/*` screen), so adding one
 * costs a row here and nothing in the tool. The teacher still types the topic —
 * a starter fixes the shape of the thing, never what it is about.
 *
 * Grade and subject are deliberately NOT stored: those params are picker
 * *indices*, and an index baked in here would drift the moment the picker list
 * changes. `templateParams` adds them at tap time from whatever the library is
 * filtered to.
 *
 * Pure, for the same reason as `resourceCatalog.ts`: the mobile tests are bare
 * `node --test` with no React Native transform.
 */

export type TemplateTool = 'worksheet' | 'slides' | 'game' | 'activity';

export interface ResourceTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  tool: TemplateTool;
  /** Route params, exactly as the tool's screen reads them. */
  params: Record<string, string>;
}

export const TOOL_ROUTE: Record<TemplateTool, string> = {
  worksheet: '/ai-tools/worksheet',
  slides: '/ai-tools/slides',
  game: '/ai-tools/game',
  activity: '/ai-tools/activity',
};

// Index values below are positions in each screen's own option list:
// worksheet `NUM_Q_OPTIONS = [5, 8, 10, 12, 15, 20]`, difficulty
// [normal, high, difficult]; activity `ACTIVITY_TYPE_IDS` =
// [individual, group, discussion, hands-on, game], `DURATION_VALUES` =
// [20, 30, 45, 60]. Those lists are private to the screens, so if one is
// reordered, update the indices here too.
export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    id: 'exit-ticket',
    titleAr: 'بطاقة خروج (٥ أسئلة قصيرة)',
    titleEn: 'Exit ticket (5 short questions)',
    tool: 'worksheet',
    params: { numQIdx: '0', diffIdx: '0', selectedTypes: JSON.stringify(['short_answer', 'true_false']) },
  },
  {
    id: 'homework-sheet',
    titleAr: 'واجب بيتي',
    titleEn: 'Homework sheet',
    tool: 'worksheet',
    params: {
      numQIdx: '1',
      diffIdx: '0',
      isHomework: '1',
      selectedTypes: JSON.stringify(['multiple_choice', 'short_answer', 'fill_blank']),
    },
  },
  {
    id: 'unit-review',
    titleAr: 'ورقة مراجعة الوحدة',
    titleEn: 'Unit review worksheet',
    tool: 'worksheet',
    params: {
      numQIdx: '4',
      diffIdx: '1',
      selectedTypes: JSON.stringify(['multiple_choice', 'short_answer', 'true_false', 'word_problem']),
    },
  },
  {
    id: 'lesson-intro-slides',
    titleAr: 'عرض تمهيدي للدرس',
    titleEn: 'Lesson intro slides',
    tool: 'slides',
    params: {},
  },
  {
    id: 'vocab-game',
    titleAr: 'تحدّي المفردات الصفي',
    titleEn: 'Class vocabulary challenge',
    tool: 'game',
    params: {},
  },
  {
    id: 'group-activity',
    titleAr: 'نشاط جماعي (٣٠ دقيقة)',
    titleEn: 'Group activity (30 min)',
    tool: 'activity',
    params: { activityTypeIdx: '1', durationIdx: '1' },
  },
];

/**
 * The params to push, with the library's current grade and subject added as
 * picker indices. An index of -1 (not in the picker) is left out, so the tool
 * falls back to its own default instead of being handed a position it cannot
 * honour — see `scopeFromParams`.
 */
export function templateParams(
  base: Record<string, string>,
  scope: { gradeIdx: number; subjectIdx: number },
): Record<string, string> {
  const params: Record<string, string> = { ...base };
  if (scope.gradeIdx >= 0) params.gradeIdx = String(scope.gradeIdx);
  if (scope.subjectIdx >= 0) params.subjectIdx = String(scope.subjectIdx);
  return params;
}
