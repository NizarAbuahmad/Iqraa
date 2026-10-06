/**
 * `chat_unanswered` — every turn where the chat asked back or gave up instead
 * of answering. Item 6 of the "make the chat smarter" list: the dead ends
 * reached us as screenshots («علمني» → «وضّح لي أكثر»), one at a time.
 *
 * Privacy, decided 2026-10-05: the teacher's own words go to PostHog only when
 * the message is 4 words or fewer, with digits and handles masked. A dead end
 * is almost always short («علمني», «نعم», «الثاني»), and a long message — the
 * kind that could name a student — never leaves the device; it sends only its
 * length, as `feature_suggested` already does.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { askSample, unansweredEventProps } from '../chatUnanswered.ts';
import { classifyChatIntent } from '../ai/intentRouter.ts';

describe('askSample — short asks are kept, long ones never are', () => {
  it('keeps a one-word dead end verbatim', () => assert.equal(askSample('علمني'), 'علمني'));
  it('keeps up to four words', () => assert.equal(askSample('اشرح لي الدرس الثاني'), 'اشرح لي الدرس الثاني'));
  it('drops five words or more — only the length is sent', () => {
    assert.equal(askSample('أريد خطة درس لطالبتي سارة غداً'), undefined);
  });
  it('trims and collapses spaces before counting', () => assert.equal(askSample('  نعم   تمام '), 'نعم تمام'));
  it('masks Latin and Arabic-Indic digits — a phone or a mark is not a phrase', () => {
    assert.equal(askSample('رقمي 0791234567'), 'رقمي #');
    assert.equal(askSample('علامة ٨٥ و ۹٠'), 'علامة # و #');
  });
  it('masks emails and @handles', () => {
    assert.equal(askSample('راسل sara@school.jo'), 'راسل @');
    assert.equal(askSample('اسأل @nizar'), 'اسأل @');
  });
  it('masks links', () => assert.equal(askSample('افتح https://x.jo/a?b=1'), 'افتح url'));
  it('nothing for an empty message', () => assert.equal(askSample('   '), undefined));
  it('caps a long single "word" (pasted blob) — never more than 60 characters', () => {
    assert.equal(askSample('ا'.repeat(200)), undefined);
  });
});

describe('unansweredEventProps — what the event carries', () => {
  it('a short ask: kind, language, lesson state, size and the masked words', () => {
    assert.deepEqual(
      unansweredEventProps({ kind: 'which_subject', query: 'علمني', lang: 'ar', lessonOpen: true }),
      { kind: 'which_subject', lang: 'ar', lessonOpen: true, words: 1, chars: 5, ask: 'علمني' },
    );
  });
  it('a long ask: no `ask` key at all, only its size', () => {
    const p = unansweredEventProps({
      kind: 'out_of_scope', query: 'كيف أتعامل مع الطالب أحمد الذي يزعج الصف', lang: 'ar', lessonOpen: false,
    });
    assert.equal('ask' in p, false);
    assert.equal(p.words, 8);
  });
  it('every value is a string, number or boolean — PostHog\'s property type', () => {
    const p = unansweredEventProps({ kind: 'generic', query: 'نعم', lang: 'ar', lessonOpen: false });
    for (const v of Object.values(p)) assert.ok(['string', 'number', 'boolean'].includes(typeof v));
  });
});

describe('the router says which question it asked', () => {
  it('generic', () => assert.equal(classifyChatIntent('نعم', 'ar').clarify, 'generic'));
  it('lesson-named, when a lesson is open', () => {
    assert.equal(
      classifyChatIntent('نعم', 'ar', false, undefined, { activeLessonTitle: 'تركيب الاقترانات' }).clarify,
      'lesson_named',
    );
  });
  it('which lesson, for a bare «علمني» with nothing open', () => {
    assert.equal(classifyChatIntent('علمني', 'ar').clarify, 'which_lesson_bare');
  });
  it('nothing on an answer, or on a greeting', () => {
    assert.equal(classifyChatIntent('اشرح المشتقات', 'ar').clarify, undefined);
    assert.equal(classifyChatIntent('مرحبا', 'ar').clarify, undefined);
  });
});
