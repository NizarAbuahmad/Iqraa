/**
 * Verification runs after a paper is on screen, against a service that may
 * be slow. A result that lands late must badge the paper it was run for and
 * no other: after a regenerate it would badge the new paper, and after a
 * question delete it would land one position off and mark an unchecked
 * question as proved.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createVerificationTracker } from '../verificationTracker.ts';

describe('createVerificationTracker', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };

  it('accepts a result for the output it was begun for', () => {
    const tracker = createVerificationTracker<{ id: string }>();
    tracker.begin(a);
    assert.equal(tracker.accepts(a), true);
  });

  it('rejects a result for an output that has since been replaced', () => {
    const tracker = createVerificationTracker<{ id: string }>();
    tracker.begin(a);
    tracker.begin(b);
    assert.equal(tracker.accepts(a), false);
    assert.equal(tracker.accepts(b), true);
  });

  it('rejects everything once dropped, until a new run begins', () => {
    const tracker = createVerificationTracker<{ id: string }>();
    tracker.begin(a);
    tracker.drop();
    assert.equal(tracker.accepts(a), false);
    tracker.begin(b);
    assert.equal(tracker.accepts(b), true);
  });

  it('accepts nothing before any run', () => {
    const tracker = createVerificationTracker<{ id: string }>();
    assert.equal(tracker.accepts(a), false);
  });
});
