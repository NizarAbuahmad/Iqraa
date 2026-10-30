/**
 * «ردّ بالبريد» on the admin's «البريد المجمّع»: a reply draft for an idea or a
 * contact message that left an email, in the sender's language, quoting them.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/adminReplyMail.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QUOTE_LIMIT, canReplyByMail, replyMailto, type ReplyableRow } from '../adminReplyMail.ts';

const idea = (over: Partial<ReplyableRow> = {}): ReplyableRow => ({
  kind: 'idea', email: 'teacher@example.com', name: '', message: 'اريد تصدير ورقة الى وورد', ...over,
});

function parse(link: string) {
  assert.ok(link.startsWith('mailto:'), link);
  const [to, query] = link.slice('mailto:'.length).split('?');
  const params = new URLSearchParams(query);
  return { to, subject: params.get('subject') ?? '', body: params.get('body') ?? '', query };
}

describe('canReplyByMail', () => {
  it('answers ideas and contact messages that carry an email', () => {
    assert.equal(canReplyByMail(idea()), true);
    assert.equal(canReplyByMail(idea({ kind: 'contact' })), true);
  });

  it('offers nothing when the visitor left no email', () => {
    assert.equal(canReplyByMail(idea({ email: '' })), false);
    assert.equal(replyMailto(idea({ email: '   ' })), null);
  });

  it('leaves waitlist rows to the invite button', () => {
    assert.equal(canReplyByMail(idea({ kind: 'waitlist' })), false);
  });

  it('refuses an address that would break into the link’s query', () => {
    assert.equal(replyMailto(idea({ email: 'a@b.com?bcc=x@y.com' })), null);
    assert.equal(replyMailto(idea({ email: 'a@b.com&body=hi' })), null);
  });
});

describe('replyMailto', () => {
  it('addresses the sender and quotes their message', () => {
    const { to, body } = parse(replyMailto(idea())!);
    assert.equal(to, 'teacher@example.com');
    assert.ok(body.includes('> اريد تصدير ورقة الى وورد'), body);
  });

  it('writes an Arabic draft for an Arabic message', () => {
    const { subject, body } = parse(replyMailto(idea())!);
    assert.equal(subject, 'بخصوص اقتراحك لتطبيق «إقرأ»');
    assert.ok(body.startsWith('مرحبًا،'), body);
  });

  it('writes an English draft for an English message', () => {
    const { subject, body } = parse(replyMailto(idea({ message: 'Please add Word export' }))!);
    assert.equal(subject, 'About your Iqrra suggestion');
    assert.ok(body.startsWith('Hello,'), body);
  });

  it('greets the sender by name when they gave one', () => {
    assert.ok(parse(replyMailto(idea({ name: 'سناء' }))!).body.startsWith('مرحبًا سناء،'));
  });

  it('says «رسالتك», not «اقتراحك», for a contact message', () => {
    const { subject, body } = parse(replyMailto(idea({ kind: 'contact' }))!);
    assert.equal(subject, 'بخصوص رسالتك إلى «إقرأ»');
    assert.ok(!body.includes('اقتراحك'), body);
  });

  it('quotes every line of a multi-line message', () => {
    const { body } = parse(replyMailto(idea({ message: 'السطر الأول\nالسطر الثاني' }))!);
    assert.ok(body.includes('> السطر الأول\r\n> السطر الثاني'), body);
  });

  it('cuts a long message so the link stays short enough for mail apps', () => {
    const { body } = parse(replyMailto(idea({ message: 'أ'.repeat(QUOTE_LIMIT * 3) }))!);
    assert.ok(body.includes(`${'أ'.repeat(QUOTE_LIMIT)}…`), 'quoted up to the limit');
    assert.ok(!body.includes('أ'.repeat(QUOTE_LIMIT + 1)), 'and no further');
  });

  it('percent-encodes spaces and line breaks (mail apps read `+` literally)', () => {
    const { query } = parse(replyMailto(idea({ message: 'Please add Word export' }))!);
    assert.ok(!/[ +\n\r]/.test(query), query);
    assert.ok(query.includes('%20') && query.includes('%0D%0A'), query);
  });
});
