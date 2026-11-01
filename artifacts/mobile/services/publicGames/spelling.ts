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
 * ## Only five rules, on purpose
 *
 * The tile shows a rule name and the options are bare words, so nothing tells the
 * child WHICH word is meant. That is only safe where a wrong option is never a
 * word of its own. An audit of 135 questions the full bank can serve (the
 * options against every word of the Arabic books, then read by hand) found about
 * half offering a real word as a wrong option: قلم beside قلمًا, رمي beside رمى,
 * أبني beside ابني, أستمع beside استمع, ضوء beside ضوءًا, ذاهب beside ذهب, إله
 * beside الله. A child who reads the other word is marked wrong. The five rules
 * below offer only non-words (مدرسه, ألشمس, بإلكتاب, هاذا) apart from one word,
 * «ذلك» (its derived option «دلك» is a verb), which is dropped.
 * Excluded rules come back when the bank can say which word is meant (a
 * sentence per word) or a word-list check exists. `alif-tathniya-baad-hamza` is
 * also out for its content: it marks شيآن / هواآن as correct and شيئان / هواءان
 * as wrong, against its own بدءان / جزءان — check it against the book first.
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

/** The rules this game serves; see the header for why the other fourteen are not. */
export const SPELLING_GAME_RULE_IDS = [
  'taa-marbuta-haa',
  'lam-shamsiya-qamariya',
  'ittissal-huruf-bi-al',
  'asma-mabdua-bi-al',
  'hatha-hathihi',
] as const;
const GAME_RULES = SPELLING_RULES.filter(r => (SPELLING_GAME_RULE_IDS as readonly string[]).includes(r.id));

/** Answers never asked: a derived wrong option is itself a word («دلك», to rub). */
export const SPELLING_DROPPED_ANSWERS: readonly string[] = ['ذلك'];

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
 * rule, from `SPELLING_GAME_RULE_IDS` only. A word with fewer than two wrong
 * options (وجه / وجة) makes no choice question in the bank and is skipped.
 */
export function buildSpellingRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const drawn: TextQuestion[] = [];
  const seen = new Set<string>();
  for (const rule of shuffle([...GAME_RULES], rng)) {
    const seed = Math.floor(rng() * 0x7fffffff) + 1;
    for (const item of takeSpellingItems(rule, SPELLING_PER_RULE, { kinds: ['choose'], seed })) {
      const q = toQuestion(rule, item, lang);
      if (!q || seen.has(q.correctId) || SPELLING_DROPPED_ANSWERS.includes(q.correctId)) continue;
      seen.add(q.correctId);
      drawn.push(q);
    }
  }
  return shuffle(drawn, rng).slice(0, count);
}
