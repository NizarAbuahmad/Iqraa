// The teacher newsletter's draft (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
// which «ما الجديد» notes go in, in both languages, and the one-time opening sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWSLETTER_SUBJECT, buildNewsletterDraft } from '../newsletterDraft.ts';
import type { WhatsNewEntry } from '../whatsNew.ts';

const entry = (id: string, date: string, over: Partial<WhatsNewEntry> = {}): WhatsNewEntry =>
  ({ id, date, roles: ['teacher'], titleKey: `${id}Title`, bodyKey: `${id}Body`, ...over }) as WhatsNewEntry;
const ar = (k: string) => `ع:${k}`;
const en = (k: string) => `E:${k}`;
const draft = (entries: WhatsNewEntry[], since: string | null, today = '2026-11-20') =>
  buildNewsletterDraft({ entries, since, today, ar, en });

test('takes teacher notes after the last issue and up to today, newest first', () => {
  const out = draft(
    [
      entry('future', '2026-11-21'),
      entry('b', '2026-11-20', { route: '/iqra' }),
      entry('a', '2026-11-05'),
      entry('sameDay', '2026-11-01'),
      entry('old', '2026-10-20'),
      entry('student', '2026-11-10', { roles: ['student'] }),
    ],
    '2026-11-01',
  );
  assert.equal(out.count, 2);
  assert.equal(out.subject, NEWSLETTER_SUBJECT);
  assert.ok(out.body.indexOf('ع:bTitle') < out.body.indexOf('ع:aTitle'));
  for (const gone of ['future', 'sameDay', 'old', 'student']) assert.ok(!out.body.includes(`${gone}Title`), gone);
});

test('writes an Arabic block, then an English block, each note with its link', () => {
  const out = draft([entry('b', '2026-11-20', { route: '/iqra' }), entry('a', '2026-11-05')], '2026-11-01');
  assert.equal(
    out.body,
    [
      'ع:bTitle\nع:bBody\nhttps://app.iqrra.com/iqra',
      'ع:aTitle\nع:aBody',
      'E:bTitle\nE:bBody\nhttps://app.iqrra.com/iqra',
      'E:aTitle\nE:aBody',
    ].join('\n\n'),
  );
});

test('with no issue sent yet, looks back 31 days and opens by saying what this mail is', () => {
  const out = draft([entry('in', '2026-10-21'), entry('out', '2026-10-20')], null);
  assert.equal(out.count, 1);
  assert.ok(out.body.includes('inTitle'));
  assert.ok(!out.body.includes('outTitle'));
  const paragraphs = out.body.split('\n\n');
  assert.match(paragraphs[0]!, /رسالة إقرأ الشهرية للمعلّمين/);
  assert.match(paragraphs[0]!, /إلغاء الاشتراك/);
  assert.match(paragraphs[2]!, /^This is Iqrra's monthly email for teachers/);
  assert.match(paragraphs[2]!, /Unsubscribe/);
});

test('the first issue is: Arabic intro, Arabic block, English intro, English block', () => {
  const out = draft([entry('in', '2026-11-10', { route: '/iqra' })], null);
  assert.equal(
    out.body,
    [
      'هذه رسالة إقرأ الشهرية للمعلّمين: ما الجديد في التطبيق. لإيقافها اضغط «إلغاء الاشتراك» أسفل الرسالة.',
      'ع:inTitle\nع:inBody\nhttps://app.iqrra.com/iqra',
      "This is Iqrra's monthly email for teachers: what is new in the app. To stop it, press Unsubscribe at the bottom.",
      'E:inTitle\nE:inBody\nhttps://app.iqrra.com/iqra',
    ].join('\n\n'),
  );
});

test('a later issue has no opening sentence', () => {
  const out = draft([entry('a', '2026-11-05')], '2026-11-01');
  assert.ok(!out.body.includes('monthly email'));
  assert.ok(!out.body.includes('الشهرية'));
});

test('nothing new gives an empty body', () => {
  assert.deepEqual(draft([entry('old', '2026-10-01')], '2026-11-01'), { subject: NEWSLETTER_SUBJECT, body: '', count: 0 });
  assert.equal(draft([], null).body, '');
});
