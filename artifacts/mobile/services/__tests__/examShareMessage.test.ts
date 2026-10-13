/**
 * The text a teacher posts to a class chat to hand out an exam.
 *
 * It is the whole hand-out: students read it, tap the link, and pick their
 * name. So it must carry the link AND the code (a student without the link can
 * still type the code), name the exam, and never post a link with no code.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildExamShareMessage } from '../examShareMessage.ts';

const base = { title: 'اختبار الوحدة الأولى', shareCode: 'K7M2QX', origin: 'https://app.iqrra.com' };

describe('buildExamShareMessage', () => {
  it('carries the title, the code and the link, in Arabic', () => {
    const m = buildExamShareMessage({ ...base, lang: 'ar' });
    assert.ok(m.includes('اختبار الوحدة الأولى'));
    assert.ok(m.includes('K7M2QX'));
    assert.ok(m.includes('https://app.iqrra.com/take/K7M2QX'));
    assert.match(m, /[؀-ۿ]{3,}/);
  });

  it('is in English when the app is', () => {
    const m = buildExamShareMessage({ ...base, title: 'Unit 1 test', lang: 'en' });
    assert.ok(m.includes('Unit 1 test'));
    assert.ok(m.includes('https://app.iqrra.com/take/K7M2QX'));
    assert.doesNotMatch(m, /[؀-ۿ]/);
  });

  it('puts the link on its own line so a chat linkifies all of it', () => {
    const m = buildExamShareMessage({ ...base, lang: 'ar' });
    assert.ok(m.split('\n').includes('https://app.iqrra.com/take/K7M2QX'));
  });

  it('falls back to a generic name when the exam has no title', () => {
    const m = buildExamShareMessage({ ...base, title: '   ', lang: 'ar' });
    assert.ok(m.includes('K7M2QX'));
    assert.ok(!m.includes('undefined'));
  });

  it('refuses to build a message with no code — there is nothing to share', () => {
    assert.throws(() => buildExamShareMessage({ ...base, shareCode: '', lang: 'ar' }));
  });

  it('stays inside the chat length limit even for a very long title', () => {
    const m = buildExamShareMessage({ ...base, title: 'س'.repeat(5000), lang: 'ar' });
    assert.ok(m.length <= 4000);
    assert.ok(m.includes('https://app.iqrra.com/take/K7M2QX'));
  });
});
