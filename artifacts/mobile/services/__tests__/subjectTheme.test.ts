// Today takes the colour of the lesson's subject, so an English lesson and a
// maths lesson no longer open on the same navy screen. Corner subjects borrow
// their corner's hero; every other subject's catalog colour is deepened until
// white band text reads on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECTS } from '@workspace/curriculum';
import { CORNERS } from '../../constants/corners.ts';
import { contrast } from '../readableColor.ts';
import { subjectTheme, subjectChipColor, BRAND_BAND } from '../subjectTheme.ts';

test('a corner subject wears its corner', () => {
  assert.equal(subjectTheme('mathematics').hero, CORNERS.math.light.hero);
  assert.equal(subjectTheme('english').hero, CORNERS.english.light.hero);
  assert.equal(subjectTheme('chemistry').hero, CORNERS.lab.light.hero);
  assert.equal(subjectTheme('islamic').hero, CORNERS.quran.light.hero);
  assert.equal(subjectTheme('mathematics').motif, CORNERS.math.motif);
});

test('no subject, or an unknown one, keeps the brand band', () => {
  assert.deepEqual(subjectTheme(null), BRAND_BAND);
  assert.deepEqual(subjectTheme('no-such-subject'), BRAND_BAND);
});

test('white band text reads on every subject at 4.5:1', () => {
  for (const s of SUBJECTS) {
    const { hero } = subjectTheme(s.id);
    assert.ok(contrast('#FFFFFF', hero) >= 4.5, `${s.id}: white on ${hero} is ${contrast('#FFFFFF', hero).toFixed(2)}:1`);
  }
});

test('the subjects a teacher switches between most do not share a band', () => {
  const heroes = ['mathematics', 'english', 'arabic', 'chemistry', 'islamic', 'social'].map(id => subjectTheme(id).hero);
  assert.equal(new Set(heroes).size, heroes.length, heroes.join(' '));
});

test('a class chip colour reads as text on the light and the dark card', () => {
  for (const s of SUBJECTS) {
    for (const card of ['#FFFFFF', '#111F36']) {
      const c = subjectChipColor(s.id, card);
      assert.ok(contrast(c, card) >= 4.5, `${s.id} on ${card}: ${c} is ${contrast(c, card).toFixed(2)}:1`);
    }
  }
});

// The generator screens' lesson card leads with the subject's own drawing.
test('a lesson card tile: a corner subject wears its corner drawing, any other the library', async () => {
  const { subjectTile } = await import('../subjectTheme.ts');
  assert.equal(subjectTile('mathematics').glyph, CORNERS.math.drawing);
  assert.equal(subjectTile('mathematics').color, CORNERS.math.light.hero);
  assert.equal(subjectTile('chemistry').glyph, CORNERS.lab.drawing);
  assert.equal(subjectTile('islamic').glyph, CORNERS.quran.drawing);
  assert.equal(subjectTile('arabic').glyph, 'library');
  assert.equal(subjectTile(null).glyph, 'library');
  assert.match(subjectTile('no-such-subject').color, /^#[0-9A-F]{6}$/i);
});
