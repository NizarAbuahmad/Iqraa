// A step points at a target id by NAME, and nothing but this test connects that
// name to the element a screen registers under it. Rename `today-prep` on one
// side and the tour would ring nothing — the step is silently dropped at run
// time, and no other check would say so. This reads the source on both sides.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stepsFor, type TourLayout, type TourRole } from '../tour.ts';
import { tabVisible, type TabName } from '../tabVisibility.ts';

const root = join(import.meta.dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const sources = ['app', 'components'].flatMap(dir => tsxFiles(join(root, dir))).map(file => ({
  file,
  text: readFileSync(file, 'utf8'),
}));

/** Literal ids a screen registers: `<TourTarget id="x"` and `useTourTarget('x'`. */
function literalTargets(): Set<string> {
  const ids = new Set<string>();
  for (const { text } of sources) {
    for (const m of text.matchAll(/<TourTarget\s+id="([^"]+)"/g)) ids.add(m[1]);
    for (const m of text.matchAll(/useTourTarget\(\s*['"]([^'"]+)['"]/g)) ids.add(m[1]);
  }
  return ids;
}

const TABS: TabName[] = ['index', 'iqra', 'school', 'curriculum', 'ai-tools', 'notifications', 'profile'];
const ROLES: TourRole[] = ['teacher', 'student', 'parent'];
const LAYOUTS: TourLayout[] = ['phone', 'desktop'];

describe('tour targets', () => {
  it('every literal target a step names is registered by a screen', () => {
    const registered = literalTargets();
    const missing: string[] = [];
    for (const role of ROLES) {
      for (const layout of LAYOUTS) {
        for (const s of stepsFor(role, layout)) {
          const id = s.targetId;
          if (id === null || id.startsWith('tab-') || id.startsWith('nav-')) continue;
          if (!registered.has(id)) missing.push(`${role}/${layout}: ${id}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it('tab-* ids are registered by the phone tab button, and wired into the tab layout', () => {
    const button = readFileSync(join(root, 'components/tour/TourTabButton.tsx'), 'utf8');
    assert.match(button, /useTourTarget\(`tab-\$\{tabName\}`\)/);
    const layout = readFileSync(join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
    assert.match(layout, /<TourTabButton tabName=\{entry\.name\}/);
  });

  it('nav-* ids are registered by the desktop sidebar rows', () => {
    const sidebar = readFileSync(join(root, 'components/ui/WebSidebar.tsx'), 'utf8');
    assert.match(sidebar, /useTourTarget\(`nav-\$\{entry\.name\}`\)/);
  });

  it('a step never points at a tab or sidebar row its role cannot see', () => {
    const blind: string[] = [];
    for (const role of ROLES) {
      for (const layout of LAYOUTS) {
        for (const s of stepsFor(role, layout)) {
          const m = s.targetId?.match(/^(tab|nav)-(.+)$/);
          if (!m) continue;
          const [, kind, name] = m;
          assert.ok(TABS.includes(name as TabName), `${s.targetId} is not a tab`);
          // A phone's tab bar is `tab-`, the desktop sidebar `nav-`: the prefix must match the layout.
          if ((kind === 'tab') !== (layout === 'phone')) blind.push(`${role}/${layout}: ${s.targetId} has the wrong prefix`);
          const visible = tabVisible(name as TabName, { isTeacher: role === 'teacher', isDesktop: layout === 'desktop' });
          if (!visible) blind.push(`${role}/${layout}: ${s.targetId} is not in that role's navigation`);
        }
      }
    }
    assert.deepEqual(blind, []);
  });
});
