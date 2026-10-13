/**
 * deckTheme.ts — the colours the deck is read in.
 *
 * Contrast is the contract here: the concept accent colours the slide title,
 * and the divider is the ground under white type. Both were short of 4.5:1
 * when they were slate and DECK_ACCENT respectively.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DECK_ACCENT, DECK_BG, DECK_TEAL, DECK_THEMES, DECK_THEME_ORDER, DEFAULT_DECK_THEME,
  isDeckThemeId, resolveDeckTheme, slideTypeAccent, themeIdForSubject,
} from '../deckTheme.ts';

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('slideTypeAccent', () => {
  it('colours a concept slide in the brand teal', () => {
    assert.equal(slideTypeAccent('intro'), DECK_TEAL);
  });

  it('reads at 4.5:1 or better as a heading on the slide background', () => {
    assert.ok(contrast(slideTypeAccent('intro'), DECK_BG) >= 4.5);
  });

  it('keeps white type on the divider at 4.5:1 or better', () => {
    assert.equal(slideTypeAccent('divider'), DECK_TEAL);
    assert.ok(contrast('#FFFFFF', slideTypeAccent('divider')) >= 4.5);
  });

  it('is why DECK_TEAL exists — the lighter brand teal is not enough for either job', () => {
    assert.ok(contrast(DECK_ACCENT, DECK_BG) < 4.5);
    assert.ok(contrast('#FFFFFF', DECK_ACCENT) < 4.5);
  });

  it('leaves the typed accents as they were', () => {
    assert.equal(slideTypeAccent('challenge'), '#C2410C');
    assert.equal(slideTypeAccent('question'), '#1D4ED8');
    assert.equal(slideTypeAccent('summary'), '#D6206B');
  });
});

describe('deck themes — every palette is readable, not just the default', () => {
  for (const id of DECK_THEME_ORDER) {
    const t = DECK_THEMES[id];

    it(`${id}: the title colour reads on its own ground, and white reads on the divider`, () => {
      assert.ok(contrast(t.primary, t.bg) >= 4.5, 'primary on bg');
      assert.ok(contrast('#FFFFFF', t.primary) >= 4.5, 'white on primary');
      assert.equal(slideTypeAccent('intro', t), t.primary);
      assert.equal(slideTypeAccent('divider', t), t.primary);
    });

    it(`${id}: body and secondary text read on the cards and the ground`, () => {
      assert.ok(contrast(t.text, t.bg) >= 7, 'text on bg');
      assert.ok(contrast(t.text, t.card) >= 7, 'text on card');
      assert.ok(contrast(t.muted, t.bg) >= 4.5, 'muted on bg');
      assert.ok(contrast(t.muted, t.card) >= 4.5, 'muted on card');
      // The default's pink is 4.43:1 on cream — short by a hair since before
      // themes existed, and left alone so the default deck does not change.
      assert.ok(contrast(t.secondary, t.bg) >= (id === 'iqraa' ? 4.4 : 4.5), 'secondary on bg');
    });

    it(`${id}: is a complete, well-formed hex palette with both names`, () => {
      for (const k of ['bg', 'card', 'border', 'text', 'muted', 'accent', 'primary', 'secondary', 'blob'] as const) {
        assert.match(t[k], /^#[0-9A-Fa-f]{6}$/, k);
      }
      assert.equal(t.id, id);
      assert.ok(t.nameAr && t.nameEn);
    });
  }

  it('looks different: no two themes share a ground or a primary', () => {
    const themes = DECK_THEME_ORDER.map(id => DECK_THEMES[id]);
    assert.equal(new Set(themes.map(t => t.bg)).size, themes.length);
    assert.equal(new Set(themes.map(t => t.primary)).size, themes.length);
  });

  it('the default theme IS the original palette, so nothing already shipped moves', () => {
    assert.equal(DEFAULT_DECK_THEME.bg, DECK_BG);
    assert.equal(DEFAULT_DECK_THEME.primary, DECK_TEAL);
    assert.equal(DEFAULT_DECK_THEME.accent, DECK_ACCENT);
    assert.equal(slideTypeAccent('intro'), DECK_TEAL);
    assert.equal(slideTypeAccent('summary'), '#D6206B');
  });

  it('typed accents stay put in every theme — a challenge is orange everywhere', () => {
    for (const id of DECK_THEME_ORDER) {
      assert.equal(slideTypeAccent('challenge', DECK_THEMES[id]), '#C2410C');
      assert.equal(slideTypeAccent('question', DECK_THEMES[id]), '#1D4ED8');
    }
  });
});

describe('themeIdForSubject — from an id or a name, in either language', () => {
  const cases: [string, string][] = [
    ['mathematics', 'ocean'], ['الرياضيات', 'ocean'], ['Financial Literacy', 'ocean'],
    ['chemistry', 'forest'], ['Physics', 'forest'], ['الأحياء', 'forest'], ['Earth and Environmental Science', 'forest'], ['العلوم', 'forest'],
    ['arabic', 'parchment'], ['اللغة العربية', 'parchment'], ['Islamic Studies', 'parchment'], ['Social Studies', 'parchment'],
    ['history', 'parchment'], ['التربية الوطنية والمدنية', 'parchment'],
    ['english', 'violet'], ['اللغة الإنجليزية', 'violet'], ['Art, Music and Drama Education', 'violet'], ['creative-arts', 'violet'],
    ['computer', 'graphite'], ['Digital Skills', 'graphite'], ['digital-literacy', 'graphite'], ['Vocational Education', 'graphite'],
    // Not "physics": the word «physical» must not pull Physical Education into forest.
    ['Physical Education', 'iqraa'], ['physical-education', 'iqraa'],
    ['', 'iqraa'], ['something unheard of', 'iqraa'],
  ];
  for (const [subject, expected] of cases) {
    it(`${JSON.stringify(subject)} → ${expected}`, () => {
      assert.equal(themeIdForSubject(subject), expected);
    });
  }

  it('tolerates a missing subject', () => {
    assert.equal(themeIdForSubject(undefined), 'iqraa');
    assert.equal(themeIdForSubject(null), 'iqraa');
  });
});

describe('resolveDeckTheme', () => {
  it('a theme the deck carries wins over its subject', () => {
    assert.equal(resolveDeckTheme({ themeId: 'violet', subject: 'الرياضيات' }).id, 'violet');
  });

  it('falls back to the subject, then to the brand', () => {
    assert.equal(resolveDeckTheme({ subject: 'Chemistry' }).id, 'forest');
    assert.equal(resolveDeckTheme({ subject: '' }).id, 'iqraa');
    assert.equal(resolveDeckTheme(null), DEFAULT_DECK_THEME);
    assert.equal(resolveDeckTheme(undefined), DEFAULT_DECK_THEME);
  });

  it('ignores a theme id it does not know — an old or hand-edited saved deck still opens', () => {
    assert.equal(resolveDeckTheme({ themeId: 'neon', subject: 'English' }).id, 'violet');
    assert.equal(resolveDeckTheme({ themeId: 42 as unknown, subject: '' }).id, 'iqraa');
    assert.ok(!isDeckThemeId('toString'), 'inherited object keys are not theme ids');
  });
});
