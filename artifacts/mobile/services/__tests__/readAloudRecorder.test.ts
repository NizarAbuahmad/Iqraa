/**
 * The read-aloud recorder's pure helpers.
 *
 * Only `formatDuration` is reachable here — `blobToDataUrl` needs FileReader
 * and `isRecordingSupported` needs MediaRecorder, neither of which exists in
 * `node --test`. That is the honest limit of what this file covers: the
 * recording flow itself is browser-only and is not exercised by any test.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_RECORD_MS, formatDuration } from '../readAloudRecorder.ts';

describe('formatDuration', () => {
  it('shows whole seconds, zero-padded', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(5_000), '0:05');
    assert.equal(formatDuration(65_000), '1:05');
    assert.equal(formatDuration(600_000), '10:00');
  });

  it('floors rather than rounds, so the timer never shows time not yet spent', () => {
    assert.equal(formatDuration(1_999), '0:01');
  });

  it('never shows a negative time', () => {
    // Clock skew between the start stamp and a tick can go backwards; "-1:-3"
    // on screen reads as a broken app.
    assert.equal(formatDuration(-5_000), '0:00');
  });

  it('renders the ceiling as a sane value', () => {
    assert.equal(formatDuration(MAX_RECORD_MS), '2:00');
  });
});
