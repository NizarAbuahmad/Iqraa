/**
 * What family pushes say. Arabic only, like every push here: it goes out with
 * no request in hand to read a locale from. Pure — the senders pass names in.
 *
 * Rules every builder keeps:
 *  - a title is at most TITLE_MAX code points (a phone cuts the rest);
 *  - a guardian's push names the child FIRST («سارة: واجب جديد»), so no verb
 *    or preposition has to agree with a name — Arabic verbs agree with the
 *    child's gender, which the roster often does not record;
 *  - a day or time sits in a left-to-right isolate, as the app shows it.
 */
export interface PushText {
  title: string;
  body: string;
}

export const TITLE_MAX = 50;

/** Trim, fold whitespace, and cut at `max` code points with «…» — never through a character. */
export function clip(text: string, max: number): string {
  const folded = text.trim().replace(/\s+/g, " ");
  if (max < 1) return "";
  const chars = [...folded];
  return chars.length <= max ? folded : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}
