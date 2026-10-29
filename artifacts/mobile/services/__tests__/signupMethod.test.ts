/**
 * What this guards: which sign-up form the register screen shows.
 *
 * A student chooses between their teacher's code and an email (since
 * 2026-10-23), and so does a parent (since 2026-10-25: code-only left a parent
 * with no email and no password, and no way to sign up without a code in hand);
 * a teacher keeps the email form. Until a student or parent has chosen, neither
 * form shows: either answer is harmless, but picking one for them is how "no
 * email needed" once hid the email option entirely. A student on the email form
 * must also confirm their age, because no teacher's code vouches for them; a
 * parent is an adult and is asked nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { signupForm, needsAgeConfirmation, switchNeedsAgeConfirmation, signupPlan, guardianConfigStale } from '../signupMethod.ts';
import * as signupMethod from '../signupMethod.ts';

describe('signupForm', () => {
  it('gives a teacher the email form, whatever method was tapped', () => {
    assert.equal(signupForm('teacher', null), 'email');
    assert.equal(signupForm('teacher', 'code'), 'email');
  });

  it('makes a student or a parent choose before showing anything', () => {
    assert.equal(signupForm('student', null), 'choose');
    assert.equal(signupForm('parent', null), 'choose');
  });

  it('shows the form a student or a parent chose', () => {
    for (const role of ['student', 'parent'] as const) {
      assert.equal(signupForm(role, 'code'), 'code', role);
      assert.equal(signupForm(role, 'email'), 'email', role);
    }
  });

  it('keeps the email form up before any role is picked, as the screen always did', () => {
    assert.equal(signupForm(null, null), 'email');
  });
});

describe('needsAgeConfirmation', () => {
  it('asks only a student who signs up with an email', () => {
    assert.equal(needsAgeConfirmation('student', 'email'), true);
    assert.equal(needsAgeConfirmation('student', 'code'), false);
    assert.equal(needsAgeConfirmation('student', null), false);
    assert.equal(needsAgeConfirmation('teacher', 'email'), false);
    assert.equal(needsAgeConfirmation('parent', 'email'), false);
    assert.equal(needsAgeConfirmation(null, null), false);
  });
});

describe('switchNeedsAgeConfirmation', () => {
  // The server asks for the same tick when an existing account becomes a
  // student (api-server lib/roleSwitch.ts); a screen that did not would get a
  // 400 it cannot explain.
  it('asks for a change into student, from teacher or parent', () => {
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student'), true);
    assert.equal(switchNeedsAgeConfirmation('parent', 'student'), true);
  });

  it('does not ask a student who stays a student', () => {
    assert.equal(switchNeedsAgeConfirmation('student', 'student'), false);
  });

  it('does not ask for a change into teacher or parent', () => {
    assert.equal(switchNeedsAgeConfirmation('student', 'teacher'), false);
    assert.equal(switchNeedsAgeConfirmation('student', 'parent'), false);
    assert.equal(switchNeedsAgeConfirmation('teacher', 'parent'), false);
    assert.equal(switchNeedsAgeConfirmation('parent', 'teacher'), false);
  });

  it('treats an unknown current role as not yet a student', () => {
    assert.equal(switchNeedsAgeConfirmation(null, 'student'), true);
    assert.equal(switchNeedsAgeConfirmation(undefined, 'student'), true);
  });
});

describe('switchNeedsAgeConfirmation with the parent-approval switch', () => {
  it('asks for the tick as before when the switch is off or unspecified', () => {
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student'), true);
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student', false), true);
  });
  it('asks for nothing when a parent approves instead', () => {
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student', true), false);
    assert.equal(switchNeedsAgeConfirmation('parent', 'student', true), false);
  });
  it('still never asks for a change that is not into student', () => {
    assert.equal(switchNeedsAgeConfirmation('student', 'parent', false), false);
    assert.equal(switchNeedsAgeConfirmation('student', 'student', false), false);
  });
});

describe('signupPlan', () => {
  const roles = ['teacher', 'parent', 'student', null] as const;
  const methods = ['code', 'email', null] as const;

  it('asks only a student with an email, and exactly one thing: the tick when parent approval is off', () => {
    assert.deepEqual(signupPlan('student', 'email', false), { askAge: true, askParent: false, waitingForConfig: false });
  });

  it('asks a student with an email for a parent when approval is on, and not the tick', () => {
    assert.deepEqual(signupPlan('student', 'email', true), { askAge: false, askParent: true, waitingForConfig: false });
  });

  it('asks neither while the switch is still being read, and says it is waiting', () => {
    assert.deepEqual(signupPlan('student', 'email', false, true), { askAge: false, askParent: false, waitingForConfig: true });
  });

  it('never asks a student with a teacher code, or one who has not chosen', () => {
    for (const enabled of [false, true]) {
      for (const loading of [false, true]) {
        assert.deepEqual(signupPlan('student', 'code', enabled, loading), { askAge: false, askParent: false, waitingForConfig: false });
        assert.deepEqual(signupPlan('student', null, enabled, loading), { askAge: false, askParent: false, waitingForConfig: false });
      }
    }
  });

  it('never asks a teacher, a parent or nobody yet, whatever the method and the switch', () => {
    for (const role of ['teacher', 'parent', null] as const) {
      for (const method of methods) {
        for (const enabled of [false, true]) {
          for (const loading of [false, true]) {
            assert.deepEqual(signupPlan(role, method, enabled, loading), { askAge: false, askParent: false, waitingForConfig: false }, `${role}/${method}/${enabled}/${loading}`);
          }
        }
      }
    }
  });

  it('agrees with needsAgeConfirmation when the switch is off (today\'s behaviour is unchanged)', () => {
    for (const role of roles) {
      for (const method of methods) {
        assert.equal(signupPlan(role, method, false).askAge, needsAgeConfirmation(role, method));
        assert.equal(signupPlan(role, method, false).askParent, false);
      }
    }
  });

  it('never asks both at once', () => {
    for (const role of roles) for (const method of methods) for (const enabled of [false, true]) for (const loading of [false, true]) {
      const p = signupPlan(role, method, enabled, loading);
      assert.equal(p.askAge && p.askParent, false);
    }
  });
});

describe('guardianConfigStale', () => {
  it('flags the two refusals that mean the cached switch is wrong', () => {
    assert.equal(guardianConfigStale('parent_email_required'), true);
    assert.equal(guardianConfigStale('age_confirmation_required'), true);
  });
  it('leaves every other refusal alone', () => {
    assert.equal(guardianConfigStale('parent_email_invalid'), false);
    assert.equal(guardianConfigStale('terms_required'), false);
    assert.equal(guardianConfigStale(undefined), false);
  });
});

/**
 * Who may tap what while the screen is still reading the server's parent-approval switch. Google does not wait for
 * it: a student with an email who taps Google before the answer arrives is refused by the server with the code
 * `guardianConfigStale` knows, and the screen re-reads the switch. The password form does wait, and says why.
 */
