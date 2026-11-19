/**
 * The pure half of the admin insights screens (services/adminInsights.ts): how minutes, shares,
 * cohort cells and hidden (fewer than three) groups are written, and that every usage area has a
 * readable name in both languages.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { USAGE_AREAS } from '../usageAreas.ts';
import { areaLabel, breakdownCell, cohortCell, formatMinutes, share } from '../adminInsights.ts';

describe('admin insights formatting', () => {
  it('writes minutes as hours and minutes', () => {
    assert.equal(formatMinutes(0, false), '0m');
    assert.equal(formatMinutes(45, false), '45m');
    assert.equal(formatMinutes(60, false), '1h');
    assert.equal(formatMinutes(135, false), '2h 15m');
    assert.equal(formatMinutes(135, true), '2 س 15 د');
  });

  it('gives a share as a whole percent, and nothing of nothing', () => {
    assert.equal(share(1, 3), '33%');
    assert.equal(share(0, 0), '—');
  });

  it('shows a hidden group as <3', () => {
    assert.equal(breakdownCell(null), '<3');
    assert.equal(breakdownCell(7), '7');
  });

  it('writes a cohort cell as a percent of its size, blank for an empty cohort', () => {
    assert.equal(cohortCell(1, 4), '25%');
    assert.equal(cohortCell(0, 0), '');
  });

  it('names every area in Arabic and English', () => {
    for (const a of USAGE_AREAS) {
      assert.notEqual(areaLabel(a, true), a, `${a} has no Arabic name`);
      assert.match(areaLabel(a, true), /[؀-ۿ]/, a);
      assert.notEqual(areaLabel(a, false), a, `${a} has no English name`);
    }
    assert.equal(areaLabel('something-new', false), 'something-new');
  });
});
