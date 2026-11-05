/**
 * Spell it right (/play/spelling) — pick the correct spelling of an Arabic
 * word. Grades 2–7.
 *
 * Every key comes from `@workspace/arabic-spelling`, the hand-written bank of
 * the curriculum's own spelling rules (a model cannot be trusted with an
 * orthography key). This module writes no spelling of its own: it asks the
 * bank's `takeSpellingItems` for choice questions, so the wrong options are the
 * bank's real pupil mistakes, topped up only by the swaps the rule allows, and
 * never another word's correct spelling.
 *
 * The question is about Arabic orthography, so the tile (the rule's name), the
 * words and the options are Arabic whatever the UI language is; only the prompt
 * and the explanation's lead-in are localised.
 *
 * ## Which questions are safe
 *
 * The tile shows a rule name and the options are bare words, so nothing tells the
 * child WHICH word is meant. That is only safe where a wrong option is never a
 * word of its own: a child who reads «قلم» beside «قلمًا» is right, and is marked
 * wrong. The bank marks such words `dictationOnly` (50+ of its 174, each read by
 * hand, with a reason), and `takeSpellingItems` never builds a choice from one, so
 * this game gets only the words whose misspellings were read and are not words.
 * It served five rules, then every rule that has such words.
 *
 * One rule is left out whatever its words: `alif-tathniya-baad-hamza` marks
 * شيآن / هواآن as correct and شيئان / هواءان as wrong, against its own بدءان /
 * جزءان. By standard spelling the key looks wrong, and nobody has checked the
 * Ministry book. A rule with no choice-safe word at all (the plural «يدعوا», the
 * ى/ي verbs, همزة الاستفهام) never appears, by design. Words nobody flagged are
 * read, not proven: «أبن», «هده» and «بير» stay as wrong options because a pupil
 * would not know them.
 *
 * ## Marks
 *
 * `takeSpellingItems` already hands the options over bare (its own `bare()` covers
 * U+064B–0652 and U+0670), so showing them is safe; `stripMarks` here covers the
 * rest of the mark range, and matches an option back to its word. The
 * explanation shows the vowelled form.
 */
import { SPELLING_RULES, takeSpellingItems, type SpellingItem, type SpellingRule } from '@workspace/arabic-spelling';
import { shuffle } from './rng.ts';
import type { TextQuestion } from './textQuiz.ts';

/** Rules never served, whatever their words: see the header. */
export const SPELLING_EXCLUDED_RULE_IDS = ['alif-tathniya-baad-hamza'] as const;
const GAME_RULES = SPELLING_RULES.filter(r => !(SPELLING_EXCLUDED_RULE_IDS as readonly string[]).includes(r.id));

/** At most this many questions from one rule in a round, so a round is not one lesson. */
export const SPELLING_PER_RULE = 3;

/** Harakat, shadda and the dagger alif: what separates a vowelled word from the bare spelling. */
export function stripMarks(word: string): string {
  return word.normalize('NFKC').replace(/[ً-ٰٟ]/g, '');
}

/**
 * Every correct spelling in the bank, bare. The bank checks a wrong option against its OWN rule's words only,
 * so «دفء» (a misspelling of «دُفْئًا» in one rule) is also the correct «دُفْء» of another: a real word the
 * child could rightly pick and be marked wrong. A question offering one is dropped here.
 */
const BANK_CORRECT = new Set(SPELLING_RULES.flatMap(r => r.words.map(w => stripMarks(w.correct))));

function toQuestion(rule: SpellingRule, item: SpellingItem, lang: 'ar' | 'en'): TextQuestion | null {
  const options = (item.body.options as { id: string; text: string }[] | undefined) ?? [];
  const correctOption = options.find(o => o.id === (item.expectedAnswer.optionIds as string[])[0]);
  if (!correctOption) return null;
  const word = rule.words.find(w => stripMarks(w.correct) === stripMarks(correctOption.text));
  if (!word) return null;
  const shown = options.map(o => ({ id: stripMarks(o.text), label: stripMarks(o.text) }));
  if (shown.some(o => o.id !== stripMarks(word.correct) && BANK_CORRECT.has(o.id))) return null;
  return {
    promptKey: 'playSpellingPrompt',
    subject: rule.nameAr,
    options: shown,
    correctId: stripMarks(word.correct),
    explanation: `${lang === 'ar' ? 'الكتابة الصحيحة' : 'Correct spelling'}: «${word.correct}» — ${rule.nameAr}`,
  };
}

/**
 * `count` questions on different words, at most `SPELLING_PER_RULE` from any one
 * rule, never from an excluded one. A word with fewer than two wrong
 * options (وجه / وجة) makes no choice question in the bank and is skipped.
 */
export function buildSpellingRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const drawn: TextQuestion[] = [];
  const seen = new Set<string>();
  for (const rule of shuffle([...GAME_RULES], rng)) {
    const seed = Math.floor(rng() * 0x7fffffff) + 1;
    for (const item of takeSpellingItems(rule, SPELLING_PER_RULE, { kinds: ['choose'], seed })) {
      const q = toQuestion(rule, item, lang);
      if (!q || seen.has(q.correctId)) continue;
      seen.add(q.correctId);
      drawn.push(q);
    }
  }
  return shuffle(drawn, rng).slice(0, count);
}
