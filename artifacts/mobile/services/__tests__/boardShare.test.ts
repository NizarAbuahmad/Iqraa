/**
 * Sharing a whiteboard by link: the screens must wire the existing share flow to boards.
 * The server half (a board is served whole, never answer-blanked) is pinned in
 * api-server's sharedMaterial.db.test.ts and materialShare.test.ts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(here, '..', '..', ...p), 'utf8');

describe('board share link wiring', () => {
  const wb = read('app', 'ai-tools', 'whiteboard.tsx');
  const view = read('app', 'workspace', 'view.tsx');
  const viewer = read('components', 'classroom', 'BoardViewer.tsx');

  it('the whiteboard shares the saved board through the shared share action, never an unsaved one', () => {
    assert.match(wb, /shareMaterialLink\(current\.id, current\.title/);
    assert.match(wb, /isBoardDirty\(docRef\.current, current\.json\)/);
    assert.match(wb, /boardShareSaveFirst/);
  });

  it('a shared board opens in the read-only viewer, exports itself, and a saved copy reopens in the whiteboard', () => {
    assert.match(view, /kind === 'board' \? \(\s*<BoardViewer content=\{content\} \/>/);
    assert.match(view, /buildBoardHTML\(content, item\.title, isAr\)/);
    assert.match(view, /item\.type === 'board'\) router\.replace\(\{ pathname: '\/ai-tools\/whiteboard'/);
  });

  it('the viewer is inert: no drawing, no text editing', () => {
    assert.match(viewer, /active=\{false\}/);
    assert.match(viewer, /mode="none"/);
    assert.match(viewer, /parseBoard\(content\)/, 'untrusted content is validated before it is drawn');
  });
});
