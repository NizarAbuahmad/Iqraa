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

export interface FamilyText {
  student: PushText;
  guardian: (child: string) => PushText;
}

/** A calendar day `YYYY-MM-DD` as DD-MM-YYYY in a left-to-right isolate — the app's formatDueDate. String work only: the day has no zone. */
export function pushDay(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return `⁦${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}⁩`;
}

export function pushTime(hhmm: string): string {
  return `⁦${hhmm}⁩`;
}

export function classLabel(klass: { name: string; nameAr: string }): string {
  return clip(klass.nameAr.trim() || klass.name, 40);
}

/** A title made of a fixed prefix and a name, cut so the whole fits TITLE_MAX. */
function titled(prefix: string, name: string): string {
  return `${prefix}${clip(name, Math.max(10, TITLE_MAX - [...prefix].length))}`;
}

/** «سارة: واجب جديد» — the child first; see the header. */
function forChild(child: string, what: string): string {
  const name = clip(child, 24);
  return name ? `${name}: ${what}` : what;
}

export function homeworkPostedText(i: { title: string; className: string; dueDate: string }): FamilyText {
  const due = `موعده ${pushDay(i.dueDate)}`;
  return {
    student: { title: titled("واجب جديد: ", i.title), body: `${i.className} — ${due}. تجده في «المدرسة».` },
    guardian: child => ({ title: forChild(child, "واجب جديد"), body: `«${clip(i.title, 60)}» في ${i.className} — ${due}.` }),
  };
}
