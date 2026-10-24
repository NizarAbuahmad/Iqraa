/**
 * What this guards: which sign-up form the register screen shows.
 *
 * A student chooses between their teacher's code and an email (since
 * 2026-10-23); a parent keeps the code; a teacher keeps the email form. Until a
 * student has chosen, neither form shows: either answer is harmless, but
 * picking one for them is how "no email needed" once hid the email option
 * entirely. A student on the email form must also confirm their age, because no
 * teacher's code vouches for them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { signupForm, needsAgeConfirmation, switchNeedsAgeConfirmation } from '../signupMethod.ts';

describe('signupForm', () => {
  it('gives a teacher the email form and a parent the code form, whatever method was tapped', () => {
    assert.equal(signupForm('teacher', null), 'email');
    assert.equal(signupForm('teacher', 'code'), 'email');
    assert.equal(signupForm('parent', null), 'code');
    assert.equal(signupForm('parent', 'email'), 'code');
  });

  it('makes a student choose before showing anything', () => {
    assert.equal(signupForm('student', null), 'choose');
  });

  it('shows the form a student chose', () => {
    assert.equal(signupForm('student', 'code'), 'code');
    assert.equal(signupForm('student', 'email'), 'email');
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
