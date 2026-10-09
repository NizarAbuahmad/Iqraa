import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LEGAL_LAST_UPDATED, LEGAL_VERSION } from '../../constants/legal.ts';

describe('LEGAL_VERSION', () => {
  it('is the date the documents say they were last updated', () => {
    const shown = new Date(`${LEGAL_LAST_UPDATED.en} 12:00 UTC`);
    assert.ok(!Number.isNaN(shown.getTime()), 'LEGAL_LAST_UPDATED.en must stay a parseable date');
    assert.equal(LEGAL_VERSION.slice(0, 10), shown.toISOString().slice(0, 10));
  });

  it('has the shape the server accepts', () => {
    assert.match(LEGAL_VERSION, /^\d{4}-\d{2}-\d{2}(\.[a-z0-9]{1,8})?$/);
  });
});
