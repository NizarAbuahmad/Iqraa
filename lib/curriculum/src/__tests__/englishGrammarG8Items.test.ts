/**
 * Grade 8 grammar on the authored Semester 1 lessons (docs/superpowers/specs/2026-11-04-english-corner-grammar-g8-s1-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor and the force of a
 * marker are a teacher's call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, renderGrammarSheet, unitSentences } from '../englishGrammar.ts';
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { G8_ITEM_LESSONS } from '../englishGrammarG8Items.ts';
import { GRAMMAR_ONLY_LESSONS, hubLesson } from '../englishHub.ts';

const dataFile = () => JSON.parse(readFileSync(new URL('../data/iqra_curriculum_g8_eng_sem1.json', import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g8-eng-s1-nccd-${s}`;
const FIRST = ['u1_l1', 'u1_l3', 'u2_l1', 'u2_l3', 'u3_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G8_ITEM_LESSONS.map(l => l.lessonId);

/** topic: [size, kind] — the kind is pinned per sub-topic, so a meaning item cannot appear outside the topics meant for it. */
const SIZES: Record<string, Record<string, [number, 'form' | 'meaning']>> = {
  [L('u1_l1')]: { 'third-person-s': [14, 'form'], 'spelling-es': [12, 'form'], negatives: [14, 'form'] },
  [L('u1_l3')]: { 'do-does-questions': [14, 'form'], 'question-words': [12, 'form'], 'adverb-position': [14, 'form'] },
  [L('u2_l1')]: { 'there-is-are': [14, 'form'], 'some-any': [14, 'form'], 'questions-negatives': [12, 'form'] },
  [L('u2_l3')]: { 'can-form': [14, 'form'], 'can-questions': [12, 'form'], 'can-vs-cant': [14, 'meaning'] },
  [L('u3_l1')]: { 'plural-nouns': [12, 'form'], uncountable: [14, 'form'], 'a-an-some': [14, 'form'] },
};

describe('Grade 8 authored lessons', () => {
  it('are the hub lessons in order, unsigned and offered to nobody', () => {
    assert.deepEqual(ids(), FIRST);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grade, 8, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it('are, for now, lessons with words and none of them grammar-only', () => {
    for (const id of ids()) {
      assert.equal(!!hubLesson(id)!.grammarOnly, false, id);
      assert.equal(GRAMMAR_ONLY_LESSONS.includes(id), false, id);
    }
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G8_ITEM_LESSONS) {
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile().units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('are 5 lessons and 200 items, 14 of them meaning-decided', () => {
    assert.equal(G8_ITEM_LESSONS.length, 5);
    assert.equal(G8_ITEM_LESSONS.reduce((n, l) => n + sentencesOf(l.lessonId).length, 0), 200);
    assert.equal(grammarUnitsForGrade(8).length, 5);
    const meaning = ids().flatMap(id => sentencesOf(id)).filter(x => x.kind === 'meaning').length;
    assert.equal(meaning, 14);
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

  it('use only nouns with no ordinary plural in the uncountable sub-topic', () => {
    const countableToo = /\b(sugar|fruit|paper|chicken|coffee|tea|cake|glass|juice)s?\b/i;
    for (const x of sentencesOf(L('u3_l1')).filter(y => y.patternId === 'uncountable')) {
      assert.ok(!countableToo.test(x.text), x.text);
    }
  });

  it('never test the adverb «sometimes» for position', () => {
    for (const x of sentencesOf(L('u1_l3')).filter(y => y.patternId === 'adverb-position')) {
      assert.ok(!/\bsometimes\b/i.test(x.text), x.text);
    }
  });

  it('state the clue for can / can\'t in a so or but clause', () => {
    for (const x of sentencesOf(L('u2_l3')).filter(y => y.patternId === 'can-vs-cant')) {
      assert.ok(/\b(so|but)\b/i.test(x.text), x.text);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 8', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(8).length, ids().length);
  });
});

describe('the Grade 8 teacher form', () => {
  const html = renderGrammarReviewHtml(8);
  const docs = (name: string) => readFileSync(new URL(`../../../../docs/${name}`, import.meta.url), 'utf8');
  it('equals the committed form and sheet', () => {
    assert.equal(docs('english-grammar-g8-review.html'), html);
    assert.equal(docs('english-grammar-g8-sheet.md'), renderGrammarSheet(8));
  });
  it("prints each lesson's book statement and the first check, the lesson id without a grade prefix, and a kind for every item", () => {
    for (const l of G8_ITEM_LESSONS) assert.ok(html.includes(l.statement.replace(/'/g, '&#39;')) || html.includes(l.statement), l.lessonId);
    assert.ok(html.includes('تأكدوا أولًا'));
    assert.ok(html.includes('الكلمات خارج قوائم المفردات'));
    assert.equal(html.split('class="unit"').length - 1, 5);
    assert.ok(html.includes('الصف الثامن'));
    assert.ok(html.includes('>s1-nccd-u1_l1<'), 'the id shown without its kbl-g8-eng- prefix');
    assert.ok(html.includes('>s1-nccd-u3_l1<'));
    assert.ok(!html.includes('>kbl-g8-'), 'no un-stripped id');
    assert.equal((html.match(/<span class="kind kind-meaning"/g) ?? []).length, 14);
    assert.equal((html.match(/<span class="kind kind-form"/g) ?? []).length, 186);
  });
  it('names Semester 1 in its lead', () => {
    assert.ok(html.includes('الفصل الأول'));
    assert.ok(!html.includes('الفصل الثاني'));
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
    for (const g of [1, 2, 3, 4, 5, 9, 10]) assert.equal(docs(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `grade ${g}`);
  });
});
