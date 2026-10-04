/**
 * A class (شعبة) is a group of students; its subjects are what this teacher
 * teaches *them*. A Grade 1–3 class teacher (معلم صف) teaches one section
 * Arabic, maths, science and Islamic education — one roster, four subjects —
 * while a Grade 10 maths teacher has one subject across several sections.
 * Making the class single-subject forced the first teacher to type the same
 * thirty names once per subject, with a join code and a parent thread each.
 *
 * `subjectIds` is the list; `subjectId` stays as its first entry so every
 * reader written against the single field (teaching plans, the parent letter)
 * keeps working on the primary subject. Pure on purpose — no React Native
 * import — so `node --test` can load it.
 */
import { SUBJECTS } from '@workspace/curriculum';

export interface HasClassSubjects {
  subjectId?: string | null;
  subjectIds?: readonly string[] | null;
}

/**
 * The class's subjects, whatever server answered. A class from before the
 * list existed (or a server older than it) has only `subjectId`, which reads
 * as a one-subject list; neither set reads as none.
 */
export function classSubjectIds(group: HasClassSubjects | null | undefined): string[] {
  if (!group) return [];
  const list = (group.subjectIds ?? []).filter(id => typeof id === 'string' && id.trim() !== '');
  if (list.length > 0) return [...new Set(list)];
  return group.subjectId ? [group.subjectId] : [];
}

/**
 * The ticked subjects in a picker. `chosen === null` means the teacher has not
 * touched it yet, and then every option is ticked: a class teacher taps
 * «أنشئ الشعبة» and is done, and a teacher offered one subject sees no
 * difference. Once chosen, anything no longer offered (the grade changed) is
 * dropped rather than submitted invisibly.
 */
export function resolveSelectedIds<T extends { id: string }>(
  options: readonly T[],
  chosen: readonly string[] | null,
): string[] {
  if (chosen === null) return options.map(o => o.id);
  return options.filter(o => chosen.includes(o.id)).map(o => o.id);
}

/** Tap a chip: add it if absent, remove it if present. Keeps option order out of it — order is the caller's. */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
}

/** Keep `selected` in the order `options` lists them, so the first one — the class's primary subject — is predictable. */
export function inOptionOrder<T extends { id: string }>(options: readonly T[], selected: readonly string[]): string[] {
  const known = options.filter(o => selected.includes(o.id)).map(o => o.id);
  return [...known, ...selected.filter(id => !known.includes(id))];
}

export function subjectLabel(id: string, lang: string): string {
  const subject = SUBJECTS.find(s => s.id === id);
  if (!subject) return '';
  return lang === 'ar' ? subject.nameAr : subject.name;
}

/**
 * The class card's subject line. Two names fit on the card; past that it is a
 * count, because «اللغة العربية · الرياضيات · العلوم · التربية الإسلامية»
 * wraps onto a third line on a phone. `count` is the caller's
 * `t('subjects_count', n)`, so the plural rules stay in i18n.ts.
 */
export function classSubjectsLabel(ids: readonly string[], lang: string, count: (n: number) => string): string {
  const names = ids.map(id => subjectLabel(id, lang)).filter(Boolean);
  return names.length <= 2 ? names.join(' · ') : count(names.length);
}

/**
 * A saved material's subject is stored as the display name it was generated
 * under («الرياضيات» or «Mathematics»), not an id. Resolve it back; '' when it
 * names nothing in the catalog.
 */
export function subjectIdFromName(name: string | null | undefined): string {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return '';
  const hit = SUBJECTS.find(s => s.id === n || s.name.toLowerCase() === n || s.nameAr === n);
  return hit?.id ?? '';
}

/**
 * Narrow a class's materials or exams to one subject. `focus === ''` is «الكل».
 * An item whose subject cannot be resolved stays visible under every filter:
 * hiding it would make it unreachable from this screen, and it is in this
 * class because the teacher put it there.
 */
export function filterBySubject<T>(items: readonly T[], focus: string, subjectOf: (item: T) => string): T[] {
  if (!focus) return [...items];
  return items.filter(item => {
    const id = subjectOf(item);
    return !id || id === focus;
  });
}
