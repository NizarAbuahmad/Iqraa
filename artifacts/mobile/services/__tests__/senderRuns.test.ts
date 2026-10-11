import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { startsSenderRun } from '../senderRuns.ts';

// Newest first, like the thread's inverted list: sent a, a, b, a.
const newestFirst = [{ senderId: 'a' }, { senderId: 'b' }, { senderId: 'a' }, { senderId: 'a' }];

describe('startsSenderRun', () => {
  it('labels the first message of a run, not the ones that follow it', () => {
    assert.equal(startsSenderRun(newestFirst, 3), true); // oldest overall
    assert.equal(startsSenderRun(newestFirst, 2), false); // a right after a
  });

  it('labels a message whose predecessor was someone else', () => {
    assert.equal(startsSenderRun(newestFirst, 1), true); // b after a
    assert.equal(startsSenderRun(newestFirst, 0), true); // a after b
  });

  it('labels a lone message', () => {
    assert.equal(startsSenderRun([{ senderId: 'a' }], 0), true);
  });
});
