import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBatchStopError, isRetryable, scanErrorKey } from '../scanErrors.ts';

const err = (status: number, code = '') => ({ status, code });

describe('scanErrorKey', () => {
  it('maps every code the scan routes send to a sentence that says what to do', () => {
    assert.equal(scanErrorKey(err(413, 'image_too_large')), 'scanTooLarge');
    assert.equal(scanErrorKey(err(413, 'payload_too_large')), 'scanTooLarge');
    assert.equal(scanErrorKey(err(413)), 'scanTooLarge');
    assert.equal(scanErrorKey(err(503, 'live_mode_off')), 'scanUnavailable');
    assert.equal(scanErrorKey(err(409, 'not_published')), 'scanNotPublished');
    assert.equal(scanErrorKey(err(409, 'no_class')), 'scanNoClass');
    assert.equal(scanErrorKey(err(409, 'not_paper_exam')), 'scanNotPaper');
    assert.equal(scanErrorKey(err(502, 'scan_unavailable')), 'scanFailed');
  });

  it('tells a spent allowance apart from a busy minute — both are 429', () => {
    assert.equal(scanErrorKey(err(429, 'user_quota_exceeded')), 'scanBudgetSpent');
    assert.equal(scanErrorKey(err(429, 'budget_exceeded')), 'scanBudgetSpent');
    assert.equal(scanErrorKey(err(429, 'rate_limited')), 'scanRateLimited');
    assert.equal(scanErrorKey(err(429)), 'scanRateLimited');
  });

  it('falls back to the hand-entry sentence for anything else', () => {
    for (const e of [new Error('boom'), null, undefined, 'text', err(500), {}]) {
      assert.equal(scanErrorKey(e), 'scanFailed');
    }
  });
});

describe('isBatchStopError', () => {
  it('stops on the failures every remaining photo would repeat', () => {
    for (const code of ['live_mode_off', 'budget_exceeded', 'user_quota_exceeded']) {
      assert.equal(isBatchStopError(err(429, code)), true, code);
    }
  });

  it('does not stop on a bad photo, a busy minute, or a server hiccup', () => {
    for (const e of [err(400, 'bad_image'), err(413, 'image_too_large'), err(429, 'rate_limited'), err(502, 'scan_unavailable'), null]) {
      assert.equal(isBatchStopError(e), false);
    }
  });
});

describe('isRetryable', () => {
  it('retries only a rate limit, never a spent allowance', () => {
    assert.equal(isRetryable(err(429, 'rate_limited')), true);
    assert.equal(isRetryable(err(429)), true);
    assert.equal(isRetryable(err(429, 'user_quota_exceeded')), false);
    assert.equal(isRetryable(err(502, 'scan_unavailable')), false);
  });
});
