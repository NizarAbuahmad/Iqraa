import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JORDAN_MAP } from '../publicGames/jordanMapData.ts';
import { GOVERNORATES } from '../publicGames/governorates.ts';
import { buildJordanMap, renderJordanMapModule } from '../../scripts/build-jordan-map.ts';

const root = join(import.meta.dirname, '..', '..');
const geojson = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'jordan-adm1-geoboundaries.geojson'), 'utf8'));

test('the committed data is exactly what the script builds from the committed source', () => {
  const committed = readFileSync(join(root, 'services', 'publicGames', 'jordanMapData.ts'), 'utf8');
  assert.equal(committed, renderJordanMapModule(geojson));
});

test('there is one non-empty path per governorate, under the same ids as the game', () => {
  assert.deepEqual(Object.keys(JORDAN_MAP.paths).sort(), GOVERNORATES.map(g => g.id).sort());
  for (const d of Object.values(JORDAN_MAP.paths)) assert.match(d, /^M[-0-9. LMZ]+Z$/);
});

test('every coordinate lies inside the viewBox, and the data stays small', () => {
  const [, , w, h] = JORDAN_MAP.viewBox.split(' ').map(Number) as [number, number, number, number];
  for (const d of Object.values(JORDAN_MAP.paths)) {
    for (const [x, y] of [...d.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const)) {
      assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${x},${y} outside ${w}x${h}`);
    }
  }
  assert.ok(JSON.stringify(JORDAN_MAP).length < 16_000, `${JSON.stringify(JORDAN_MAP).length} bytes`);
});

test('north is up and east is right (a flipped projection would fail these)', () => {
  const centre = (id: string) => {
    const pts = [...JORDAN_MAP.paths[id]!.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
    return { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length };
  };
  assert.ok(centre('aqaba').y > centre('maan').y, 'Aqaba is south of Ma\'an');
  assert.ok(centre('maan').y > centre('karak').y, 'Ma\'an is south of Karak');
  assert.ok(centre('irbid').y < centre('amman').y, 'Irbid is north of Amman');
  assert.ok(centre('mafraq').x > centre('jerash').x, 'Mafraq is east of Jerash');
  assert.ok(centre('tafilah').y < centre('aqaba').y, 'Tafilah is north of Aqaba');
});

test('building twice gives the same result', () => {
  assert.deepEqual(buildJordanMap(geojson), buildJordanMap(geojson));
});
