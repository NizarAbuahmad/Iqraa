/**
 * The rules that decide what a teacher is told about answer-key checking.
 *
 * The interesting cases are the ones that must NOT collapse into each other:
 * "the checker was down" is an outage to retry, "nothing here is checkable" is
 * simply what a bearings paper looks like, and telling a teacher the second
 * when the first is true would send them rewriting good questions.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { summariseKeyChecks } from '../keyCheckSummary.ts';
import type { EvaluationQuestion } from '../evaluations.ts';

type Verification = EvaluationQuestion['verification'];

function question(verification: Verification): EvaluationQuestion {
  return { id: Math.random().toString(36), verification } as unknown as EvaluationQuestion;
}

const verified = () => question({ verified: true, source: 'sympy', code: 'verified' });
const noKey = () => question({ verified: false, source: 'unchecked', code: 'no_key' });
const down = () => question({ verified: false, source: 'unchecked', code: 'verifier_unreachable' });
const undecided = () => question({ verified: false, source: 'unchecked', code: 'undecided' });

const MATHS = 'mathematics';
const CHEM = 'chemistry';

describe('summariseKeyChecks', () => {
  it('reports how many the verifier actually confirmed', () => {
    const out = summariseKeyChecks([verified(), verified(), noKey()], MATHS);
    assert.deepEqual(out, { kind: 'verified', verified: 2, total: 3 });
  });

  it('counts only real confirmations, never a question that merely looks fine', () => {
    const out = summariseKeyChecks([noKey(), undecided()], MATHS);
    assert.notEqual(out.kind, 'verified');
  });

  it('says the checker was down rather than blaming the questions', () => {
    // The distinction that matters most: keys existed, the verifier failed.
    assert.deepEqual(summariseKeyChecks([down(), down()], MATHS), { kind: 'verifier-down' });
  });

  it('never reports an outage as "nothing checkable"', () => {
    const out = summariseKeyChecks([down(), noKey()], MATHS);
    assert.equal(out.kind, 'verifier-down', 'an outage must win over a content explanation');
  });

  it('explains a maths paper where nothing was checkable', () => {
    assert.deepEqual(summariseKeyChecks([noKey(), noKey()], MATHS), { kind: 'none-checkable' });
  });

  it('says nothing about a chemistry paper — it has nothing symbolic by design', () => {
    assert.deepEqual(summariseKeyChecks([noKey(), noKey()], CHEM), { kind: 'silent' });
  });

  it('still reports a verified chemistry key if one somehow exists', () => {
    assert.deepEqual(summariseKeyChecks([verified()], CHEM), {
      kind: 'verified',
      verified: 1,
      total: 1,
    });
  });

  it('stays silent on questions written before key checking existed', () => {
    // Every row already in production carries no `verification` at all. That is
    // not a verdict about them, so it must not read as one.
    // Saying "nothing here was checkable" of these would report a finding from
    // a check that never ran.
    const legacy = [question(undefined), question(undefined)];
    assert.deepEqual(summariseKeyChecks(legacy, MATHS), { kind: 'silent' });
    assert.deepEqual(summariseKeyChecks(legacy, CHEM), { kind: 'silent' });
  });

  it('stays silent on an empty paper', () => {
    assert.deepEqual(summariseKeyChecks([], MATHS), { kind: 'silent' });
  });

  it('tolerates a missing subject', () => {
    assert.deepEqual(summariseKeyChecks([noKey()], null), { kind: 'silent' });
    assert.deepEqual(summariseKeyChecks([noKey()], undefined), { kind: 'silent' });
  });
});
