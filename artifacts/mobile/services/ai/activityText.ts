/**
 * Plain text for an activity.
 *
 * Nothing on the activity path renders markdown — the screen, the PDF and
 * slide exports, Word and the plain-text export all print a string as it
 * stands — so a `**bold**` in a step showed up as literal asterisks. The
 * offline blueprints wrote them, and the live prompt's own examples use them,
 * so a model can echo them. Stripped once, where an activity enters the app
 * and again where a saved one is reopened, rather than in each renderer.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { ActivityOutput } from './AIService.ts';

/**
 * `**word**` → `word`. Only a closed pair on one line counts as emphasis: a
 * lone `**`, or the single `*` of «2 * 3», is text and is left alone.
 */
export function stripInlineMarkdown(text: string): string {
  return text.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
}

function plain<T>(value: T): T {
  if (typeof value === 'string') return stripInlineMarkdown(value) as T;
  if (Array.isArray(value)) return value.map(plain) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) as T;
  }
  return value;
}

/** The activity with markdown emphasis removed from every string it holds. */
export function plainActivity(activity: ActivityOutput): ActivityOutput {
  return plain(activity);
}
