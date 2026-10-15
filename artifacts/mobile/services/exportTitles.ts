/**
 * The title a saved or exported plan / activity carries.
 *
 * A unit, a semester or the whole book is a revision session, and its title says
 * so («خطة حصة مراجعة: …», «نشاط مراجعة: …»), as the generated material's own
 * title does. A lesson's title is what it always was. Free of react-native so
 * `node --test` can load it.
 */

/** `wide` is the frozen scope's (`wideFrozen`), not the live picker's. */
export function lessonPlanExportTitle(lang: 'ar' | 'en', topic: string, wide: boolean): string {
  if (wide) return lang === 'ar' ? `خطة حصة مراجعة: ${topic}` : `Revision Lesson Plan: ${topic}`;
  return lang === 'ar' ? `خطة درس: ${topic}` : `Lesson Plan: ${topic}`;
}

export function activityExportTitle(lang: 'ar' | 'en', topic: string, wide: boolean): string {
  if (wide) return lang === 'ar' ? `نشاط مراجعة: ${topic}` : `Revision Activity: ${topic}`;
  return lang === 'ar' ? `نشاط: ${topic}` : `Activity: ${topic}`;
}
