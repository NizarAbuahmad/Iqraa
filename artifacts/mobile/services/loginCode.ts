/**
 * The personal login code a parent or student gets when they sign up from a
 * teacher's code without an email — see api-server/src/lib/loginCode.ts for why
 * it exists and why it is 12 characters rather than the teacher's 6.
 *
 * No imports, so `node --test` can load it (see routeGating.ts for the rule).
 * The alphabet is restated, not shared: this app and the API are separate
 * bundles, and `loginCode.test.ts` pins the same letters the server's test does.
 */
export const LOGIN_CODE_LENGTH = 12;

/** No I, L, O, 0 or 1 — the same unambiguous alphabet as the teacher's codes. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** What the field holds as the person types or pastes: upper case, letters and digits only, never longer than a code. */
export function normalizeLoginCodeInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LOGIN_CODE_LENGTH);
}

/** `ABCD-EFGH-JKMN`, as far as the code goes. */
export function formatLoginCode(raw: string): string {
  const code = normalizeLoginCodeInput(raw);
  return [code.slice(0, 4), code.slice(4, 8), code.slice(8, 12)].filter(Boolean).join('-');
}

/** Whether the server could accept this — so Sign in is offered only for something it won't refuse on sight. */
export function isCompleteLoginCode(raw: string): boolean {
  const code = normalizeLoginCodeInput(raw);
  return code.length === LOGIN_CODE_LENGTH && [...code].every(c => ALPHABET.includes(c));
}
