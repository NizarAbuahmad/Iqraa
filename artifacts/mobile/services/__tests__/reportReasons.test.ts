import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { REPORT_REASON_KEYS, reportReasonLabel } from '../reportReasons.ts';

const t = (key: string) => `«${key}»`;

describe('reportReasonLabel', () => {
  it('translates every reason the picker can send', () => {
    for (const key of REPORT_REASON_KEYS) assert.equal(reportReasonLabel(key, t), `«${key}»`);
  });

  it('shows anything else as it was written, never as a lookup', () => {
    assert.equal(reportReasonLabel('  he keeps messaging me ', t), 'he keeps messaging me');
    assert.equal(reportReasonLabel('reportReasonUnknown', t), 'reportReasonUnknown');
  });
});
