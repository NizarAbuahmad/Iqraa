/**
 * What this guards: which tools a teacher is actually offered.
 *
 * The 2026-08-18 audit narrowed both menus to the five tools that carry the
 * product. Three of the during-class tools came back on 2026-08-25, because
 * parking `classroom` left the escape / bingo / relay / gallery-walk formats
 * reachable only by typing the URL — which meant, in practice, not reachable.
 * `game` and `activity` returned with it rather than leaving one door of the
 * three open. `parent-msg` came back on 2026-09-03 — an offline composer with
 * no audit objection. Everything else stays parked.
 *
 * `simplify` was removed outright on 2026-09-19. It was never a tool: it was
 * `route: '/ai-tools/lesson-plan'` plus `routeParams: { simplify: '1' }`, and
 * the three signals that flag sent (a topic prefix, an objectives default, a
 * `mode:simplify` line) were read by no prompt clause on the server — so the
 * live path returned an ordinary lesson plan under a different title. The
 * capability now lives as a preset chip on that screen's adaptations field,
 * whose text the prompt does apply. The last guard below is what would have
 * caught the shape.
 *
 * `prompt-slides` left the menus on 2026-09-24: a second card beside Lesson
 * slides, near-identical name, same deck at the end. It is a link inside the
 * slides screen now, so it is parked here like the others.
 *
 * The resources library is not a tool at all: it has its own tab, and since
 * 2026-10-08 no card on the Tools tab either.
 *
 * Parked tools stay in the catalog (their routes still resolve for saved
 * materials and deep links) but must not reappear on a menu — which is easy to
 * undo by accident, since adding a tool to the arrays is how you add one at
 * all. The list below is the decision; changing it should be deliberate.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AFTER_CLASS, ALL_TOOLS, BEFORE_CLASS, CHAT_MENU_TOOLS, CHAT_NATIVE_TOOLS, DURING_CLASS, WORKFLOW,
} from '../toolCatalog.ts';

const OFFERED_TOOLS = [
  'slides', 'lesson-plan',                                                // before
  'worksheet', 'classroom', 'game', 'activity', 'games',                   // during
  'quiz', 'evaluations', 'parent-msg',                                    // after
];

/** Parked on 2026-08-18 and still parked — none of these may reach a menu. */
const PARKED_TOOLS = [
  'lesson-flow', 'geogebra', 'homework', 'prompt-slides',
];

describe('toolCatalog — the offered surface', () => {
  it('offers exactly the agreed tools, in workflow order', () => {
    assert.deepEqual(ALL_TOOLS.map(t => t.id), OFFERED_TOOLS);
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

  it('never offers two tools that share one screen and differ only by params', () => {
    // How «تبسيط الشرح» shipped for three weeks: a mode flag on the lesson
    // plan's screen, presented as a tool of its own. A second card pointing at
    // a route another card already owns is not a tool, it is a preset.
    const byRoute = new Map<string, string>();
    for (const tool of ALL_TOOLS) {
      if (!tool.route) continue;
      const owner = byRoute.get(tool.route);
      assert.equal(owner, undefined, `${tool.id} shares ${tool.route} with ${owner}`);
      byRoute.set(tool.route, tool.id);
    }
  });
});

describe('toolCatalog — the chat "+" menu', () => {
  // The "+" used to list the whole catalog, so most rows (slides, the class
  // hub, the library, evaluations…) walked the teacher out of the conversation
  // from a button that reads as "add something to this message". It now lists
  // only what the chat answers itself; everything else lives on the Tools tab.
  it('lists only tools the chat can carry out itself, in workflow order', () => {
    assert.deepEqual(CHAT_MENU_TOOLS.map(t => t.id), ['lesson-plan', 'worksheet', 'activity', 'quiz']);
  });

  it('never lists a tool that just navigates away', () => {
    for (const tool of CHAT_MENU_TOOLS) {
      assert.ok(CHAT_NATIVE_TOOLS[tool.id], `${tool.id} is on the "+" menu but chat cannot run it`);
    }
    const ids = new Set(CHAT_MENU_TOOLS.map(t => t.id));
    for (const id of ['library', 'slides', 'classroom', 'game', 'games', 'evaluations', 'parent-msg']) {
      assert.ok(!ids.has(id), `${id} leaves the chat and does not belong on the "+" menu`);
    }
  });

  it('leaves a parked chat tool off the menu', () => {
    // `homework` can be generated by chat but is parked: un-parking it is one
    // line in the catalog, and the menu must follow without a second edit.
    assert.ok(CHAT_NATIVE_TOOLS['homework']);
    assert.ok(!CHAT_MENU_TOOLS.some(t => t.id === 'homework'));
  });
});
