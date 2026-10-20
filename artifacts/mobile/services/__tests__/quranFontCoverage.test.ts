/**
 * What this guards: a code point the Quran font lacks does not fail anywhere —
 * the platform silently draws it in another font, and a Quranic mark can come
 * out as a box or in a different style on a student's phone. (The Lab's «Nₐ»
 * was this exact bug in Readex Pro.) This reads the font file's own character
 * map and checks every code point of the shipped text against it, and checks
 * the file is the unmodified one the data says the text must be drawn in.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { QURAN_CORNER, QURAN_SURAHS } from '@workspace/curriculum/quran';
import { fontCodePoints } from './support/ttfCmap.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const bytes = readFileSync(path.join(HERE, '../../assets/fonts/UthmanicHafs-v-3.0.ttf'));
const glyphs = fontCodePoints(bytes);

describe('the character-map reader', () => {
  it('sees Arabic letters and a space, and not a CJK ideograph', () => {
    assert.ok(glyphs.has(0x627), 'alef');
    assert.ok(glyphs.has(0x20), 'space');
    assert.ok(!glyphs.has(0x4e00), 'CJK ideograph');
  });
});

describe('the Quran font', () => {
  it('is the unmodified file the data says the text must be drawn in', () => {
    assert.equal(createHash('sha256').update(bytes).digest('hex'), QURAN_CORNER.source.font.sha256);
    assert.equal(QURAN_CORNER.source.font.family, 'KFGQPC HAFS Uthmanic Script');
  });

  it('has a glyph for every code point in the shipped text', () => {
    const missing = new Map<number, string>();
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) {
        for (const ch of a.text) {
          const cp = ch.codePointAt(0)!;
          if (!glyphs.has(cp) && !missing.has(cp)) missing.set(cp, `${s.number}:${a.n}`);
        }
      }
    }
    const report = [...missing].map(([cp, at]) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (first at ${at})`);
    assert.deepEqual(report, []);
  });
});
