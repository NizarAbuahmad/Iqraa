/**
 * The defaults every text box in an exported PowerPoint deck gets — see
 * services/pptxText.ts. `exportPptx.ts` itself cannot be loaded here (it
 * imports react-native), which is why these live in their own module.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pptxLang, textDefaults, withTextDefaults } from '../pptxText.ts';
import { hasArabicLetter } from '../mathRender.ts';

describe('hasArabicLetter', () => {
  it('is true for Arabic words, false for values', () => {
    assert.equal(hasArabicLetter('ما رأس القطع؟'), true);
    assert.equal(hasArabicLetter('ص = 2س + 1'), true);
    for (const v of ['(2, 0)', '-2', '٢', '٤٥', '(٠، ٤)', 'x² − 4', '؟', '']) {
      assert.equal(hasArabicLetter(v), false, v);
    }
  });
});

describe('textDefaults', () => {
  it('lays an Arabic line out right-to-left and a value left-to-right', () => {
    assert.equal(textDefaults('سؤال سريع', true, 'Almarai').rtlMode, true);
    assert.equal(textDefaults('(2, 0)', true, 'Almarai').rtlMode, false);
    assert.equal(textDefaults('-2', true, 'Almarai').rtlMode, false);
  });

  it('never lays an English deck out right-to-left', () => {
    assert.equal(textDefaults('سؤال', false, 'Almarai').rtlMode, false);
  });

  it('names the body face and the deck language', () => {
    assert.deepEqual(textDefaults('سؤال', true, 'Almarai'), { fontFace: 'Almarai', lang: 'ar-JO', rtlMode: true });
    assert.equal(pptxLang(false), 'en-US');
  });
});

describe('withTextDefaults', () => {
  it('fills in a plain string, and the caller wins', () => {
    const [text, o] = withTextDefaults('العنوان', { x: 1, fontFace: 'Readex Pro' }, true, 'Almarai');
    assert.equal(text, 'العنوان');
    assert.deepEqual(o, { fontFace: 'Readex Pro', lang: 'ar-JO', rtlMode: true, x: 1 });
  });

  it('puts the defaults on every run, decided by that run, under the outer face', () => {
    const [runs, o] = withTextDefaults(
      [{ text: '(2, 0)', options: { breakLine: true } }, { text: 'الرأس', options: { fontFace: 'X' } }],
      { fontFace: 'Readex Pro', x: 0 },
      true,
      'Almarai',
    );
    const [a, b] = runs as { options: Record<string, unknown> }[];
    assert.deepEqual(a!.options, { fontFace: 'Readex Pro', lang: 'ar-JO', rtlMode: false, breakLine: true });
    assert.deepEqual(b!.options, { fontFace: 'X', lang: 'ar-JO', rtlMode: true });
    assert.equal(o.x, 0);
    assert.equal('x' in a!.options, false, 'layout options stay on the box, not the run');
  });

  it('gives a run with no face of its own the body face', () => {
    const [runs] = withTextDefaults([{ text: 'سطر' }], {}, true, 'Almarai');
    assert.equal((runs as { options: { fontFace: string } }[])[0]!.options.fontFace, 'Almarai');
  });
});
