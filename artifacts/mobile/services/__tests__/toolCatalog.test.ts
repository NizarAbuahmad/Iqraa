/**
 * What this guards: which tools a teacher is actually offered.
 *
 * The pilot deliberately narrowed both menus to the five tools that carry
 * the product. Parked tools stay in the catalog (their routes still resolve
 * for saved materials and deep links) but must not reappear on a menu —
 * which is easy to undo by accident, since adding a tool to the arrays is
 * how you add one at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AFTER_CLASS, ALL_TOOLS, BEFORE_CLASS, DURING_CLASS, WORKFLOW } from '../toolCatalog.ts';

const PILOT_TOOLS = ['slides', 'lesson-plan', 'worksheet', 'quiz', 'evaluations'];

describe('toolCatalog — the pilot surface', () => {
  it('offers exactly the five pilot tools, in workflow order', () => {
    assert.deepEqual(ALL_TOOLS.map(t => t.id), PILOT_TOOLS);
  });

  it('never exposes a parked tool on either menu', () => {
    // Both surfaces render these arrays (the tools tab via WORKFLOW, chat by
    // importing them directly), so a `hidden` tool leaking into one leaks
    // into both.
    for (const tool of [...BEFORE_CLASS, ...DURING_CLASS, ...AFTER_CLASS]) {
      assert.equal(tool.hidden, undefined, `${tool.id} is parked but still on a menu`);
    }
    for (const section of WORKFLOW) {
      for (const tool of section.tools) {
        assert.equal(tool.hidden, undefined, `${tool.id} is parked but in WORKFLOW`);
      }
    }
  });

  it('keeps every offered tool reachable', () => {
    for (const tool of ALL_TOOLS) {
      assert.ok(tool.route || tool.externalAction, `${tool.id} has no way to open it`);
    }
  });
});
