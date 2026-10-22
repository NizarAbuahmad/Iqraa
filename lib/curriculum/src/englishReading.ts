/**
 * Grade 1 reading for the English corner: a word's first sound, and the
 * per-unit sign-off that keeps the reading activities hidden.
 *
 * Spec: docs/superpowers/specs/2026-10-17-english-corner-reading-g1-design.md.
 * The book's Listening objectives ask for "the initial sound in simple words";
 * the activities ask which letter a word starts with, so a word may only be
 * asked about where its first letter IS its first sound. A rule decides that,
 * and `SOFT_G` lists by hand what the spelling cannot: «girl» and «giraffe» are
 * both g + i. A teacher reads the result (docs/english-reading-g1-review.html)
 * and a unit is offered to nobody until `reviewedBy` is set — the only switch.
 *
 * Free of react-native.
 */
import { grammarUnit, unitSentences, type GrammarSentence } from './englishGrammar.ts';
import { hubLesson, type HubWord } from './englishHub.ts';

export type SoundSkip = 'vowel' | 'digraph' | 'soft-c' | 'soft-g';

/** Soft-g words, by hand: a `g` word not listed here is read as hard. */
export const SOFT_G: ReadonlySet<string> = new Set(['giraffe']);

/** Why a word has no first sound to ask about, or null when it has one. */
export function firstSoundSkip(word: string): SoundSkip | null {
  const w = word.trim().toLowerCase();
  // A vowel letter has too many sounds for "starts with": apples, arms, eraser, eight, one.
  if (/^[aeiou]/.test(w)) return 'vowel';
  if (/^(ch|sh|th|ph|kn|wr)/.test(w)) return 'digraph';
  if (/^c[eiy]/.test(w)) return 'soft-c';
  if (SOFT_G.has(w)) return 'soft-g';
  return null;
}

/** The letter a word starts with when that letter is its first sound, lower-case; otherwise null. */
export function firstSound(word: string): string | null {
  if (firstSoundSkip(word)) return null;
  const c = word.trim().toLowerCase()[0] ?? '';
  return /[a-z]/.test(c) ? c : null;
}

export interface ReadingUnit {
  lessonId: string;
  /** A teacher's sign-off of the printed form. `null` → the unit is offered to nobody. */
  reviewedBy: { name: string; date: string } | null;
}

export const READING_UNITS: ReadingUnit[] = [
  { lessonId: 'kbl-g1-eng-s1-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u1_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u2_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u3_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s1-nccd-u4_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u5_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u6_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u7_l1', reviewedBy: null },
  { lessonId: 'kbl-g1-eng-s2-nccd-u8_l1', reviewedBy: null },
  // Grade 2 (spec: 2026-10-20-english-corner-reading-g2-design.md). The hub has no S2 Unit 0.
  { lessonId: 'kbl-g2-eng-s1-nccd-u0_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u1_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u2_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u3_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s1-nccd-u4_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u5_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u6_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u7_l1', reviewedBy: null },
  { lessonId: 'kbl-g2-eng-s2-nccd-u8_l1', reviewedBy: null },
  // Grade 3 (spec: 2026-10-22-english-corner-reading-g3-design.md). The hub has no S1 U0/U1 or S2 U5/U6.
  { lessonId: 'kbl-g3-eng-s1-nccd-u2_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s1-nccd-u3_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s1-nccd-u4_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s1-nccd-u5_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s2-nccd-u7_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s2-nccd-u8_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s2-nccd-u9_l1', reviewedBy: null },
  { lessonId: 'kbl-g3-eng-s2-nccd-u10_l1', reviewedBy: null },
];

export function readingUnit(lessonId: string): ReadingUnit | undefined {
  return READING_UNITS.find(u => u.lessonId === lessonId);
}

/** The lesson's words once a teacher has signed the unit off; null before, and for any other lesson. */
export function offeredReading(lessonId: string): HubWord[] | null {
  const unit = readingUnit(lessonId);
  return unit?.reviewedBy ? hubLesson(lessonId)?.words ?? null : null;
}

/** The rows of one grade, in hub order. */
export function readingUnitsForGrade(grade: number): ReadingUnit[] {
  return READING_UNITS.filter(u => hubLesson(u.lessonId)?.grade === grade);
}

// ─── Read the sentence (Grades 2 and 3) ────────────────────────────────────────────

/** A lesson offers «Read the sentence» only with this many distinct picture words: a round never asks one twice. */
export const MIN_SENTENCE_WORDS = 6;

export function distinctPictureWords(sentences: readonly GrammarSentence[]): number {
  return new Set(sentences.flatMap(s => (s.picture ? [s.picture.word] : []))).size;
}

/**
 * The Grade 2 or 3 grammar sentences a child may be asked to read: pictured, and not Yes or No (which
 * has its own activity). Empty for another grade, a lesson with no grammar unit, or a pool too thin to
 * make a round (Grade 2 S1 U3 and S2 U8; five of Grade 3's eight lessons). Not gated on review:
 * `offeredReadingSentences` is.
 */
