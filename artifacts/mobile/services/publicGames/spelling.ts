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
 * Options are shown without vowel marks. The bank stores the correct spelling
 * fully vowelled and its misspellings bare, so showing them as stored would let
 * a child pick the one with the marks. The explanation shows the vowelled form.
 */
import { SPELLING_RULES, takeSpellingItems, type SpellingItem, type SpellingRule } from '@workspace/arabic-spelling';
import { shuffle } from './rng.ts';
import type { TextQuestion } from './textQuiz.ts';

/** At most this many questions from one rule in a round, so a round is not one lesson. */
export const SPELLING_PER_RULE = 2;

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
 * rule. A rule whose words admit only one plausible misspelling (الألف الفارقة)
 * makes no choice question in the bank and so never appears — by design.
 */
export function buildSpellingRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const drawn: TextQuestion[] = [];
  const seen = new Set<string>();
  for (const rule of shuffle([...SPELLING_RULES], rng)) {
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
