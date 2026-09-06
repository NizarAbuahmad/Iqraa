/**
 * What this guards: which tools a teacher is actually offered.
 *
 * The 2026-08-18 audit narrowed both menus to the five tools that carry the
 * product. Three of the during-class tools came back on 2026-08-25, because
 * parking `classroom` left the escape / bingo / relay / gallery-walk formats
 * reachable only by typing the URL — which meant, in practice, not reachable.
 * `game` and `activity` returned with it rather than leaving one door of the
 * three open. `simplify` and `parent-msg` came back on 2026-09-03: the parent
 * message is an offline composer with no audit objection, and `simplify` came
 * back with an honest subtitle over an output that was still a lesson plan.
 * That last part is now fixed — `simplify` has its own screen, its own output
 * type and its own endpoint (2026-09-06), which closes the audit's «simplify is
 * not a tool» finding. Everything else stays parked.
 *
 * Parked tools stay in the catalog (their routes still resolve for saved
 * materials and deep links) but must not reappear on a menu — which is easy to
 * undo by accident, since adding a tool to the arrays is how you add one at
 * all. The list below is the decision; changing it should be deliberate.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AFTER_CLASS, ALL_TOOLS, BEFORE_CLASS, DURING_CLASS, WORKFLOW } from '../toolCatalog.ts';

const OFFERED_TOOLS = [
  'slides', 'lesson-plan', 'simplify',            // before
  'worksheet', 'classroom', 'game', 'activity',   // during
  'quiz', 'evaluations', 'parent-msg',            // after
];

/** Parked on 2026-08-18 and still parked — none of these may reach a menu. */
const PARKED_TOOLS = [
  'lesson-flow', 'geogebra', 'lesson-media', 'homework',
];

describe('toolCatalog — the offered surface', () => {
  it('offers exactly the agreed tools, in workflow order', () => {
    assert.deepEqual(ALL_TOOLS.map(t => t.id), OFFERED_TOOLS);
  });

  it('never offers a tool that is another tool wearing a flag', () => {
    // What `simplify` was until 2026-09-06: `route: '/ai-tools/lesson-plan'`
    // plus `routeParams: { simplify: '1' }`, so it produced the identical
    // LessonPlanOutput through the identical endpoint while its subtitle
    // promised students a direct explanation. The audit called it "not a tool"
    // and nothing in the suite could see it — a mode flag on someone else's
    // screen looks exactly like a route.
    const routes = ALL_TOOLS.filter(t => t.route).map(t => t.route);
    for (const tool of ALL_TOOLS) {
      if (!tool.routeParams) continue;
      assert.equal(
        routes.filter(r => r === tool.route).length,
        1,
        `«${tool.id}» shares ${tool.route} with another offered tool and distinguishes `
        + 'itself only by routeParams — give it its own screen and output type.',
      );
    }
  });

  it('gives simplify its own screen', () => {
    const simplify = ALL_TOOLS.find(t => t.id === 'simplify')!;
    assert.equal(simplify.route, '/ai-tools/simplify');
    assert.equal(simplify.routeParams, undefined);
  });

  it('keeps the pilot tools ahead of the ones that came back', () => {
    // The during-class section reads worksheet first: un-parking three tools
    // should not push a core tool below them.
    const during = WORKFLOW.find(s => s.id === 'during')!;
    assert.equal(during.tools[0]!.id, 'worksheet');
  });

  it('still parks everything the audit parked', () => {
    const offered = new Set(ALL_TOOLS.map(t => t.id));
    for (const id of PARKED_TOOLS) {
      assert.ok(!offered.has(id), `${id} was parked but is on a menu`);
    }
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
