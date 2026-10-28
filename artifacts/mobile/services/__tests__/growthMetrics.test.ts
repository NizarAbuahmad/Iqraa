/**
 * The cards of «التنزيلات والمتابعون» follow a period chip. The date field next to
 * them only says which day a typed number belongs to, so the period is the only
 * thing that can change what a card shows.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/growthMetrics.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { growthSummary, isolateLtr, sparkPoints, type MetricRow } from '../growthMetrics.ts';

const row = (date: string, value: number): MetricRow => ({ key: 'instagram', value, date });
const TODAY = '2026-10-28';
// oldest first, as the API returns them
const rows = [row('2026-09-20', 100), row('2026-10-10', 130), row('2026-10-22', 150), row('2026-10-28', 170)];

describe('sparkPoints', () => {
  it('draws nothing for fewer than two entries, in every period', () => {
    for (const p of ['last', '7', '30', 'all'] as const) {
      assert.deepEqual(sparkPoints([], p, TODAY), [], p);
      assert.deepEqual(sparkPoints([row('2026-10-28', 5)], p, TODAY), [], p);
    }
  });

  it('spreads entries by their dates, lowest value at 0 and highest at 1', () => {
    const pts = sparkPoints([row('2026-10-01', 10), row('2026-10-03', 20), row('2026-10-11', 30)], 'all', TODAY);
    assert.deepEqual(pts.map(p => p.y), [0, 0.5, 1]);
    assert.deepEqual(pts.map(p => p.x), [0, 0.2, 1]);
  });

  it('a flat series is a line across the middle, not a divide by zero', () => {
    const pts = sparkPoints([row('2026-10-01', 7), row('2026-10-05', 7)], 'all', TODAY);
    assert.deepEqual(pts.map(p => p.y), [0.5, 0.5]);
  });

  it('entries all on one day are spaced evenly', () => {
    const pts = sparkPoints([row('2026-10-01', 1), row('2026-10-01', 2), row('2026-10-01', 3)], 'all', TODAY);
    assert.deepEqual(pts.map(p => p.x), [0, 0.5, 1]);
  });

  it('«last» shows at most the eight newest entries', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(`2026-10-${String(i + 1).padStart(2, '0')}`, i));
    const pts = sparkPoints(many, 'last', TODAY);
    assert.equal(pts.length, 8);
    assert.equal(pts[0]!.y, 0);
  });

  it('a day period starts at the entry its change is measured from', () => {
    // 7 days back from 10-28: baseline is the 10-10 entry, so 10-10, 10-22, 10-28.
    assert.equal(sparkPoints(rows, '7', TODAY).length, 3);
    assert.equal(sparkPoints(rows, '30', TODAY).length, 4);
  });

  it('draws nothing for a period nothing was recorded in', () => {
    assert.deepEqual(sparkPoints([row('2026-08-01', 40), row('2026-09-01', 55)], '7', TODAY), []);
  });
});

describe('isolateLtr', () => {
  it('wraps a run in a left-to-right isolate, so a day inside Arabic keeps its order', () => {
    assert.equal(isolateLtr('2026-09-20'), '⁦2026-09-20⁩');
    assert.equal(isolateLtr('+70'), '⁦+70⁩');
  });
});

describe('growthSummary', () => {
  it('has nothing to show for a metric nobody has recorded', () => {
    assert.deepEqual(growthSummary([], '30', TODAY), { last: null, base: null, change: null, stale: false });
  });

  it('«last» compares the two newest entries, whatever the gap between them', () => {
    const s = growthSummary(rows, 'last', TODAY);
    assert.equal(s.last?.value, 170);
    assert.equal(s.base?.date, '2026-10-22');
    assert.equal(s.change, 20);
  });

  it('a day period measures from the last entry on or before its first day', () => {
    // 7 days back from 10-28 is 10-21; the last entry on or before it is 10-10.
    const s = growthSummary(rows, '7', TODAY);
    assert.equal(s.base?.date, '2026-10-10');
    assert.equal(s.change, 40);
    // 30 days back is 09-28; the last entry on or before it is 09-20.
    assert.equal(growthSummary(rows, '30', TODAY).base?.date, '2026-09-20');
    assert.equal(growthSummary(rows, '30', TODAY).change, 70);
  });

  it('an entry exactly on the period start is the baseline', () => {
    const s = growthSummary([row('2026-10-21', 90), row('2026-10-28', 100)], '7', TODAY);
    assert.equal(s.base?.date, '2026-10-21');
    assert.equal(s.change, 10);
  });

  it('a metric younger than the period measures from its first entry', () => {
    const s = growthSummary([row('2026-10-25', 10), row('2026-10-28', 16)], '30', TODAY);
    assert.equal(s.base?.date, '2026-10-25');
    assert.equal(s.change, 6);
  });

  it('«all» measures from the first entry ever', () => {
    const s = growthSummary(rows, 'all', TODAY);
    assert.equal(s.base?.date, '2026-09-20');
    assert.equal(s.change, 70);
  });

  it('one entry has no change, in every period', () => {
    for (const p of ['last', '7', '30', 'all'] as const) {
      const s = growthSummary([row('2026-10-28', 5)], p, TODAY);
      assert.equal(s.change, null, p);
      assert.equal(s.last?.value, 5, p);
    }
  });

  it('says when nothing was recorded inside the period instead of reporting a zero', () => {
    const s = growthSummary([row('2026-08-01', 40), row('2026-09-01', 55)], '7', TODAY);
    assert.equal(s.stale, true);
    assert.equal(s.change, null);
    assert.equal(s.last?.value, 55);
  });

  it('is not stale when the newest entry is inside the period', () => {
    assert.equal(growthSummary(rows, '7', TODAY).stale, false);
  });
});
