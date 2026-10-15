import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addPoint, emptyScene, MAX_POINTS } from '../mathGeometry.ts';
import { ARABIC_POINT_LETTERS, pointName } from '../mathPointNames.ts';

/** The labels a scene hands out, in order: A, B, C, … */
function sceneLabels(): string[] {
  let scene = emptyScene();
  for (let i = 0; i < MAX_POINTS; i++) scene = addPoint(scene, i, 0).scene;
  return scene.points.map(p => p.label);
}

describe('pointName: the books call the points أ ب ج, not A B C', () => {
  it('the first points are the book\'s أ، ب، ج، د، هـ', () => {
    assert.deepEqual(['A', 'B', 'C', 'D', 'E'].map(l => pointName(l, 'ar')), ['أ', 'ب', 'ج', 'د', 'هـ']);
  });

  it('English keeps the Latin letters', () => {
    assert.equal(pointName('A', 'en'), 'A');
    assert.equal(pointName('ABC', 'en'), 'ABC');
  });

  it('every label a scene can make has its own Arabic name, one-to-one', () => {
    const labels = sceneLabels();
    assert.equal(labels.length, MAX_POINTS);
    const names = labels.map(l => pointName(l, 'ar'));
    assert.equal(new Set(names).size, MAX_POINTS, 'two labels share an Arabic name');
    for (const n of names) assert.match(n, /^[ء-ي]/u, `«${n}» is not an Arabic letter`);
    assert.equal(ARABIC_POINT_LETTERS.length, MAX_POINTS);
  });

  it('never uses س or ص: those are the axes, and a point called ص would read as a variable', () => {
    assert.ok(!ARABIC_POINT_LETTERS.includes('س'));
    assert.ok(!ARABIC_POINT_LETTERS.includes('ص'));
  });

  it('a shape\'s name is its letters apart, so the letters do not join into a word', () => {
    assert.equal(pointName('ABC', 'ar'), 'أ ب ج');
    assert.equal(pointName('AB', 'ar'), 'أ ب');
    // «ب» + «ج» written together would be one joined glyph run, and read as the word «بج».
    assert.ok(/\s/.test(pointName('BC', 'ar')));
  });

  it('an Arabic name holds no Latin letter', () => {
    for (const l of sceneLabels()) assert.doesNotMatch(pointName(l, 'ar'), /[A-Za-z]/);
    assert.doesNotMatch(pointName('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'ar'), /[A-Za-z]/);
  });

  it('text that is not a point label passes through untouched', () => {
    assert.equal(pointName('', 'ar'), '');
    assert.equal(pointName('٣', 'ar'), '٣');
  });
});
