/**
 * Library starters (`resourceTemplates.ts`). A starter is only a route plus the
 * params its tool reads, so what can go wrong is a bad index or a param that
 * silently overrides the teacher's own grade.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RESOURCE_TEMPLATES, TOOL_ROUTE, templateParams } from '../resourceTemplates.ts';

describe('resource templates', () => {
  it('has unique ids and a route for every tool', () => {
    const ids = RESOURCE_TEMPLATES.map(t => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const t of RESOURCE_TEMPLATES) assert.ok(TOOL_ROUTE[t.tool], t.id);
  });

  it('never stores grade or subject — those are added at tap time', () => {
    for (const t of RESOURCE_TEMPLATES) {
      assert.equal(t.params.gradeIdx, undefined, t.id);
      assert.equal(t.params.subjectIdx, undefined, t.id);
    }
  });

  it('keeps every index inside the option list it points into', () => {
    // Worksheet: 6 question counts, 3 difficulties. Activity: 5 types, 4 durations.
    const max: Record<string, number> = { numQIdx: 6, diffIdx: 3, activityTypeIdx: 5, durationIdx: 4 };
    for (const t of RESOURCE_TEMPLATES) {
      for (const [key, n] of Object.entries(max)) {
        if (t.params[key] === undefined) continue;
        const i = Number(t.params[key]);
        assert.ok(Number.isInteger(i) && i >= 0 && i < n, `${t.id}.${key}=${t.params[key]}`);
      }
      if (t.params.selectedTypes) assert.ok(Array.isArray(JSON.parse(t.params.selectedTypes)), t.id);
    }
  });

  it('adds the library scope, and leaves out an index the picker cannot honour', () => {
    const t = RESOURCE_TEMPLATES[0]!;
    assert.deepEqual(templateParams(t.params, { gradeIdx: 3, subjectIdx: 1 }), { ...t.params, gradeIdx: '3', subjectIdx: '1' });
    const partial = templateParams(t.params, { gradeIdx: -1, subjectIdx: 2 });
    assert.equal(partial.gradeIdx, undefined);
    assert.equal(partial.subjectIdx, '2');
  });
});
