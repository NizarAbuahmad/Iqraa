/**
 * The in-class usage events (services/classUsage.ts). An event name is history — a rename
 * splits its chart — so the list is pinned; and the screens must actually call them, which a
 * unit test of the helpers alone would not notice.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLASS_USAGE_EVENTS, firstInk, whiteboardSource } from '../classUsage.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, '..', '..', ...parts), 'utf8');

describe('class usage events', () => {
  it('keeps the shipped names', () => {
    assert.deepEqual([...CLASS_USAGE_EVENTS], [
      'whiteboard_opened',
      'whiteboard_drawn',
      'whiteboard_solved',
      'whiteboard_saved',
      'whiteboard_exported',
      'classroom_activity_started',
      'class_pen_used',
    ]);
  });

  it('sends every listed name, and nothing unlisted', () => {
    const src = read('services', 'classUsage.ts');
    const sent = [...src.matchAll(/trackEvent\('([a-z_]+)'/g)].map(m => m[1]);
    assert.deepEqual([...sent].sort(), [...CLASS_USAGE_EVENTS].sort());
  });

  it('says how the board was reached', () => {
    assert.equal(whiteboardSource({}), 'menu');
    assert.equal(whiteboardSource({ from: 'presentation' }), 'presentation');
    assert.equal(whiteboardSource({ savedId: 'abc' }), 'saved');
    // A saved board reopened is `saved` whatever else rides on the URL.
    assert.equal(whiteboardSource({ savedId: 'abc', from: 'presentation' }), 'saved');
    // `from` is a URL param: anything but the one known value is the plain way in.
    assert.equal(whiteboardSource({ from: 'somewhere' }), 'menu');
  });

  it('reports first ink once', () => {
    assert.equal(firstInk(false, false), false);
    assert.equal(firstInk(false, true), true);
    assert.equal(firstInk(true, true), false);
  });
});

describe('the screens report what they do', () => {
  const calls: [string[], string[]][] = [
    [['app', 'ai-tools', 'whiteboard.tsx'], [
      'trackWhiteboardOpened(', 'trackWhiteboardDrawn(', 'trackWhiteboardSolved(',
      'trackWhiteboardSaved(', 'trackWhiteboardExported(',
    ]],
    [['app', 'ai-tools', 'classroom', 'builder.tsx'], ['trackClassroomActivityStarted(']],
    [['app', 'ai-tools', 'classroom', 'presentation.tsx'], ["trackClassPenUsed('slides')", "from: 'presentation'"]],
    [['app', 'ai-tools', 'classroom', 'book-page.tsx'], ["trackClassPenUsed('book_page')"]],
  ];
  for (const [file, needles] of calls) {
    it(file.join('/'), () => {
      const src = read(...file);
      for (const needle of needles) assert.ok(src.includes(needle), `${file.join('/')} does not call ${needle}`);
    });
  }

  it('never sends a title, a topic or a problem with a whiteboard event', () => {
    const src = read('app', 'ai-tools', 'whiteboard.tsx');
    for (const m of src.matchAll(/trackWhiteboard\w+\(([^)]*)\)/g)) {
      assert.doesNotMatch(m[1]!, /title|topic|problem|subject|grade/i, m[0]);
    }
  });
});
