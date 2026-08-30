import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadFromR2, isR2Configured, uploadToR2 } from '../../scripts/r2.ts';

// Deliberately does not set R2_* env vars — this is the "not configured"
// state every checkout starts in, and the one property that must hold
// regardless of it: nothing here should throw or attempt a network call,
// the same guarantee `extract-text.ts` and `upload-to-r2.ts` depend on to
// behave exactly as they did before R2 support existed.
test('R2 helpers are inert, not broken, when unconfigured', async () => {
  assert.equal(isR2Configured(), false);
  assert.equal(await downloadFromR2('anything.pdf'), null);
  assert.equal(await uploadToR2('anything.pdf', Buffer.from('x')), false);
});
