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
];

export function readingUnit(lessonId: string): ReadingUnit | undefined {
  return READING_UNITS.find(u => u.lessonId === lessonId);
}

/** The lesson's words once a teacher has signed the unit off; null before, and for any other lesson. */
export function offeredReading(lessonId: string): HubWord[] | null {
  const unit = readingUnit(lessonId);
  return unit?.reviewedBy ? hubLesson(lessonId)?.words ?? null : null;
}
