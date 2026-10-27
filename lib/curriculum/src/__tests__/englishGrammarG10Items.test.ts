/**
 * Grade 10 grammar on the authored lessons (Semester 1: docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md;
 * Semester 2: docs/superpowers/specs/2026-10-24-english-corner-grammar-g10-s2-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor and the force of a
 * marker are a teacher's call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, renderGrammarSheet, unitSentences } from '../englishGrammar.ts';
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { G10_ITEM_LESSONS } from '../englishGrammarG10Items.ts';
import { GRAMMAR_ONLY_LESSONS, hubLesson } from '../englishHub.ts';

const dataFile = (id: string) =>
  JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g10_english_sem${id.includes('-s2-') ? 2 : 1}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-eng-s1-nccd-${s}`;
const L2 = (s: string) => `kbl-eng-s2-nccd-${s}`;
const FIRST = ['u1_l1', 'u1_l5', 'u2_l1', 'u2_l4', 'u3_l1'].map(L);
const REST = ['u3_l4', 'u3_l5', 'u4_l1', 'u4_l4', 'u5_l1', 'u5_l3'].map(L);
const S2A = ['u6_l1', 'u6_l4', 'u7_l1', 'u7_l5', 'u8_l1'].map(L2);
const S2B = ['u8_l6', 'u9_l1', 'u9_l4', 'u10_l1', 'u10_l3'].map(L2);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G10_ITEM_LESSONS.map(l => l.lessonId);

/** topic: [size, kind] — the kind is pinned per sub-topic, so a meaning item cannot appear outside the topics meant for it. */
const SIZES: Record<string, Record<string, [number, 'form' | 'meaning']>> = {
  [L('u1_l1')]: { 'habit-markers': [12, 'meaning'], 'temporary-markers': [12, 'meaning'], stative: [8, 'form'], questions: [8, 'form'] },
  [L('u1_l5')]: { 'a-an': [8, 'form'], 'already-mentioned': [12, 'meaning'], 'unique-things': [10, 'form'], 'no-article': [10, 'form'] },
  [L('u2_l1')]: { 'result-count': [14, 'meaning'], duration: [14, 'meaning'], forms: [12, 'form'] },
  [L('u2_l4')]: { ing: [14, 'form'], to: [14, 'form'], 'change-of-meaning': [12, 'meaning'] },
  [L('u3_l1')]: { interrupted: [14, 'meaning'], 'earlier-event': [14, 'meaning'], forms: [12, 'form'] },
  [L('u3_l4')]: { 'used-to-states': [14, 'meaning'], 'would-habits': [12, 'meaning'], forms: [14, 'form'] },
  [L('u3_l5')]: { 'could-you-tell': [14, 'form'], 'do-you-know': [14, 'form'], 'if-whether': [12, 'form'] },
  [L('u4_l1')]: { obligation: [14, 'meaning'], 'ability-permission': [14, 'meaning'], forms: [12, 'form'] },
  [L('u4_l4')]: { defining: [12, 'form'], 'non-defining': [14, 'form'], 'whose-where': [14, 'form'] },
  [L('u5_l1')]: { 'will-decisions': [10, 'meaning'], 'going-to-evidence': [10, 'meaning'], 'arrangements-timetables': [12, 'form'], forms: [8, 'form'] },
  [L('u5_l3')]: { continuous: [14, 'meaning'], perfect: [14, 'meaning'], forms: [12, 'form'] },
  [L2('u6_l1')]: { 'first-conditional': [12, 'form'], 'second-conditional': [12, 'form'], 'imagine-vs-real': [16, 'meaning'] },
  [L2('u6_l4')]: { 'if-present': [14, 'form'], 'when-general-truths': [14, 'form'], 'questions-negatives': [12, 'form'] },
  [L2('u7_l1')]: { 'verb-patterns': [16, 'form'], 'admit-deny-suggest': [14, 'form'], 'tell-ask-warn': [10, 'form'] },
  [L2('u7_l5')]: { 'ask-wonder': [14, 'form'], 'if-whether': [12, 'form'], 'word-order': [14, 'form'] },
  [L2('u8_l1')]: { 'present-past': [14, 'form'], 'with-modals': [12, 'form'], 'questions-negatives': [14, 'form'] },
  [L2('u8_l6')]: { 'have-something-done': [12, 'form'], 'get-something-done': [12, 'form'], 'service-vs-self': [16, 'meaning'] },
  [L2('u9_l1')]: { 'third-conditional': [14, 'form'], 'past-unreal': [14, 'meaning'], 'would-have-forms': [12, 'form'] },
  [L2('u9_l4')]: { 'wish-present': [14, 'form'], 'wish-past-regrets': [14, 'meaning'], 'if-only': [12, 'form'] },
  [L2('u10_l1')]: { 'must-cant': [14, 'meaning'], 'might-may': [12, 'form'], 'be-v-ing': [14, 'form'] },
  [L2('u10_l3')]: { 'must-have': [14, 'meaning'], 'might-could-have': [12, 'form'], 'cant-have': [14, 'meaning'] },
};

