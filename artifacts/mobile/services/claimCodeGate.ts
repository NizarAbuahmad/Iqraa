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

/**
 * A class code is shared with the whole class, so a wrong tap (or a classmate's
 * name) links the account to the wrong child. Before sending, the joiner is
 * asked once to confirm the name they picked. A per-student code names its own
 * student, so there is nothing to confirm.
 */
export function needsNameConfirm(state: JoinCodeState, studentId: string, confirmed: boolean): boolean {
  return state === 'class' && studentId !== '' && !confirmed;
}

/** Every rejection `decideClaim` can return, keyed by the server's `code`. */
const CLAIM_ERROR_KEYS: Record<string, TranslationKey> = {
  claim_code_invalid: 'claimCodeInvalid',
  claim_needs_name: 'claimNeedsName',
  claim_name_not_in_class: 'claimNameNotInClass',
  claim_already_linked: 'claimAlreadyLinked',
  claim_guardian_taken: 'claimGuardianTaken',
  // Code-only signup (POST /auth/redeem): a parent may not create an account from a class code.
  claim_parent_needs_student_code: 'claimParentNeedsOwnCode',
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

/**
 * Code-only signup (`POST /auth/redeem`) makes an account with no email behind
 * it, so the code is the only proof of who is asking. That rules a class code
 * out for a parent: it is one string for a whole room, its picker lists every
 * child, and anyone holding it could become "the parent" of any child still
 * unclaimed. A parent needs the code written for their child. A student is fine
 * either way — picking your own name off the list is how a student has always
 * joined. The server enforces the same rule (api-server/src/lib/redeemPolicy.ts);
 * this is so the button is not offered for something it will refuse.
 */
export function canSubmitSignup(role: 'parent' | 'student', state: JoinCodeState, studentId: string): boolean {
  if (role === 'parent') return state === 'student-code';
  return canSubmitClaim(state, studentId);
}

/** A parent who typed a class code: the screen explains instead of leaving Continue dead. */
export function parentNeedsOwnCode(role: string | null | undefined, state: JoinCodeState): boolean {
  return role === 'parent' && state === 'class';
}

/**
 * What the server's `normalizeShareCode` does, done before the screen counts
 * characters: uppercase, and drop anything that is not a letter or digit.
 *
 * The lookup fires at six characters. A code read off a whiteboard arrives as
 * `YHFM-8Y`, so at `YHFM-8` the screen had six characters and five of code:
 * the server normalised it, found nothing, and the 404 was taken for a
 * per-student code — Continue appeared on a code that was not finished.
 * Counting what the server will actually see closes that.
 */
export function normalizeClaimCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
