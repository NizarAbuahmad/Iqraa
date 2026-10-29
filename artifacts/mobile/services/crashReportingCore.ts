/**
 * The part of crash reporting that has no native code, so `node --test` can load
 * it (the mobile test runner has no React Native transform — see CLAUDE.md).
 *
 * Iqraa holds children's names, notes and marks. A crash report leaves the device
 * and goes to a third party, so whatever *we* choose to send is scrubbed first:
 * emails, tokens, share and login codes, long numbers and URL query strings are
 * replaced, and the text is cut short. Names cannot be recognised by a pattern,
 * which is the other reason nothing user-typed is ever attached on purpose — no
 * user id, no email, no class or student name; the only context is the role.
 *
 * Limit: Crashlytics also catches fatal JavaScript errors and unhandled promise
 * rejections *itself*, with the raw `error.message`. We cannot scrub those; they
 * are technical messages in practice, but a message that embeds typed text would
 * reach Google as written. Keep PII out of `new Error(...)` messages.
 */

const MAX_MESSAGE = 300;
const MAX_STACK = 4000;

const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\beyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}/g, '<token>'],
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, '$1 <token>'],
  // These two run right after the JWT and Bearer rules and BEFORE the rest. A JWT's signature is also 43
  // base64url characters, so they must not see one first (the signature would become <token> and the JWT rule
  // would no longer match, leaving the header and payload in the report). A consent token is base64url too, so
  // it can hold a dash-flanked run of digits or capitals that the number and login-code rules below would
  // otherwise rewrite, leaving the rest of the token in the report.
  // A parent's consent link carries its token in the fragment; the token alone is 43 base64url characters.
  [/#[A-Za-z0-9_-]{16,}/g, '#<fragment>'],
  // Not `\b`: a base64url token may start or end with "-", which is not a word character.
  [/(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g, '<token>'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>'],
  // The student link, /take/ABC234: short-lived, but it opens a class roster.
  [/\/take\/[A-Za-z0-9]{4,}/g, '/take/<code>'],
  // A 12-character personal login code: letters and digits both present.
  [/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{12}\b/g, '<code>'],
  // Phone numbers, national ids, verification codes.
  [/\b\d{6,}\b/g, '<number>'],
  [/\?[^\s"'`)]*/g, '?<query>'],
];

/** Replace anything that could identify a person, then cut to `max` characters. */
export function scrub(text: string, max: number = MAX_MESSAGE): string {
  let out = text;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/**
 * Failures that say "the phone has no signal", not "the app is broken". On a mobile
 * connection these are constant and would bury every real report.
 */
export function isNoise(error: Error): boolean {
  if (error.name === 'AbortError') return true;
  return /network request failed|failed to fetch|load failed/i.test(error.message);
}

function describe(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return String(value);
  } catch {
    return 'Unprintable error';
  }
}

/**
 * What may be sent for a caught error: a new `Error` with the same name, a scrubbed
 * message and stack — or `null` when it is connectivity noise.
 */
export function scrubbedError(value: unknown): Error | null {
  const source = value instanceof Error ? value : new Error(describe(value));
  if (isNoise(source)) return null;
  const clean = new Error(scrub(source.message));
  clean.name = source.name;
  clean.stack = source.stack ? scrub(source.stack, MAX_STACK) : undefined;
  return clean;
}

const ROLES = new Set(['teacher', 'parent', 'student', 'admin']);

/** The only thing we attach to a report. Anything else becomes `undefined`. */
export function safeRole(role: unknown): string | undefined {
  return typeof role === 'string' && ROLES.has(role) ? role : undefined;
}

/** Crashlytics cannot delete an attribute, only overwrite it; this is what a signed-out phone carries. */
export const clearAttribute = 'none';

export type CrashContext = { role?: unknown };
