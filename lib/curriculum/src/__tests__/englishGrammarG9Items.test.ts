/**
 * Grade 9 grammar on the fourteen authored hub lessons (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-lessons-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor is a teacher's
 * call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { G9_ITEM_LESSONS } from '../englishGrammarG9Items.ts';
import { hubLesson } from '../englishHub.ts';

const dataFile = (sem: 1 | 2) => JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g9_eng_sem${sem}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g9-eng-${s}`;
const LESSONS = [
  's1-nccd-u1_l1', 's1-nccd-u1_l3', 's1-nccd-u1_l4', 's1-nccd-u2_l1', 's1-nccd-u2_l3', 's1-nccd-u3_l1', 's1-nccd-u3_l4', 's1-nccd-u5_l1',
  's1-nccd-u5_l3', 's2-nccd-u6_l1', 's2-nccd-u6_l3', 's2-nccd-u7_l1', 's2-nccd-u7_l2', 's2-nccd-u8_l1', 's2-nccd-u8_l5', 's2-nccd-u9_l1',
  's2-nccd-u9_l3', 's2-nccd-u10_l1', 's2-nccd-u10_l4',
].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);

describe('Grade 9 authored lessons', () => {
  it('are the nineteen hub lessons, unsigned and offered to nobody', () => {
    assert.deepEqual(G9_ITEM_LESSONS.map(l => l.lessonId), LESSONS);
    for (const id of LESSONS) {
      assert.ok(hubLesson(id), id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it("carry the book's own «I can» statement for that lesson id", () => {
    for (const l of G9_ITEM_LESSONS) {
      const sem = l.lessonId.includes('-s1-') ? 1 : 2;
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile(sem).units.flatMap((u: { lessons: { id: string }[] }) => u.lessons).find((x: { id: string }) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson, 760 in all, each topic at least six', () => {
    let total = 0;
    for (const id of LESSONS) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      total += s.length;
      const by = new Map<string, number>();
      for (const x of s) by.set(x.patternId, (by.get(x.patternId) ?? 0) + 1);
      for (const [topic, n] of by) assert.ok(n >= 6, `${id} ${topic} has ${n}`);
    }
    assert.equal(total, 760);
  });

  it('pin the topics and their sizes', () => {
    const shape = (id: string) => {
      const by = new Map<string, number>();
      for (const x of sentencesOf(L(id))) by.set(x.patternId, (by.get(x.patternId) ?? 0) + 1);
      return Object.fromEntries(by);
    };
    assert.deepEqual(shape('s1-nccd-u1_l1'), { now: 14, stative: 10, third: 16 });
    assert.deepEqual(shape('s1-nccd-u1_l3'), { singular: 20, plural: 20 });
    assert.deepEqual(shape('s1-nccd-u1_l4'), { 'some-any': 14, 'every-no': 14, 'things-places': 12 });
    assert.deepEqual(shape('s1-nccd-u2_l1'), { 'did-questions': 14, 'did-negatives': 12, irregular: 14 });
    assert.deepEqual(shape('s1-nccd-u3_l1'), { while: 14, when: 12, agreement: 14 });
    assert.deepEqual(shape('s1-nccd-u3_l4'), { who: 10, which: 10, where: 10, whose: 10 });
    assert.deepEqual(shape('s1-nccd-u5_l1'), { prohibition: 12, should: 14, 'have-to': 14 });
    assert.deepEqual(shape('s1-nccd-u5_l3'), { 'should-have': 14, 'could-have': 12, 'must-cant-have': 14 });
    assert.deepEqual(shape('s2-nccd-u6_l1'), { 'present-continuous': 20, 'going-to': 20 });
    assert.deepEqual(shape('s2-nccd-u6_l3'), { 'going-to-predictions': 20, 'will-predictions': 20 });
    assert.deepEqual(shape('s2-nccd-u8_l1'), { 'ing-verbs': 20, 'to-verbs': 20 });
    assert.deepEqual(shape('s2-nccd-u9_l1'), { 'had-form': 24, 'had-negatives-questions': 16 });
    assert.deepEqual(shape('s1-nccd-u2_l3'), { 'used-to-affirmative': 14, 'didnt-use-to': 12, 'did-use-to-questions': 14 });
    assert.deepEqual(shape('s2-nccd-u7_l1'), { 'already-just': 14, 'ever-never': 14, 'yet-negatives': 12 });
    assert.deepEqual(shape('s2-nccd-u7_l2'), { for: 14, since: 14, 'have-has': 12 });
    assert.deepEqual(shape('s2-nccd-u8_l5'), { 'will-clause': 14, 'if-clause': 14, 'negatives-questions': 12 });
    assert.deepEqual(shape('s2-nccd-u9_l3'), { 'say-tell': 16, ask: 12, 'reported-questions': 12 });
    assert.deepEqual(shape('s2-nccd-u10_l1'), { 'present-passive': 14, 'past-passive': 14, 'questions-negatives': 12 });
    assert.deepEqual(shape('s2-nccd-u10_l4'), { 'second-conditional': 24, 'if-were': 16 });
  });

  it('are buildable, picture-free, unique and never a Yes or No', () => {
    for (const id of LESSONS) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id}: «${x.text}» has ${x.tokens.length} words`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.ok(x.kind === 'form' || x.kind === 'meaning', x.text);
        assert.ok(!seen.has(x.text), `duplicate «${x.text}»`);
        seen.add(x.text);
      }
      for (const x of s) assert.ok(!seen.has(x.claim!.falseText), `the twin of «${x.text}» is one of its true sentences`);
    }
  });

  it('have a distractor and a twin that differ from the answer and the sentence, and a silent twin', () => {
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
      assert.notEqual(x.claim!.falseText, x.text, x.text);
      assert.equal(x.claim!.voiced, false, x.text);
    }
  });

  it('contain no capitalised name of a person (only a sentence start, I, a family word or a place)', () => {
    const ok = new Set(['I', "I'm", "I'd", "I'll", 'Dad', 'Mum', 'TV', 'Jordan', 'Brazil', 'January', 'June', 'Japanese', 'Fridays', 'Petra', 'Aqaba', 'Amman', 'Irbid', 'Rome', 'London', 'Paris', 'Mars', 'Monday', 'Friday', 'Saturday', 'Sunday', 'May', 'July', 'English', 'French']);
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
    }
  });

  it('keep u6 to form items and the «meaning» items to the two lessons that need them', () => {
    for (const id of [L('s2-nccd-u6_l1'), L('s2-nccd-u6_l3')]) assert.ok(sentencesOf(id).every(x => x.kind === 'form'), id);
    for (const id of LESSONS) {
      const meaning = sentencesOf(id).filter(x => x.kind === 'meaning');
      if (id === L('s1-nccd-u1_l1')) assert.ok(meaning.every(x => x.patternId === 'now'));
      else if (id === L('s1-nccd-u5_l1')) assert.ok(meaning.every(x => x.patternId === 'prohibition'));
      else assert.equal(meaning.length, 0, id);
    }
  });

  it('are voiced as true sentences only: no twin reaches the audio list unless it is also a true sentence', () => {
    const spoken = new Set(allGrammarSpoken());
    const trues = new Set(GRAMMAR_UNITS.flatMap(u => unitSentences(u).map(s => s.text)));
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || trues.has(x.claim!.falseText), `voiced twin «${x.claim!.falseText}»`);
    }
  });

  it('are in GRAMMAR_UNITS', () => {
    for (const id of LESSONS) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
  });

  it("«didn't used to» appears only as the distractor of the one topic flagged for the teacher", () => {
    let seen = 0;
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      if (x.text.includes("didn't used to") || x.claim!.falseText.includes("didn't used to")) {
        seen += 1;
        assert.equal(id, L('s1-nccd-u2_l3'));
        assert.equal(x.patternId, 'didnt-use-to');
        assert.equal(x.choose!.wrong, "didn't used to");
      }
    }
    assert.equal(seen, 12);
  });

  it('keep the grammar-only lessons to form items, and the distractor of «for» and «since» to the other word', () => {
    for (const id of ['s1-nccd-u2_l3', 's2-nccd-u7_l1', 's2-nccd-u7_l2', 's2-nccd-u8_l5', 's2-nccd-u9_l3'].map(L)) {
      assert.ok(sentencesOf(id).every(x => x.kind === 'form'), id);
      assert.equal(hubLesson(id)!.grammarOnly, true, id);
    }
    for (const x of sentencesOf(L('s2-nccd-u7_l2'))) {
      if (x.patternId === 'for') assert.deepEqual([x.choose!.right, x.choose!.wrong], ['for', 'since'], x.text);
      if (x.patternId === 'since') assert.deepEqual([x.choose!.right, x.choose!.wrong], ['since', 'for'], x.text);
    }
  });
});

describe('the Grade 9 teacher form for the authored lessons', () => {
  it('prints every lesson page with its book statement and first check, the kinds, the word list and the gaps', async () => {
    const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
    const html = renderGrammarReviewHtml(9);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    for (const l of G9_ITEM_LESSONS) assert.ok(html.includes(esc(l.statement)), l.lessonId);
    assert.equal((html.match(/تأكدوا أولًا/g) ?? []).length, 19);
    assert.equal((html.match(/<b>الكلمات خارج قوائم المفردات<\/b>/g) ?? []).length, 19);
    assert.equal((html.match(/class="kind kind-form"/g) ?? []).length + (html.match(/class="kind kind-meaning"/g) ?? []).length, 760);
    // Every Grade 9 grammar topic of the book now has a hub lesson, so the form has no «lessons the hub does not carry» card.
    assert.ok(!html.includes('class="card gaps"'), 'no hub topic is left without a lesson');
  });

  it('lists each true sentence once per lesson page and each twin beside it', async () => {
    const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
    const html = renderGrammarReviewHtml(9);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    for (const id of LESSONS) for (const x of sentencesOf(id)) {
      assert.ok(html.includes(`<td class="sentence" dir="ltr">${esc(x.text)}</td>`), x.text);
      assert.ok(html.includes(`<span class="yn yn-no" dir="ltr">${esc(x.claim!.falseText)}</span>`), x.claim!.falseText);
    }
  });
});
