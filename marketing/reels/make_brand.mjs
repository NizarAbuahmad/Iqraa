// Writes the official Iqrra lockup as SVG, straight from the app's own vector data
// (artifacts/mobile/constants/brandMark.ts) so the reels can never drift from the app again.
//   assets/lockup-white.svg  white tile, teal leaf, white wordmark  — on teal / ink grounds
//   assets/lockup-ink.svg    teal tile, white leaf, ink wordmark    — on paper
//   assets/mark-white.svg / mark-teal.svg  the leaf tile alone
// The old reels used a raster logo (attached_assets/0_ikraa_logo…png: navy glow, "IQRA", "AI TEACHING ASSISTANT").
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '../../artifacts/mobile/constants/brandMark.ts'), 'utf8');
const str = n => src.match(new RegExp(`export const ${n}\\s*=\\s*'([^']+)'`))[1];
const num = n => Number(src.match(new RegExp(`export const ${n}\\s*=\\s*([\\d.]+)`))[1]);
const obj = n => Object.fromEntries([...src.match(new RegExp(`export const ${n}\\s*=\\s*\\{([^}]+)\\}`))[1].matchAll(/(\w+):\s*([\d.]+)/g)].map(m => [m[1], Number(m[2])]));

const TEAL = str('BRAND_TEAL'), INK = str('BRAND_INK');
const LEAF = str('LEAF_PATH'), STEM = str('STEM_PATH'), WORD = str('WORDMARK_PATH'), VB = str('LOCKUP_VIEWBOX');
const DOT = obj('DOT'), OFF = obj('LOCKUP_MARK_OFFSET');
const RX = 48 * (13 / 48);          // MARK_RADIUS = 13/48

const tile = (ground, leaf) =>
  `<rect width="48" height="48" rx="${RX}" fill="${ground}"/><path d="${LEAF}" fill="${leaf}"/>` +
  `<path d="${STEM}" stroke="${ground}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` +
  `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${leaf}"/>`;
const lockup = (ground, leaf, ink) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB}"><g transform="translate(${OFF.x} ${OFF.y})">${tile(ground, leaf)}</g><path d="${WORD}" fill="${ink}"/></svg>\n`;
const mark = (ground, leaf) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${tile(ground, leaf)}</svg>\n`;

writeFileSync(join(HERE, 'assets/lockup-white.svg'), lockup('#FFFFFF', TEAL, '#FFFFFF'));
writeFileSync(join(HERE, 'assets/lockup-ink.svg'), lockup(TEAL, '#FFFFFF', INK));
writeFileSync(join(HERE, 'assets/mark-white.svg'), mark('#FFFFFF', TEAL));
writeFileSync(join(HERE, 'assets/mark-teal.svg'), mark(TEAL, '#FFFFFF'));
console.log('brand assets written', { TEAL, INK, VB });
