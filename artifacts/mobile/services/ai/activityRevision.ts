/**
 * A unit, a semester or the whole book, as the offline activity and classroom
 * makers read it: one revision session over the units in scope.
 *
 * The activity blueprints (`activityBlueprints.ts`) and the classroom
 * templates were written around ONE lesson: they read `keyConceptsAr`,
 * `rulesAr`, `objectives` and `keyTerms` off a `KBLesson` and splice a topic
 * phrase into sentences. Rather than give any format a second, wide shape
 * (piece-3 spec, decision 4), a wide request hands them a composite lesson
 * built from the units in scope, interleaved — every unit's first entry, then
 * every unit's second — so whichever slice a format reads (its first concept,
 * its first three, its first four) comes from as many units as it can.
 *
 * Bank items still come from real lessons: `drawAcrossUnits` takes one per
 * unit in turn, through whatever `take` the caller passes (generators.ts
 * passes the maths and chemistry banks). A scope with no bankable lesson gets
 * no items. An activity, unlike a quiz, does not need a bank, so that is not
 * an error.
 *
 * Free of react-native so `node --test` can load it.
 */
import { getLessonById, type KBLesson } from '../knowledgeBase.ts';

/** The lessons of one unit in scope, in the order the request listed them. */
export type RevisionLessonGroup = { unitId: string; lessons: KBLesson[] };

/** A lesson a bank item can be drawn from: its own title (the bank routes on it) and KB row. */
export type RevisionDrawLesson = { id: string; unitId: string; topic: string; kb: KBLesson };

export type RevisionLessonOptions = {
  /** The scope's revision phrase in both languages — the composite's title. */
  title: { ar: string; en: string };
  /**
   * The language the paper is written in. `objectives` are Arabic outcomes (or,
   * where a book lists none, Arabic key concepts), so an English paper cannot
   * read them: it takes the English key concepts instead.
   */
  lang: 'ar' | 'en';
  /** The unit the key terms start from (default 0). See `buildOfflineActivity`. */
  termsStartUnit?: number;
};

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;
/** Arabic letters only (see `keyConceptsEn` below). */
const ARABIC_LETTER = /[\u0621-\u064A]/;

/** About how many entries of each kind the composite holds in all; at least two per unit. */
const REVISION_POOL = 6;

/** The request's lesson ids as KB rows, grouped by unit in the order the units first appear. */
export function revisionLessonsByUnit(lessonIds: readonly string[]): RevisionLessonGroup[] {
  const groups: RevisionLessonGroup[] = [];
  const seen = new Set<string>();
  for (const id of lessonIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const lesson = getLessonById(id);
    if (!lesson) continue;
    let group = groups.find(g => g.unitId === lesson.unitId);
    if (!group) {
      group = { unitId: lesson.unitId, lessons: [] };
      groups.push(group);
    }
    group.lessons.push(lesson);
  }
  return groups;
}

