import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The root layout's navigation effect runs a series of gates, and ORDER is the behaviour: a held student
 * (the server is waiting for a parent's approval) must be consumed by `guardianGate` before the roster-claim,
 * teacher-setup, grade-setup and non-teacher bounces, or those send them to screens the server refuses and
 * back again, forever. The runner cannot render the layout, so the order is pinned at the source, in the
 * style of `guardianPageSource.test.ts`. Comments are stripped, so a comment may name any gate.
 */
const root = join(import.meta.dirname, '..', '..');
const raw = readFileSync(join(root, 'app', '_layout.tsx'), 'utf8');
// Line comments go first: the layout has one that ends in "/dev/*", which would open a bogus block comment.
const src = raw.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

/** The first CALL of a gate (name followed by an open paren); the import list has no paren. */
function firstCall(name: string): number {
  const at = src.indexOf(`${name}(`);
  assert.ok(at >= 0, `${name}( is not called in app/_layout.tsx`);
  return at;
}

describe('root layout: the guardian gate runs before the other gates', () => {
  const pub = firstCall('isPublicRoute');
  const guardian = firstCall('guardianGate');
  const later = ['needsRosterClaim', 'needsTeacherSetup', 'needsGradeSetup', 'isNonTeacherRoute'];

  it('the public-route pass-through comes before the guardian gate', () => {
    assert.ok(pub < guardian, 'isPublicRoute( must come before guardianGate(');
  });

  for (const name of later) {
    it(`guardianGate( comes before ${name}(`, () => {
      assert.ok(guardian < firstCall(name), `guardianGate( must come before ${name}(`);
    });
  }

  it('the block after guardianGate( returns (when it stops) before any later gate is called', () => {
    const firstLater = Math.min(...later.map(firstCall));
    const block = src.slice(guardian, firstLater);
    assert.match(
      block,
      /if\s*\(\s*\w+\.stop\s*\)\s*\{[\s\S]*?\breturn\b[\s\S]*?\}/,
      'after guardianGate( the effect must `if (g.stop) { …; return; }` before the next gate',
    );
  });
});
