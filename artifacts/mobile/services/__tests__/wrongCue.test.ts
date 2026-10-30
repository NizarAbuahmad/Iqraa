import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeWrongCue } from '../../scripts/make-wrong-cue.ts';

const file = readFileSync(join(import.meta.dirname, '..', '..', 'assets', 'sounds', 'wrong.wav'));

test('wrong.wav is exactly what the script generates (no hand edits)', () => {
  assert.ok(file.equals(makeWrongCue()));
});

test('wrong.wav is a small, quiet, click-free 16-bit mono PCM clip', () => {
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 12), 'WAVE');
  assert.equal(file.readUInt16LE(20), 1); // PCM
  assert.equal(file.readUInt16LE(22), 1); // mono
  assert.equal(file.readUInt16LE(34), 16);
  assert.ok(file.length < 20_000, `${file.length} bytes`);
  const samples = (file.length - 44) / 2;
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(file.readInt16LE(44 + i * 2)));
  assert.ok(peak > 3000 && peak <= 0.31 * 32767, `peak ${peak}`);
  assert.ok(Math.abs(file.readInt16LE(44)) < 200, 'starts at silence');
  assert.ok(Math.abs(file.readInt16LE(44 + (samples - 1) * 2)) < 200, 'ends at silence');
});
