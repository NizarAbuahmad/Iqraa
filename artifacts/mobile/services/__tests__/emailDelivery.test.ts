/**
 * What this guards: the verify screen warns "the code was not sent" only when
 * the server says so. An older server that does not send `emailSent` at all
 * must read as "sent" — otherwise every signup against it would open with a
 * false alarm — so the check is `=== false`, never "falsy".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { emailNotSent } from '../emailDelivery.ts';

describe('emailNotSent', () => {
  it('is true only when the server said the email was not sent', () => {
    assert.equal(emailNotSent({ emailSent: false }), true);
  });

  it('is false when it was sent', () => {
    assert.equal(emailNotSent({ emailSent: true }), false);
  });

  it('is false when the server did not say, so an older API does not raise a false alarm', () => {
    assert.equal(emailNotSent({}), false);
    assert.equal(emailNotSent({ emailSent: undefined }), false);
  });
});
