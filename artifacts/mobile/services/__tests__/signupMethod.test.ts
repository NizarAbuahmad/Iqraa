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

import { signupForm, needsAgeConfirmation } from '../signupMethod.ts';

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
