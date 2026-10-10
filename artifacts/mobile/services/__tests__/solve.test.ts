import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { acceptSolveResponse, solveErrorKey } from '../solve.ts';

const response = (over: Record<string, unknown> = {}) => ({
  problem: 'حل المعادلة 2x+5=13',
  steps: ['2x + 5 = 13', '2x = 8', 'x = 4'],
  answer: 'x = 4',
  verification: { verified: true, source: 'sympy', code: 'verified', understoodAs: '2x+5=13' },
  ...over,
});

describe('acceptSolveResponse', () => {
  it('turns a verified response into a verified board solution that says what was checked', () => {
    const s = acceptSolveResponse(response())!;
    assert.equal(s.verified, true);
    assert.equal(s.source, 'sympy');
    assert.equal(s.understoodAs, '2x+5=13');
    assert.deepEqual(s.steps, ['2x + 5 = 13', '2x = 8', 'x = 4']);
  });

  it('an unchecked response stays unchecked', () => {
    const s = acceptSolveResponse(response({ verification: { verified: false, source: 'unchecked', code: 'no_check' } }))!;
    assert.equal(s.verified, false);
    assert.equal(s.source, 'unchecked');
    assert.equal('understoodAs' in s, false);
  });

  it('fails closed: a claim of verified that is not earned is stored unchecked', () => {
    for (const verification of [
      { verified: true, source: 'sympy', code: 'verified' },
      { verified: true, source: 'unchecked', code: 'verified', understoodAs: 'a=b' },
      { verified: 'yes', source: 'sympy', understoodAs: 'a=b' },
      null,
      'verified',
    ]) {
      const s = acceptSolveResponse(response({ verification }))!;
      assert.equal(s.verified, false, JSON.stringify(verification));
      assert.equal(s.source, 'unchecked');
    }
  });

  it('refuses a response that is not a usable solution', () => {
    for (const bad of [null, 'x', [], response({ steps: [] }), response({ answer: '' }), response({ steps: [1, 2] })]) {
      assert.equal(acceptSolveResponse(bad), null);
    }
  });

  it('a missing verification block is unchecked, not verified', () => {
    const { verification: _gone, ...rest } = response();
    const s = acceptSolveResponse(rest)!;
    assert.equal(s.verified, false);
  });
});

describe('solveErrorKey', () => {
  it('maps the server codes to the message a teacher can act on', () => {
    assert.equal(solveErrorKey({ code: 'no_solution' }), 'solveNoSolution');
    assert.equal(solveErrorKey({ code: 'live_mode_off' }), 'solveAiOff');
    assert.equal(solveErrorKey({ code: 'user_quota_exceeded' }), 'aiQuotaSpent');
    assert.equal(solveErrorKey({ code: 'budget_exceeded' }), 'aiQuotaSpent');
  });
  it('anything else is a plain failure to retry', () => {
    for (const e of [{ code: 'generation_in_flight' }, { code: 'bad_problem' }, new Error('boom'), null, undefined, 'x', {}]) {
      assert.equal(solveErrorKey(e), 'solveFailed');
    }
  });
});
