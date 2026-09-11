/**
 * The two rules the roster-claim screens share: when Continue may be offered,
 * and how a server rejection becomes Arabic.
 *
 * Split out of `hooks/useJoinCodeLookup.ts` for the usual reason in this repo
 * (see `routeGating.ts`): the hook reaches `services/roster.ts` → `apiClient`
 * → `expo-secure-store`, none of which bare `node --test` can load. These two
 * rules have no imports at all, so they can be tested — and the submit rule
 * had already shipped wrong once.
 *
 * `import type` is erased before Node sees the file, so naming TranslationKey
 * here does not drag i18n.ts into the test process.
 */
import type { TranslationKey } from './i18n.ts';

/**
 * What the six-character code turned out to be, once the public lookup
 * (`GET /auth/join/:code`) has answered.
 *
 * `student-code` is a 404 — the ordinary, expected answer for a per-student
 * claim code, which names its own student and needs no picker. Every other
 * failure is `error`: "we do not know what this code is" must never be
 * mistaken for "per-student code", because that is what let a crashed lookup
 * send a nameless claim and come back demanding a name.
 */
export type JoinCodeState =
  | 'short'
  | 'checking'
  | 'student-code'
  | 'class'
  | 'empty-class'
  | 'error';

/**
 * Continue is offered only when the screen knows what it would send: a
 * per-student code (which carries its own student), or a class code with a
 * name picked off the list. Anything else — still typing, still looking up,
 * a class with no names yet, a lookup that failed — would submit a claim the
 * server can only refuse.
 */
export function canSubmitClaim(state: JoinCodeState, studentId: string): boolean {
  if (state === 'student-code') return true;
  if (state === 'class') return studentId !== '';
  return false;
}

/** Every rejection `decideClaim` can return, keyed by the server's `code`. */
const CLAIM_ERROR_KEYS: Record<string, TranslationKey> = {
  claim_code_invalid: 'claimCodeInvalid',
  claim_needs_name: 'claimNeedsName',
  claim_name_not_in_class: 'claimNameNotInClass',
  claim_already_linked: 'claimAlreadyLinked',
};

/**
 * The server answers in English; this app is Arabic-first, which is why
 * `RosterError` carries the machine-readable `code` at all (see its comment in
 * services/roster.ts). An unrecognised or absent code falls back to the
 * generic failure rather than echoing the server's sentence into the UI.
 */
export function claimErrorKey(code: string | undefined): TranslationKey {
  return (code && CLAIM_ERROR_KEYS[code]) || 'joinAnotherClassFailed';
}