describe('signupReadiness', () => {
  const ready = (over: Partial<Parameters<typeof signupMethod.signupReadiness>[0]> = {}) =>
    signupMethod.signupReadiness({
      termsAccepted: true,
      ageConfirmed: false,
      parentOk: true,
      plan: signupPlan('teacher', null, false),
      optionsLoading: false,
      ...over,
    });

  it('lets a teacher with the terms ticked use either way, with nothing missing', () => {
    assert.deepEqual(ready(), { google: true, submit: true, googleMissing: null, submitMissing: null });
  });

  it('holds both ways for the terms, and says so first', () => {
    assert.deepEqual(ready({ termsAccepted: false }), { google: false, submit: false, googleMissing: 'terms', submitMissing: 'terms' });
  });

  it('does not make Google wait for the switch: a student with an email, terms ticked, switch still loading', () => {
    const plan = signupPlan('student', 'email', false, true);
    assert.deepEqual(ready({ plan }), { google: true, submit: false, googleMissing: null, submitMissing: 'config' });
  });

  it('names the terms before the switch while both are outstanding, because only one of them is the person\'s to do', () => {
    const plan = signupPlan('student', 'email', false, true);
    assert.deepEqual(ready({ plan, termsAccepted: false }), { google: false, submit: false, googleMissing: 'terms', submitMissing: 'terms' });
  });

  it('holds a student with an email for the age tick while the switch is off, on both ways', () => {
    const plan = signupPlan('student', 'email', false);
    assert.deepEqual(ready({ plan }), { google: false, submit: false, googleMissing: 'age', submitMissing: 'age' });
    assert.deepEqual(ready({ plan, ageConfirmed: true }), { google: true, submit: true, googleMissing: null, submitMissing: null });
  });

  it('holds a student with an email for a parent address while the switch is on, and asks for no tick', () => {
    const plan = signupPlan('student', 'email', true);
    assert.deepEqual(ready({ plan, parentOk: false }), { google: false, submit: false, googleMissing: 'parent', submitMissing: 'parent' });
    assert.deepEqual(ready({ plan, parentOk: true }), { google: true, submit: true, googleMissing: null, submitMissing: null });
  });

  it('asks for the terms, then the parent, then the tick', () => {
    const plan = { askAge: true, askParent: true, waitingForConfig: false };
    assert.equal(ready({ plan, termsAccepted: false, parentOk: false }).googleMissing, 'terms');
    assert.equal(ready({ plan, parentOk: false }).googleMissing, 'parent');
    assert.equal(ready({ plan }).googleMissing, 'age');
  });

  it('holds only the password form while the roles are still being read', () => {
    assert.deepEqual(ready({ optionsLoading: true }), { google: true, submit: false, googleMissing: null, submitMissing: 'config' });
  });

  it('never holds a parent for the switch: a parent is asked nothing', () => {
    const plan = signupPlan('parent', 'email', false, true);
    assert.deepEqual(ready({ plan }), { google: true, submit: true, googleMissing: null, submitMissing: null });
  });
});
