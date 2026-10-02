import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, readableOn, textOn } from '../readableColor.ts';

const STOCK = ['#3B82F6', '#E67E22', '#10B981', '#A855F7', '#F43F5E', '#0EA5E9', '#F59E0B'];

test('every stock category colour becomes AA text on the light and dark cards', () => {
  for (const surface of ['#FFFFFF', '#111F36']) {
    for (const c of STOCK) assert.ok(contrast(readableOn(c, surface), surface) >= 4.5, `${c} on ${surface}`);
  }
});

test('a colour that already passes is left alone', () => {
  assert.equal(readableOn('#006D65', '#FFFFFF'), '#006D65');
});

// Pinned hexes, not the palette: colors.ts touches react-native at module
// scope and this runner has no RN transform. Keep them in step with colors.ts.
test('the live accent and the disabled-button tints are AA in both schemes', () => {
  assert.ok(contrast('#FFFFFF', '#B45309') >= 4.5, 'white on live');
  assert.ok(contrast('#006A63', '#E3F2EF') >= 4.5, 'disabled primary, light');
  assert.ok(contrast('#5C6675', '#EFEDE7') >= 4.5, 'disabled other, light');
  assert.ok(contrast('#5EEAD4', '#12302F') >= 4.5, 'disabled primary, dark');
  assert.ok(contrast('#9AA9BC', '#16243B') >= 4.5, 'disabled other, dark');
});

test('textOn picks the label that reads on a fill', () => {
  assert.equal(textOn('#006D65'), '#FFFFFF');
  assert.equal(textOn('#2DD4BF'), '#0B1B33');
});
