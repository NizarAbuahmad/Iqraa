import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELLING_RULES, takeSpellingItems } from '@workspace/arabic-spelling';
import { makeRng } from '../publicGames/rng.ts';
import {
  SPELLING_EXCLUDED_RULE_IDS, SPELLING_PER_RULE, buildSpellingRound, stripMarks,
} from '../publicGames/spelling.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

const ARABIC = /^[\p{Script=Arabic}\p{M}\s]+$/u;
/** A rule name also carries «» quotes, brackets, tatweel and the odd comma. */
const RULE_NAME = /^[\p{Script=Arabic}\p{M}\s«»()\u0640،]+$/u;
test('stripMarks removes every vowel mark and nothing else', () => {
  assert.equal(stripMarks('مَدْرَسَة'), 'مدرسة');
  assert.equal(stripMarks('دُفْئًا'), 'دفئا');
  assert.equal(stripMarks('الشَّمْسِيَّة'), 'الشمسية');
  // The Arabic-Indic digits sit right after the marks (U+0660-0669); they are not marks.
  assert.equal(stripMarks('٠١٢٣٤٥٦٧٨٩'), '٠١٢٣٤٥٦٧٨٩');
});

const RULE_BY_NAME = new Map(SPELLING_RULES.map(r => [r.nameAr, r]));
const rounds = (lang: 'ar' | 'en' = 'ar', n = 150) =>
  Array.from({ length: n }, (_, i) => buildSpellingRound(lang, 8, makeRng(i + 1)));

test('spelling round: 8 well-formed questions with 3 or 4 Arabic options, in both UI languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const round of rounds(lang)) {
      assert.equal(round.length, 8);
      for (const q of round) {
        assertWellFormed(q, 3);
        assert.ok(q.options.length <= 4);
        assert.equal(q.promptKey, 'playSpellingPrompt');
        for (const o of q.options) assert.match(o.label, ARABIC);
        assert.match(q.subject!, RULE_NAME);
      }
    }
  }
});

test('the marked answer is the bank spelling of a bank word, and no other option is', () => {
  const bankCorrect = new Set(SPELLING_RULES.flatMap(r => r.words.map(w => stripMarks(w.correct))));
  for (const round of rounds()) {
    for (const q of round) {
      const rule = RULE_BY_NAME.get(q.subject!);
      assert.ok(rule, `subject ${q.subject} is not a bank rule name`);
      const answer = q.options.find(o => o.id === q.correctId)!.label;
      assert.ok(rule.words.some(w => stripMarks(w.correct) === answer), `${answer} is not a word of ${rule.id}`);
      for (const o of q.options) {
        if (o.id !== q.correctId) assert.ok(!bankCorrect.has(stripMarks(o.label)), `${o.label} is a correct bank spelling offered as a wrong option`);
      }
    }
  }
});

test('no option carries a vowel mark, so the answer cannot be told by diacritics', () => {
  for (const round of rounds()) {
    for (const q of round) {
      for (const o of q.options) assert.equal(o.label, stripMarks(o.label), `${o.label} has marks`);
      assert.equal(new Set(q.options.map(o => stripMarks(o.label))).size, q.options.length);
    }
  }
});

test('a round never asks about a word twice and never more than the cap from one rule', () => {
  for (const round of rounds()) {
    const answers = round.map(q => q.options.find(o => o.id === q.correctId)!.label);
    assert.equal(new Set(answers).size, answers.length);
    const perRule = new Map<string, number>();
    for (const q of round) perRule.set(q.subject!, (perRule.get(q.subject!) ?? 0) + 1);
    for (const [rule, n] of perRule) assert.ok(n <= SPELLING_PER_RULE, `${rule} appears ${n} times`);
  }
});

test('the explanation names the vowelled spelling and the rule, in both languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const q of buildSpellingRound(lang, 8, makeRng(7))) {
      const rule = RULE_BY_NAME.get(q.subject!)!;
      const answer = q.options.find(o => o.id === q.correctId)!.label;
      const word = rule.words.find(w => stripMarks(w.correct) === answer)!;
      assert.ok(q.explanation!.includes(word.correct), q.explanation);
      assert.ok(q.explanation!.includes(rule.nameAr), q.explanation);
      assert.match(q.explanation!, lang === 'ar' ? /^الكتابة الصحيحة/ : /^Correct spelling/);
    }
  }
});

test('the round is deterministic for a seed and varies between seeds', () => {
  assert.deepEqual(buildSpellingRound('ar', 8, makeRng(9)), buildSpellingRound('ar', 8, makeRng(9)));
  const firsts = new Set(rounds('ar', 40).map(r => JSON.stringify(r[0])));
  assert.ok(firsts.size > 10, 'rounds barely vary');
});

test('every rule is served except the excluded ones, and every rule that can make a choice is reachable', () => {
  const byId = new Map(SPELLING_RULES.map(r => [r.id, r]));
  for (const id of SPELLING_EXCLUDED_RULE_IDS) assert.ok(byId.has(id), `${id} is no longer a bank rule`);
  const excludedNames = new Set(SPELLING_EXCLUDED_RULE_IDS.map(id => byId.get(id)!.nameAr));
  // A rule can appear if the bank can build a choice from at least one of its unflagged words.
  const capable = new Set(
    SPELLING_RULES.filter(r => !(SPELLING_EXCLUDED_RULE_IDS as readonly string[]).includes(r.id) &&
      takeSpellingItems(r, r.words.length, { kinds: ['choose'], seed: 1 }).length > 0).map(r => r.nameAr),
  );
  assert.ok(capable.size >= 14, `only ${capable.size} rules can be served: the widening was lost`);
  const seen = new Set<string>();
  for (const round of rounds('ar', 400)) for (const q of round) {
    assert.ok(!excludedNames.has(q.subject!), `${q.subject} is an excluded rule`);
    seen.add(q.subject!);
  }
  assert.deepEqual([...seen].sort(), [...capable].sort(), 'a servable rule is never drawn');
});

test('a word the bank marks dictation-only is never asked, and rounds stay full', () => {
  for (const round of rounds('ar', 300)) {
    assert.equal(round.length, 8);
    for (const q of round) {
      const rule = RULE_BY_NAME.get(q.subject!)!;
      const word = rule.words.find(w => stripMarks(w.correct) === q.correctId)!;
      assert.equal(word.dictationOnly, undefined, `«${word.correct}» is dictation-only (${word.dictationOnly})`);
    }
  }
});
