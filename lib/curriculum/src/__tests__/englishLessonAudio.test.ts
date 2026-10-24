/**
 * The clips one hub lesson plays (`lessonAudioTexts`) — what the phone fetches ahead
 * when the lesson opens. It must agree with `audioPlan()`, the list the generator
 * voices: a text whose slug is not in the plan is a file that was never made, and
 * fetching it is a 404 against a rate-limited link.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ENGLISH_HUB_LESSONS, audioSlug, hubLesson } from '../englishHub.ts';
import { GRAMMAR_UNITS, unitSentences, unitSpoken } from '../englishGrammar.ts';
import { audioPlan, lessonAudioTexts } from '../englishAudioPlan.ts';

const planSlugs = new Set(audioPlan().map(i => i.slug));

/** The True-or-false twins the activity shows but never says (`claim.voiced === false`). */
function silentTwins(lessonId: string): string[] {
  const unit = GRAMMAR_UNITS.find(u => u.lessonId === lessonId);
  if (!unit) return [];
  const voiced = new Set(unitSpoken(unit));
  return unitSentences(unit)
    .filter(s => s.claim && s.claim.voiced === false)
    .map(s => s.claim!.falseText)
    .filter(t => !voiced.has(t));
}

describe('lessonAudioTexts', () => {
  it('every text it returns is a clip the generator voices, once per slug', () => {
    for (const l of ENGLISH_HUB_LESSONS) {
      const texts = lessonAudioTexts(l.id);
      const slugs = texts.map(audioSlug);
      assert.equal(new Set(slugs).size, slugs.length, `${l.id}: a slug twice`);
      for (const s of slugs) assert.ok(planSlugs.has(s), `${l.id}: «${s}» is not in audioPlan()`);
    }
  });

  it('the lessons between them ask for the whole plan — nothing voiced is unreachable', () => {
    const all = new Set(ENGLISH_HUB_LESSONS.flatMap(l => lessonAudioTexts(l.id).map(audioSlug)));
    assert.deepEqual([...planSlugs].filter(s => !all.has(s)), []);
  });

  it('a Grade 1 lesson: its words, then its grammar strings', () => {
    const id = 'kbl-g1-eng-s1-nccd-u2_l1';
    const lesson = hubLesson(id)!;
    assert.equal(lesson.grade, 1);
    const unit = GRAMMAR_UNITS.find(u => u.lessonId === id)!;
    const texts = lessonAudioTexts(id);
    const words = lesson.words.map(w => w.en);
    assert.deepEqual(texts.slice(0, words.length), words);
    for (const t of unitSpoken(unit)) assert.ok(texts.map(audioSlug).includes(audioSlug(t)), `«${t}» missing`);
  });

  it('grammar: false leaves only the words (a unit no teacher has signed is not shown)', () => {
    const id = 'kbl-g1-eng-s1-nccd-u2_l1';
    assert.deepEqual(
      lessonAudioTexts(id, { grammar: false }),
      hubLesson(id)!.words.map(w => w.en),
    );
  });

  it('a Grade 9 grammar-only lesson: its voiced grammar strings, never a silent twin', () => {
    const id = 'kbl-g9-eng-s2-nccd-u7_l1';
    assert.equal(hubLesson(id)!.grammarOnly, true);
    const texts = lessonAudioTexts(id);
    const unit = GRAMMAR_UNITS.find(u => u.lessonId === id)!;
    assert.ok(texts.length >= unitSpoken(unit).length && texts.length > 0);
    const twins = silentTwins(id);
    assert.ok(twins.length > 0, 'fixture: this lesson has silent True-or-false twins');
    for (const t of twins) assert.ok(!texts.includes(t), `silent twin «${t}» would be fetched`);
  });

  it('a Grade 10 Semester 2 lesson: voiced strings in, silent twins out', () => {
    const id = 'kbl-eng-s2-nccd-u6_l1';
    const lesson = hubLesson(id)!;
    assert.equal(lesson.grade, 10);
    assert.equal(lesson.semester, 2);
    const texts = lessonAudioTexts(id);
    const unit = GRAMMAR_UNITS.find(u => u.lessonId === id)!;
    assert.deepEqual(new Set(texts.map(audioSlug)), new Set(unitSpoken(unit).map(audioSlug)));
    const twins = silentTwins(id);
    assert.ok(twins.length > 0);
    for (const t of twins) assert.ok(!texts.includes(t), `silent twin «${t}» would be fetched`);
  });

  it('an unknown lesson asks for nothing', () => {
    assert.deepEqual(lessonAudioTexts('no-such-lesson'), []);
  });
});
