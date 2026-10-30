/**
 * «ردّ بالبريد» on «البريد المجمّع» (`app/admin/signups.tsx`): a `mailto:` link
 * that opens the admin's own mail app on a reply to an idea or a contact
 * message, with the sender's words quoted under it.
 *
 * Only for rows that carry an email. A signed-out visitor's idea may come with
 * none (the field is optional), and then nothing can reach them — the screen
 * shows no button rather than one that opens an empty draft.
 *
 * The reply is written in the sender's language, read off their message, not in
 * the admin's UI language: an Arabic idea gets an Arabic draft whichever way the
 * dashboard is set.
 *
 * Kept out of the screen so a test can load it: the mobile runner cannot import
 * anything that pulls in `react-native`.
 */

export type ReplyableRow = {
  kind: 'waitlist' | 'contact' | 'idea';
  email: string;
  name: string;
  message: string;
};

/** Quoting the whole of a 2,000-character message makes a URL some mail apps refuse. */
export const QUOTE_LIMIT = 600;

const ARABIC = /[؀-ۿ]/;
// The API already checked the address; this only keeps `?`, `&` or `#` from
// ever reaching the link, where they would start its query.
const PLAIN_EMAIL = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/;

export function canReplyByMail(row: ReplyableRow): boolean {
  return (row.kind === 'idea' || row.kind === 'contact') && PLAIN_EMAIL.test(row.email.trim());
}

/** The `mailto:` link for a reply to `row`, or null when it cannot be answered by mail. */
export function replyMailto(row: ReplyableRow): string | null {
  if (!canReplyByMail(row)) return null;
  const ar = ARABIC.test(row.message);
  const name = row.name.trim();
  const message = row.message.trim();
  const quoted = message.length > QUOTE_LIMIT ? `${message.slice(0, QUOTE_LIMIT).trimEnd()}…` : message;
  const quote = quoted.split(/\r?\n/).map(line => `> ${line}`).join('\r\n');

  const subject = row.kind === 'idea'
    ? (ar ? 'بخصوص اقتراحك لتطبيق «إقرأ»' : 'About your Iqrra suggestion')
    : (ar ? 'بخصوص رسالتك إلى «إقرأ»' : 'About your message to Iqrra');
  const greeting = ar ? (name ? `مرحبًا ${name}،` : 'مرحبًا،') : (name ? `Hello ${name},` : 'Hello,');
  const thanks = row.kind === 'idea'
    ? (ar ? 'شكرًا على اقتراحك.' : 'Thank you for your suggestion.')
    : (ar ? 'شكرًا على رسالتك.' : 'Thank you for your message.');
  const quoteLead = row.kind === 'idea'
    ? (ar ? 'اقتراحك:' : 'Your suggestion:')
    : (ar ? 'رسالتك:' : 'Your message:');

  // RFC 6068 wants CRLF line breaks in a mailto body. The empty lines after the
  // thanks are where the admin writes.
  const body = [greeting, '', thanks, '', '', '', quoteLead, quote].join('\r\n');
  return `mailto:${row.email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
