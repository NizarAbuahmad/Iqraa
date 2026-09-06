/**
 * What a saved material's stored content actually is.
 *
 * The workspace picks a renderer from `item.type`, which is right when the type
 * is right. Class activities were saved as `'lesson'` for as long as the
 * Activity screen existed — the workspace viewer had no `'activity'` branch, so
 * filing them honestly would have dropped them into the quiz renderer and
 * crashed on the `questions` an `ActivityOutput` does not have.
 *
 * That is fixed now, but the materials already in teachers' workspaces still
 * say `'lesson'`. Reading the shape is what rescues them: a lesson plan and an
 * activity are not close enough to confuse, so one look at the content settles
 * which renderer to use, and nothing needs migrating.
 */

/**
 * True when this content is an `ActivityOutput` rather than a `LessonPlanOutput`.
 *
 * Keyed on `steps` — an array of `{ stepNumber, description }` — because that
 * is the field an activity has and a plan has no equivalent of. `objective`
 * (singular) versus `objectives` (a list) is the confirming pair: a plan never
 * carries the first, an activity never the second.
 */
export function looksLikeActivityContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  if (Array.isArray(c.objectives)) return false;
  if (typeof c.objective !== 'string') return false;
  return Array.isArray(c.steps);
}
