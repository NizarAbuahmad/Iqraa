/**
 * Server errors are English sentences; this app is Arabic-first. Screens used
 * to print `e.message` straight onto an Arabic page. Every assertion below is
 * a code a user can actually trigger, and the last block is the rule that
 * matters most: nothing unknown ever falls through to the English body.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { apiErrorKey, apiErrorMessage } from '../apiErrorKey.ts';

const err = (code?: string, status?: number, message = 'English sentence from the server') =>
  Object.assign(new Error(message), { code, status });

describe('apiErrorKey', () => {
  it('maps the sign-in and sign-up refusals', () => {
    assert.equal(apiErrorKey(err('invalid_credentials', 401), 'fb'), 'errInvalidCredentials');
    assert.equal(apiErrorKey(err('email_taken', 409), 'fb'), 'errEmailTaken');
    assert.equal(apiErrorKey(err('password_policy', 400), 'fb'), 'errPasswordPolicy');
    assert.equal(apiErrorKey(err('passwords_mismatch', 400), 'fb'), 'passwordsDoNotMatch');
    assert.equal(apiErrorKey(err('invalid_code', 400), 'fb'), 'invalidVerificationCode');
    assert.equal(apiErrorKey(err('already_verified', 400), 'fb'), 'errAlreadyVerified');
    assert.equal(apiErrorKey(err('invalid_google_credential', 401), 'fb'), 'errGoogleFailed');
    assert.equal(apiErrorKey(err('role_locked_teaching', 409), 'fb'), 'accountTypeLockedTeaching');
    assert.equal(apiErrorKey(err('role_locked_linked', 409), 'fb'), 'accountTypeLockedLinked');
    assert.equal(apiErrorKey(err('terms_required', 400), 'fb'), 'errTermsRequired');
  });

  it('says the code email could not be sent, rather than the generic resend failure', () => {
    // The server answers 503 email_unavailable when the mail provider refused the send.
    assert.equal(apiErrorKey(err('email_unavailable', 503), 'fb'), 'errEmailNotSent');
  });

  it('maps the messaging refusals', () => {
    assert.equal(apiErrorKey(err('not_connected', 403), 'fb'), 'errNotConnected');
    assert.equal(apiErrorKey(err('group_read_only', 403), 'fb'), 'messagingReadOnlyGroup');
    assert.equal(apiErrorKey(err('cannot_block_teacher', 403), 'fb'), 'errCannotBlockTeacher');
    assert.equal(apiErrorKey(err('file_too_large', 413), 'fb'), 'errFileTooLarge');
    assert.equal(apiErrorKey(err('messaging_storage_unavailable', 503), 'fb'), 'errMessagingUnavailable');
    assert.equal(apiErrorKey(err('not_found', 404), 'fb'), 'errNotFound');
  });

  it('reads a rate limit off the code or the status', () => {
    assert.equal(apiErrorKey(err('rate_limited', 429), 'fb'), 'errTooManyRequests');
    assert.equal(apiErrorKey(err(undefined, 429), 'fb'), 'errTooManyRequests');
  });

  it('says "offline" when the request never reached the server', () => {
    assert.equal(apiErrorKey(new TypeError('Failed to fetch'), 'fb'), 'errOffline');
    assert.equal(apiErrorKey(Object.assign(new Error('aborted'), { name: 'AbortError' }), 'fb'), 'errOffline');
  });

  it('falls back to the screen’s own key for anything else', () => {
    assert.equal(apiErrorKey(err('something_new', 400), 'messagingSendError'), 'messagingSendError');
    assert.equal(apiErrorKey(err(undefined, 500), 'messagingLoadError'), 'messagingLoadError');
    assert.equal(apiErrorKey(new Error('Registration failed'), 'errRegisterFailed'), 'errRegisterFailed');
    assert.equal(apiErrorKey(undefined, 'fb'), 'fb');
  });
});

describe('apiErrorMessage', () => {
  const t = (k: string) => `<${k}>`;

  it('translates, never prints the server body', () => {
    assert.equal(apiErrorMessage(err('email_taken', 409), 'errRegisterFailed', t), '<errEmailTaken>');
    assert.equal(apiErrorMessage(err('weird', 400), 'errRegisterFailed', t), '<errRegisterFailed>');
  });

  it('shows a suspension reason, which an administrator wrote for this user', () => {
    assert.equal(
      apiErrorMessage(err('account_suspended', 403, 'تم إيقاف الحساب بسبب مخالفة'), 'fb', t),
      'تم إيقاف الحساب بسبب مخالفة',
    );
  });

  it('but not the server default when no reason was written', () => {
    assert.equal(
      apiErrorMessage(err('account_suspended', 403, 'This account has been suspended.'), 'fb', t),
      '<errAccountSuspended>',
    );
  });
});
