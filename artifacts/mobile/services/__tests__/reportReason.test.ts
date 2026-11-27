/**
 * The optional "what is wrong" text sent with «بلّغ عن مشكلة». The server
 * trims and caps it again (it never trusts the client); this half keeps the
 * input honest and sends nothing at all when the teacher wrote nothing, so a
 * report with no reason is byte-for-byte the request the app always sent.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { REPORT_REASON_MAX, reportRequestBody } from '../reportReason.ts';

describe('reportRequestBody', () => {
  it('sends no body when there is no reason', () => {
    for (const r of [undefined, '', '   \n ']) {
      assert.equal(reportRequestBody(r), undefined, JSON.stringify(r));
    }
  });

  it('sends the trimmed reason as JSON', () => {
    assert.deepEqual(JSON.parse(reportRequestBody('  الشرح ناقص  ')!), { reason: 'الشرح ناقص' });
  });

  it('cuts a long reason to the same cap the server uses', () => {
    const body = JSON.parse(reportRequestBody('ب'.repeat(REPORT_REASON_MAX + 50))!);
    assert.equal(body.reason.length, REPORT_REASON_MAX);
  });

  it('keeps the cap in step with the API', () => {
    assert.equal(REPORT_REASON_MAX, 500);
  });
});