function rotated<T>(list: readonly T[], by: number): T[] {
  if (list.length === 0) return [];
  const k = ((by % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** One unit's entries: each lesson's first, then each lesson's second…, without repeats. */
function unitEntries<T>(
  lessons: readonly KBLesson[],
  read: (l: KBLesson) => readonly T[] | undefined,
  key: (v: T) => string,
): T[] {
  const lists = lessons.map(l => read(l) ?? []);
  const longest = Math.max(0, ...lists.map(l => l.length));
  const seen = new Set<string>();
  const out: T[] = [];
  for (let k = 0; k < longest; k++) {
    for (const list of lists) {
      const v = list[k];
      if (v === undefined) continue;
      const id = key(v).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(v);
    }
  }
  return out;
}

/** Up to `depth` entries of every unit, round-robin across units, starting at unit `start`. */
function acrossUnits<T>(perUnit: readonly T[][], depth: number, start: number): T[] {
  const units = rotated(perUnit, start);
  const out: T[] = [];
  for (let k = 0; k < depth; k++) {
    for (const list of units) if (k < list.length) out.push(list[k]!);
  }
  return out;
}

/**
 * The lesson a blueprint reads for a revision over `groups`.
 *
 * `id` is `scope:<scopeKey>`, which no KB lookup resolves. `unitId` is the first
 * unit's, a real unit, so `getBookForLesson` finds the scope's book and
 * subject. The hands-on format and `isMathContext` read it, and the screen's
 * subject NAME is then never what decides maths vs chemistry.
 */
export function revisionActivityLesson(
  groups: readonly RevisionLessonGroup[],
  scopeKey: string,
  opts: RevisionLessonOptions,
): KBLesson {
  const depth = Math.max(2, Math.ceil(REVISION_POOL / Math.max(1, groups.length)));
  const pool = <T>(read: (l: KBLesson) => readonly T[] | undefined, key: (v: T) => string, start = 0): T[] =>
    acrossUnits(groups.map(g => unitEntries(g.lessons, read, key)), depth, start);
  const text = (s: string) => s;
  return {
    id: `scope:${scopeKey}`,
    unitId: groups[0]?.unitId ?? '',
    order: 0,
    titleAr: opts.title.ar,
    titleEn: opts.title.en,
    summaryAr: '',
    summaryEn: '',
    keyConceptsAr: pool(l => l.keyConceptsAr, text),
    // An English paper names its concepts from this list, and some books' English
    // concepts are Arabic glosses («Explain “دراسة الجدوى”», 24 scopes): those are
    // left out. Letters, not the whole script: a Quranic mark inside a Latin
    // title is real content.
    keyConceptsEn: pool(l => (opts.lang === 'en' ? l.keyConceptsEn.filter(c => !ARABIC_LETTER.test(c)) : l.keyConceptsEn), text),
    keyTerms: pool(l => l.keyTerms, t => t.ar, opts.termsStartUnit ?? 0),
    // A lesson whose book lists no outcomes (history, …) is represented by its
    // key concepts, so a warm-up's recall prompt and a quick check still name
    // the units instead of falling back to the scope's phrase. An English paper
    // never reads the Arabic outcomes (a one-lesson English quick check prints
    // them untranslated only where the book has them): it is represented by the
    // English key concepts, with any that are themselves Arabic left out.
    objectives: opts.lang === 'en'
      ? pool(l => l.keyConceptsEn.filter(c => !ARABIC_SCRIPT.test(c)), text)
      : pool(l => (l.objectives.length ? l.objectives : l.keyConceptsAr), text),
    periods: null,
    rulesAr: pool(l => l.rulesAr, text),
    rulesEn: pool(l => l.rulesEn, text),
  };
}

/**
 * `want` items, one unit after another starting at `startUnit`; a unit's
 * second turn takes its next lesson. A unit with no lesson is passed over, and
 * a `take` that answers null is skipped (as the bank's batch functions skip
 * one). `take` is told the index of the item it is drawing, for its tier.
 *
 * Each lesson is offered at most `want` times, so a bank that keeps answering
 * null cannot loop forever.
 */
export function drawAcrossUnits<T>(
  units: ReadonlyArray<ReadonlyArray<RevisionDrawLesson>>,
  want: number,
  startUnit: number,
  take: (lesson: RevisionDrawLesson, index: number) => T | null,
): T[] {
  const out: T[] = [];
  const n = units.length;
  if (n === 0 || want <= 0) return out;
  const visits = new Array<number>(n).fill(0);
  const start = ((startUnit % n) + n) % n;
  const budget = want * units.reduce((s, u) => s + Math.max(1, u.length), 0);
  for (let step = 0; out.length < want && step < budget; step++) {
    const u = (start + step) % n;
    const lessons = units[u]!;
    if (lessons.length === 0) continue;
    const lesson = lessons[visits[u]! % lessons.length]!;
    visits[u] = visits[u]! + 1;
    const item = take(lesson, out.length);
    if (item !== null) out.push(item);
  }
  return out;
}
