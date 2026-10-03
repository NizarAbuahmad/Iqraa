/**
 * Which translation a user sees for an error the API answered.
 *
 * The server's `error` strings are English, and this app is Arabic-first.
 * Screens used to print `e.message` as it came — «Invalid email or password»
 * on the Arabic sign-in page, «You are not connected to this person» in the
 * Arabic inbox. Branch on `code` (and on a 429, or a request that never
 * reached the server), fall back to the screen's own key, and never show the
 * body. `takeErrorKey` and `claimErrorKey` do the same for their own screens.
 *
 * Imports nothing, so it runs under the bare `node --test` runner. Keys are
 * plain strings here; the call sites pass them to `t()`, whose type checks
 * that each one exists in both languages.
 */
const BY_CODE = {
  // Sign-in and sign-up.
  missing_fields: 'errMissingFields',
  invalid_email: 'errInvalidEmail',
  invalid_credentials: 'errInvalidCredentials',
  email_taken: 'errEmailTaken',
  password_policy: 'errPasswordPolicy',
  passwords_mismatch: 'passwordsDoNotMatch',
  invalid_code: 'invalidVerificationCode',
  already_verified: 'errAlreadyVerified',
  same_email: 'errSameEmail',
  invalid_google_credential: 'errGoogleFailed',
  student_accounts_disabled: 'errStudentAccountsDisabled',
  terms_required: 'errTermsRequired',
  role_locked_teaching: 'accountTypeLockedTeaching',
  role_locked_linked: 'accountTypeLockedLinked',
  password_incorrect: 'errPasswordIncorrect',
  email_mismatch: 'errEmailMismatch',
  account_suspended: 'errAccountSuspended',
  // Messaging.
  not_connected: 'errNotConnected',
  blocked: 'errBlocked',
  same_side: 'errSameSide',
  group_read_only: 'messagingReadOnlyGroup',
  cannot_block_teacher: 'errCannotBlockTeacher',
  teacher_only: 'errTeacherOnly',
  owner_only: 'errGroupOwnerOnly',
  cannot_remove_owner: 'errCannotRemoveOwner',
  group_too_large: 'errGroupTooLarge',
  too_long: 'errTooLong',
  file_too_large: 'errFileTooLarge',
  unsupported_type: 'errUnsupportedType',
  messaging_storage_unavailable: 'errMessagingUnavailable',
  not_found: 'errNotFound',
  // Anywhere.
  rate_limited: 'errTooManyRequests',
} as const;

export type ApiErrorKey = (typeof BY_CODE)[keyof typeof BY_CODE] | 'errOffline';

/** The request never got an answer: offline, DNS, or a client-side timeout. */
function neverReachedServer(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  return err instanceof TypeError && typeof (err as { status?: unknown }).status !== 'number';
}

export function apiErrorKey<K extends string>(err: unknown, fallback: K): ApiErrorKey | K {
  if (!err || typeof err !== 'object') return fallback;
  const { code, status } = err as { code?: unknown; status?: unknown };
  if (typeof code === 'string' && code in BY_CODE) return BY_CODE[code as keyof typeof BY_CODE];
  if (status === 429) return 'errTooManyRequests';
  if (neverReachedServer(err)) return 'errOffline';
  return fallback;
}

/** The server's default when an administrator wrote no reason. */
const DEFAULT_SUSPENSION = 'This account has been suspended.';

/**
 * The sentence to show. One exception to "never the body": a suspension
 * carries the reason an administrator typed for this user, which is the most
 * useful thing on the screen — unless it is the server's English default.
 */
export function apiErrorMessage<K extends string>(
  err: unknown,
  fallback: K,
  // `NoInfer`: K comes from the fallback alone. Inferred from `t` as well,
  // TypeScript widened it to the whole key union and then rejected the
  // fallback. With it, passing the app's `t` checks that every key this
  // module can return exists in the translations.
  t: (key: ApiErrorKey | NoInfer<K>) => string,
): string {
  if (err && typeof err === 'object' && (err as { code?: unknown }).code === 'account_suspended') {
    const reason = (err as { message?: unknown }).message;
    if (typeof reason === 'string' && reason.trim() && reason !== DEFAULT_SUSPENSION) return reason;
  }
  return t(apiErrorKey(err, fallback));
}