describe('Grade 10 authored lessons', () => {
  it('are the hub lessons in order, unsigned and offered to nobody', () => {
    assert.deepEqual(ids(), [...FIRST, ...REST, ...S2A, ...S2B]);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grade, 10, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it('make Articles and every Semester 2 lesson grammar-only, under the word floor, and the rest lessons with words', () => {
    const grammarOnly = (id: string) => id === L('u1_l5') || id.includes('-s2-');
    for (const id of ids()) {
      assert.equal(!!hubLesson(id)!.grammarOnly, grammarOnly(id), id);
      assert.equal(GRAMMAR_ONLY_LESSONS.includes(id), grammarOnly(id), id);
    }
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G10_ITEM_LESSONS) {
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile(l.lessonId).units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('are 21 lessons and 840 items, 308 of them meaning-decided', () => {
    assert.equal(G10_ITEM_LESSONS.length, 21);
    assert.equal(G10_ITEM_LESSONS.reduce((n, l) => n + sentencesOf(l.lessonId).length, 0), 840);
    assert.equal(grammarUnitsForGrade(10).length, 21);
    const meaning = ids().flatMap(id => sentencesOf(id)).filter(x => x.kind === 'meaning').length;
    assert.equal(meaning, 308);
    assert.equal(meaning, Object.values(SIZES).flatMap(s => Object.values(s)).filter(([, k]) => k === 'meaning').reduce((n, [size]) => n + size, 0));
  });

  it('give 40 items a lesson in the pinned sub-topic sizes and kinds', () => {
    for (const [id, sizes] of Object.entries(SIZES)) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      for (const [topic, [size, kind]] of Object.entries(sizes)) {
        const own = s.filter(x => x.patternId === topic);
        assert.equal(own.length, size, `${id} ${topic}`);
        assert.ok(own.every(x => x.kind === kind), `${id} ${topic} must be ${kind}`);
      }
      assert.deepEqual([...new Set(s.map(x => x.patternId))].sort(), Object.keys(sizes).sort(), id);
    }
  });

  it('are buildable, picture-free, unique and never a Yes or No', () => {
    for (const id of ids()) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id} ${x.text}`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.ok(x.kind === 'form' || x.kind === 'meaning', x.text);
        assert.ok(!seen.has(x.text), `duplicate ${x.text}`);
        seen.add(x.text);
      }
      for (const x of s) assert.ok(!seen.has(x.claim!.falseText), `twin of «${x.text}» is a true sentence`);
    }
  });

  it('have a distractor that differs and a silent twin that differs from the sentence', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
      assert.notEqual(x.claim!.falseText, x.text, x.text);
      assert.equal(x.claim!.voiced, false, x.text);
    }
  });

  it('contain no capitalised name (only a sentence start, I, a family word or a place)', () => {
    const ok = new Set(['I', "I'm", "I'd", "I'll", "I've", 'Dad', 'Mum', 'TV', 'Jordan', 'Amman', 'Aqaba', 'Petra', 'Irbid', 'Sun', 'Moon', 'Earth', 'Mars', 'Saturday', 'Sunday', 'Monday', 'Friday', 'Fridays', 'English', 'French', 'Arabic']);
    for (const id of ids()) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
    }
  });

  it('never use a bare past simple as a present perfect distractor', () => {
    const past = new Set('saw did went ate took wrote broke wore gave drew threw knew spoke rode sang swam drank began chose fell forgot hid flew grew shook stole woke came became ran'.split(' '));
    for (const x of sentencesOf(L('u2_l1')).filter(y => y.patternId === 'forms')) {
      for (const w of x.choose!.wrong.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/)) assert.ok(!past.has(w), `${x.text}: ${w}`);
    }
  });

  it('keep a have/has auxiliary in every present perfect form twin, so no twin is a regular past', () => {
    for (const x of sentencesOf(L('u2_l1')).filter(y => y.patternId === 'forms')) {
      const words = x.claim!.falseText.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/);
      assert.ok(words.some(w => ['has', 'have', "hasn't", "haven't"].includes(w)), `${x.text}: ${x.claim!.falseText}`);
    }
  });

  it('never use will or would in a zero-conditional distractor, which would be a grammatical first or second conditional', () => {
    for (const x of sentencesOf(L2('u6_l4'))) {
      assert.ok(!/\b(will|would|won't|wouldn't)\b/i.test(x.choose!.wrong), `${x.text}: ${x.choose!.wrong}`);
    }
  });

  it('never write must of or could of in a past-speculation sentence or its twin', () => {
    for (const x of sentencesOf(L2('u10_l3'))) {
      assert.ok(!/\b(must|might|could|can't) of\b/i.test(x.text + ' ' + x.claim!.falseText), x.text);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 10', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(10).length, ids().length);
  });
});

describe('the Grade 10 teacher form', () => {
  const html = renderGrammarReviewHtml(10);
  const docs = (name: string) => readFileSync(new URL(`../../../../docs/${name}`, import.meta.url), 'utf8');
  it('equals the committed form and sheet', () => {
    assert.equal(docs('english-grammar-g10-review.html'), html);
    assert.equal(docs('english-grammar-g10-sheet.md'), renderGrammarSheet(10));
  });
  it("prints each lesson's book statement and the first check, the lesson id without a grade prefix, and a kind for every item", () => {
    for (const l of G10_ITEM_LESSONS) assert.ok(html.includes(l.statement.replace(/'/g, '&#39;')) || html.includes(l.statement), l.lessonId);
    assert.ok(html.includes('تأكدوا أولًا'));
    assert.ok(html.includes('الكلمات خارج قوائم المفردات'));
    assert.equal(html.split('class="unit"').length - 1, 21);
    assert.ok(html.includes('الصف العاشر'));
    assert.ok(html.includes('>s1-nccd-u1_l5<'), 'the id shown without its kbl-eng- prefix');
    assert.ok(html.includes('>s2-nccd-u6_l1<'));
    assert.ok(html.includes('>s2-nccd-u10_l3<'));
    assert.ok(!html.includes('>kbl-eng-'), 'no un-stripped id');
    assert.equal((html.match(/<span class="kind kind-meaning"/g) ?? []).length, 308);
    assert.equal((html.match(/<span class="kind kind-form"/g) ?? []).length, 532);
  });
  it('names both semesters in its lead', () => {
    assert.ok(html.includes('الفصلان الأول والثاني'));
    assert.ok(!html.includes('الفصل الأول:'));
  });
  it('lists every sentence', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) assert.ok(html.includes(x.text.replace(/'/g, '&#39;')) || html.includes(x.text), x.text);
  });
  it('never glues «و» to an English word in its printed text', () => {
    const text = html.replace(/<[^>]+>/g, '');
    const glued = text.match(/[ء-ي]و[A-Za-z]|(^|\s)و[A-Za-z]/g) ?? [];
    assert.deepEqual(glued, []);
  });
  it('leaves the other grades alone', () => {
    for (const g of [1, 2, 3, 4, 5, 9]) assert.equal(docs(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `grade ${g}`);
  });
});
