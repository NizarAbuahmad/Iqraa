// Pins the band gradient used by components/ui/Band.tsx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_DEEPEN, bandGradient, shade } from '../band.ts';

test('shade moves a colour toward black by the given share', () => {
  assert.equal(shade('#FFFFFF', 0), '#FFFFFF');
  assert.equal(shade('#ffffff', 0.5), '#808080');
  assert.equal(shade('#3730A3', 1), '#000000');
});

test('shade clamps the share to 0–1', () => {
  assert.equal(shade('#3730A3', -1), '#3730A3');
  assert.equal(shade('#3730A3', 2), '#000000');
});

test('a band starts at its hero colour and only deepens', () => {
  const [from, to] = bandGradient('#006D65');
  assert.equal(from, '#006D65');
  assert.equal(to, shade('#006D65', BAND_DEEPEN));
  assert.ok(BAND_DEEPEN > 0 && BAND_DEEPEN < 0.4);
});
