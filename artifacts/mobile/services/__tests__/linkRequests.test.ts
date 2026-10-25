/** Competing join requests: two or more accounts asking for the same roster name. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { competingCount, competingWarning } from '../linkRequests.ts';

const reqs = [{ studentId: 'a' }, { studentId: 'b' }, { studentId: 'a' }, { studentId: 'a' }];

describe('competingCount', () => {
  it('counts the requests that ask for the same name', () => {
    assert.equal(competingCount(reqs, 'a'), 3);
    assert.equal(competingCount(reqs, 'b'), 1);
  });
  it('is 0 for a name nobody asked for and for an empty list', () => {
    assert.equal(competingCount(reqs, 'z'), 0);
    assert.equal(competingCount([], 'a'), 0);
  });
});

describe('competingWarning', () => {
  it('warns only when two or more requests compete', () => {
    assert.equal(competingWarning(reqs, 'a'), 3);
    assert.equal(competingWarning(reqs, 'b'), 0);
    assert.equal(competingWarning([{ studentId: 'a' }, { studentId: 'a' }], 'a'), 2);
  });
});