export function readSentencePool(lessonId: string): GrammarSentence[] {
  const grade = hubLesson(lessonId)?.grade;
  if (grade !== 2 && grade !== 3) return [];
  const unit = grammarUnit(lessonId);
  if (!unit) return [];
  const pool = unitSentences(unit).filter(s => s.picture !== null && s.yesNo === null);
  return distinctPictureWords(pool) >= MIN_SENTENCE_WORDS ? pool : [];
}

/**
 * The sentence one word away: the same picture word with another count (this / these) or marker
 * (like / don't like, he / she). Its picture is shown as a wrong answer, so the child has to read
 * the small word. Null when the pattern has no such pair. The form and the app both ask this.
 */
export function sentencePartner(s: GrammarSentence, pool: readonly GrammarSentence[]): GrammarSentence | null {
  const own = s.picture;
  if (!own) return null;
  return pool.find(t => t.picture !== null && t.picture.word === own.word && (t.picture.count !== own.count || t.marker !== s.marker)) ?? null;
}

/**
 * The pool once the unit's reading AND its grammar are signed off; null before, for a lesson with no
 * pool, and for any Grade 1 lesson (the grade test lives in `readSentencePool`). `signed` is injectable so the gate can be tested without ever
 * committing a sign-off.
 */
export function offeredReadingSentences(
  lessonId: string,
  signed: { reading: boolean; grammar: boolean } = {
    reading: Boolean(readingUnit(lessonId)?.reviewedBy),
    grammar: Boolean(grammarUnit(lessonId)?.reviewedBy),
  },
): GrammarSentence[] | null {
  if (!signed.reading || !signed.grammar) return null;
  const pool = readSentencePool(lessonId);
  return pool.length > 0 ? pool : null;
}

/**
 * Why a Grade 2 lesson has no «Read the sentence» for some or all of its sentences — printed on the
 * form. Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const READING_NOT_COVERED_G2: Record<string, string[]> = {
  'kbl-g2-eng-s1-nccd-u1_l1': [
    'جمل «Is it a car? Yes, it is.» وأخواتها لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
    'action figure وbuilding set بلا صورة، فلا تظهر جملتاهما في «اقرَأ الجملة».',
  ],
  'kbl-g2-eng-s1-nccd-u3_l1': [
    'لا جمل لهذه الوحدة لأنها بلا أنشطة قواعد (لا صور لكلماتها)، فتبقى أنشطة الكلمات الثلاثة فقط.',
  ],
  'kbl-g2-eng-s2-nccd-u6_l1': [
    'جمل «Do you like cheese? Yes, I do.» وأخواتها لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
  ],
  'kbl-g2-eng-s2-nccd-u8_l1': [
    'جمل الوحدة تختلف باسم الشخص (dad وmum وgrandad وgranny) والصورة هي الغرفة فقط، أي أربع صور لا غير، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة.',
  ],
};

/**
 * The same for Grade 3 (spec: 2026-10-22-english-corner-reading-g3-design.md): the five lessons with no
 * «Read the sentence» at all, and the two whose pool leaves sentences out. Same text rules as G2.
 */
export const READING_NOT_COVERED_G3: Record<string, string[]> = {
  'kbl-g3-eng-s1-nccd-u2_l1': [
    'لا صور لهذه الوحدة: كلماتها أفعال وعبارات، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
  ],
  'kbl-g3-eng-s1-nccd-u3_l1': [
    'sandals وpyjamas وtrainers وbaseball cap بلا صور، فلا تظهر جملها (٨ جمل) في «اقرَأ الجملة».',
  ],
  'kbl-g3-eng-s1-nccd-u4_l1': [
    'لا صور لهذه الوحدة: كلماتها أفعال وأيام وعبارات، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
  ],
  'kbl-g3-eng-s2-nccd-u7_l1': [
    'جمل الوحدة أسئلة عن أفعال بلا صور (brushing وcollecting…)، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة على أسماء الحيوانات.',
  ],
  'kbl-g3-eng-s2-nccd-u8_l1': [
    'لا صور لهذه الوحدة (tent وtorch وغيرهما)، فلا يظهر «اقرَأ الجملة» ولا نشاطا الصور. يبقى «الحرف الأول» فقط.',
  ],
  'kbl-g3-eng-s2-nccd-u9_l1': [
    'جمل «Is there a sofa? Yes, there is.» وأخواتها (١٢ جملة) لها نشاط «نعم أم لا» الخاص في القواعد، فلا تظهر في «اقرَأ الجملة».',
    'الغرف والأثاث بلا صور (armchair وbed وwardrobe وbookcase…) فلا تظهر جملها. تبقى ست كلمات مصورة، فالجولة ستة أسئلة لا ثمانية.',
  ],
  'kbl-g3-eng-s2-nccd-u10_l1': [
    'جمل الوحدة كلها «نعم أم لا» (٣٤ جملة) أو بلا صور (٤ جمل)، فلا يظهر «اقرَأ الجملة». تبقى أنشطة الكلمات الثلاثة.',
  ],
};
