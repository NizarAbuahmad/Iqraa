/**
 * The pure half of ParticipantPickerSheet — who the list contains, what a
 * search matches, and what tapping a class does.
 *
 * Lives apart from the component to stay testable, the same way
 * `rosterNames.ts` does for the roster's paste box. All three functions here
 * have branches that fail silently in a UI: a parent quietly missing from a
 * class selection, an Arabic name that never matches, a chip that adds but
 * cannot un-add.
 */
import type { ChatRole, ContactStudent } from './messaging.ts';

export interface PickerContact {
  userId: string;
  firstName: string;
  lastName: string;
  role: ChatRole;
  /** The first student this person is linked to — the row's subtitle. */
  studentName: string;
  /** Every class they are reachable through, across all their linked students. */
  classIds: string[];
}

export interface PickerClass {
  id: string;
  name: string;
  nameAr: string;
}

/**
 * Diacritics- and hamza-insensitive, so «احمد» finds «أحمد» and a name typed
 * without tashkeel still matches one stored with it. Without this, search on
 * Arabic names fails on the exact spellings teachers actually type.
 *
 * A deliberate copy of `normalizeAr` in knowledgeBase.ts rather than an import:
 * that module carries the whole book catalog, and dragging it into a bottom
 * sheet to reuse five lines is the worse trade. If a third caller appears,
 * promote it to its own module rather than making a fourth copy.
 */
export function normalizeAr(s: string): string {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // harakat/tanween/shadda/sukun, dagger alef, tatweel.
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Matches a person's own name or the student they are attached to — a teacher searching «أحمد» means the child as often as the parent. */
export function matchesQuery(c: PickerContact, query: string): boolean {
  const q = normalizeAr(query);
  if (!q) return true;
  return normalizeAr(`${c.firstName} ${c.lastName} ${c.studentName}`).includes(q);
}

/**
 * Flattens the by-student contacts response into one row per person.
 *
 * The same person arrives once per student they are linked to, so a parent of
 * two children accumulates both children's classes rather than keeping only
 * whichever student happened to come first — otherwise "select 10-أ" silently
 * misses them. `studentName` keeps the first student, so the subtitle is
 * stable rather than depending on response order.
 *
 * `classes` may be absent: the API deploys by hand while the app deploys on
 * merge, so this runs against a server that predates the field.
 */
export function buildPickerContacts(byStudent: ContactStudent[]): {
  contacts: PickerContact[];
  classes: PickerClass[];
} {
  const seen = new Map<string, PickerContact>();
  const classById = new Map<string, PickerClass>();

  for (const s of byStudent) {
    for (const cl of s.classes ?? []) {
      if (!classById.has(cl.id)) classById.set(cl.id, cl);
    }
    for (const c of s.contacts) {
      const existing = seen.get(c.userId);
      if (existing) {
        for (const cl of s.classes ?? []) {
          if (!existing.classIds.includes(cl.id)) existing.classIds.push(cl.id);
        }
      } else {
        seen.set(c.userId, {
          ...c,
          studentName: s.studentName,
          classIds: (s.classes ?? []).map(cl => cl.id),
        });
      }
    }
  }

  return { contacts: [...seen.values()], classes: [...classById.values()] };
}

/**
 * Tapping a class adds everyone in it, or removes them when they are all
 * already picked — a toggle rather than a one-way action with no undo.
 *
 * Partial selection adds the rest rather than clearing: after hand-picking two
 * people from 10-أ, "select the class" should mean the whole class.
 */
export function toggleClassSelection<T extends { userId: string }>(
  selected: ReadonlyMap<string, T>,
  members: T[],
): Map<string, T> {
  const next = new Map(selected);
  const allPicked = members.length > 0 && members.every(m => next.has(m.userId));
  for (const m of members) {
    if (allPicked) next.delete(m.userId);
    else next.set(m.userId, m);
  }
  return next;
}
