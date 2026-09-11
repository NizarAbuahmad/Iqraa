/**
 * What this guards: a parent being told to "choose your name from the class
 * list" when no list was ever shown.
 *
 * That shipped. `GET /auth/join/:code` 500s on a class whose roster is still
 * empty, the screen swallowed the failure as "must be a per-student code",
 * left the picker hidden, and still let the parent press Continue — so the
 * server refused with an instruction the screen made impossible to follow.
 * The rule is therefore: only offer Continue when we actually know what to
 * send. Everything that is not a resolved lookup blocks it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { canSubmitClaim, claimErrorKey } from '../claimCodeGate.ts';

describe('canSubmitClaim', () => {
  it('blocks a code too short to have been looked up', () => {
    assert.equal(canSubmitClaim('short', ''), false);
  });

  it('blocks while the lookup is still in flight', () => {
    // The race that produced the same dead end without any server fault:
    // type six characters, press Continue before the answer lands, and the
    // claim goes out with no name attached.
    assert.equal(canSubmitClaim('checking', ''), false);
  });

  it('allows a per-student code with no name picked — it names its own student', () => {
    // The case that must keep working: a 404 from the lookup is the ordinary
    // answer for a per-student claim code, not a failure.
    assert.equal(canSubmitClaim('student-code', ''), true);
  });

  it('blocks a class code until a name is picked', () => {
    assert.equal(canSubmitClaim('class', ''), false);
  });

  it('allows a class code once a name is picked', () => {
    assert.equal(canSubmitClaim('class', 'stu-1'), true);
  });

  it('blocks a class whose roster has no names on it yet', () => {
    // Nothing the joiner can do here — only the teacher can add names — so
    // the screen has to say that instead of offering a button that 400s.
    assert.equal(canSubmitClaim('empty-class', ''), false);
  });

  it('blocks an empty class even if a name is somehow still selected', () => {
    // Stale selection from a previously-typed code must not resurrect submit.
    assert.equal(canSubmitClaim('empty-class', 'stu-1'), false);
  });

  it('blocks when the lookup failed for a reason other than 404', () => {
    // "We do not know what this code is" must never be read as "per-student
    // code" — that is exactly what turned a 500 into an impossible error.
    assert.equal(canSubmitClaim('error', ''), false);
  });
});

describe('claimErrorKey', () => {
  it('maps every rejection the claim endpoint can return', () => {
    assert.equal(claimErrorKey('claim_code_invalid'), 'claimCodeInvalid');
    assert.equal(claimErrorKey('claim_needs_name'), 'claimNeedsName');
    assert.equal(claimErrorKey('claim_name_not_in_class'), 'claimNameNotInClass');
    assert.equal(claimErrorKey('claim_already_linked'), 'claimAlreadyLinked');
  });

  it('falls back to a generic message for an unknown code', () => {
    // An older server, or a rejection added later — the screen still has to
    // say something in Arabic rather than echo the server's English.
    assert.equal(claimErrorKey('something_new'), 'joinAnotherClassFailed');
  });

  it('falls back when the server sent no code at all', () => {
    assert.equal(claimErrorKey(undefined), 'joinAnotherClassFailed');
  });
});
