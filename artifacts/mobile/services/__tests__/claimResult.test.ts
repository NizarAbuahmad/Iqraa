/**
 * POST /auth/claim answers 201 {studentId, relation} when it linked and 202
 * {pending: true, studentId, studentName} when the teacher has to approve. The
 * screens branch on which, so the reading of the body is pinned here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaimResponse } from '../claimResult.ts';

describe('parseClaimResponse', () => {
  it('reads a linked claim', () => {
    assert.deepEqual(parseClaimResponse({ studentId: 's1', relation: 'self' }), { status: 'linked', studentId: 's1', relation: 'self' });
    assert.deepEqual(parseClaimResponse({ studentId: 's1', relation: 'guardian' }), { status: 'linked', studentId: 's1', relation: 'guardian' });
  });

  it('reads a held claim, with the name the student picked', () => {
    assert.deepEqual(
      parseClaimResponse({ pending: true, studentId: 's1', studentName: 'خالد' }),
      { status: 'pending', studentId: 's1', studentName: 'خالد' },
    );
  });

  it('never mistakes a held claim for a linked one, and survives an odd body', () => {
    assert.equal(parseClaimResponse({ pending: true }).status, 'pending');
    assert.deepEqual(parseClaimResponse(null), { status: 'linked', studentId: '', relation: 'self' });
  });
});
