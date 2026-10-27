/**
 * The web composer's text area sizes itself to what is typed.
 *
 * react-native-web renders a multiline TextInput as a `<textarea>` that is two
 * rows tall (HTML's default) and never grows or shrinks, so the empty composer
 * held a one-line placeholder on its top row with the `+` and send buttons
 * level with the empty row below it. The fix is `rows={1}` plus this: reset the
 * height to `auto` BEFORE reading `scrollHeight`, because a textarea that has
 * been given an explicit height reports at least that height — measuring
 * without the reset can grow the field but never shrink it again after a send.
 * The DOM is faked: `node:test` has none, and the order of the two writes is
 * the whole behaviour.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fitTextareaHeight } from '../webTextarea.ts';

/** A textarea whose scrollHeight is the larger of its content and its set height, as in a browser. */
function fakeTextarea(contentHeight: number, initialHeight = 'auto') {
  const writes: string[] = [];
  let height = initialHeight;
  return {
    writes,
    style: {
      get height() { return height; },
      set height(v: string) { height = v; writes.push(v); },
    },
    get scrollHeight() {
      const set = height.endsWith('px') ? parseFloat(height) : 0;
      return Math.max(contentHeight, set);
    },
  };
}

describe('fitTextareaHeight', () => {
  it('sets the height to the content', () => {
    const node = fakeTextarea(38);
    fitTextareaHeight(node);
    assert.equal(node.style.height, '38px');
  });

  it('grows with more lines', () => {
    const three = fakeTextarea(82);
    fitTextareaHeight(three);
    assert.equal(three.style.height, '82px');
  });

  it('shrinks again once the text is gone', () => {
    // It was grown to 82px for three lines; the text is cleared, content is one line.
    const node = fakeTextarea(38, '82px');
    fitTextareaHeight(node);
    assert.equal(node.style.height, '38px');
  });

  it('resets to auto before it measures', () => {
    const node = fakeTextarea(38, '82px');
    fitTextareaHeight(node);
    assert.equal(node.writes[0], 'auto');
  });

  it('does nothing without a node (a native build, or before mount)', () => {
    assert.doesNotThrow(() => fitTextareaHeight(null));
    assert.doesNotThrow(() => fitTextareaHeight(undefined));
    assert.doesNotThrow(() => fitTextareaHeight({} as never));
  });
});
