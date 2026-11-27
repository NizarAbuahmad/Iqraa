/**
 * Two small fixes on the parent side (2026-11-27).
 *
 * 1. «المدرسة»'s selected child chip draws its label on the palette's primary. In dark mode
 *    that is a light teal, and white on it was about 1.9:1; the label is now the palette's
 *    own `primaryForeground`.
 * 2. The child picked on «المدرسة» carries over to «نتائج أبنائي»: every link there opens
 *    `/my-exams?child=<key>`, and the results screen shows that child alone until
 *    «اعرض كل الأبناء». An unknown key shows everyone rather than an empty screen.
 *
 * The screens import react-native and expo, which `node --test` cannot load, so the
 * screen checks read their source (the pattern parentProjectScreen.test.ts uses).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { focusChild, resultsHref } from '../myExams.ts';
import { isNonTeacherRoute } from '../routeGating.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, '../..', rel), 'utf8');
const school = read('app/(tabs)/school.tsx');
const results = read('app/my-exams.tsx');

// constants/colors.ts imports react-native, so its two schemes are read from its text.
const scheme = (name: 'light' | 'dark') => {
  const src = read('constants/colors.ts');
  const block = src.slice(src.indexOf(`  ${name}: {`));
  const hex = (key: string) => new RegExp(`\\b${key}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(block)?.[1];
  const primary = hex('primary');
  const primaryForeground = hex('primaryForeground');
  assert.ok(primary && primaryForeground, `${name} primary colours found`);
  return { primary, primaryForeground };
};
const light = scheme('light');
const dark = scheme('dark');

describe('resultsHref', () => {
  it('a student, or no child, opens the plain list', () => {
    assert.equal(resultsHref(), '/my-exams');
    assert.equal(resultsHref(null), '/my-exams');
    assert.equal(resultsHref(''), '/my-exams');
  });

  it("a parent's link carries the child key, encoded", () => {
    assert.equal(resultsHref('k1'), '/my-exams?child=k1');
    assert.equal(resultsHref('a&b'), '/my-exams?child=a%26b');
  });

  it('stays a route a parent may open', () => {
    assert.equal(isNonTeacherRoute(resultsHref('k1').split('?')[0]!), true);
  });
});

describe('focusChild', () => {
  const groups = [{ key: 'k-adam' }, { key: 'k-sara' }];

  it('shows only the child it was opened for', () => {
    assert.deepEqual(focusChild(groups, 'k-sara'), { shown: [{ key: 'k-sara' }], focused: true });
  });

  it('shows everyone for no key, or a key that is not one of them', () => {
    assert.deepEqual(focusChild(groups, null), { shown: groups, focused: false });
    assert.deepEqual(focusChild(groups, 'k-gone'), { shown: groups, focused: false }, 'never an empty screen');
  });

  it('offers no «all children» for a parent of one child', () => {
    assert.deepEqual(focusChild([{ key: 'k-sara' }], 'k-sara'), { shown: [{ key: 'k-sara' }], focused: false });
  });
});

describe('«المدرسة» carries the picked child to the results', () => {
  it('opens no results link without the child', () => {
    assert.ok(!school.includes("'/my-exams'"), 'every link goes through resultsHref');
    assert.match(school, /const resultsLink = resultsHref\(isParent \? \(examChild\?\.key \?\? activeKey\) : null\)/);
    assert.match(school, /router\.push\(resultsHref\(isParent \? childKey : null\) as never\)/);
    assert.equal((school.match(/router\.push\(resultsLink as never\)/g) ?? []).length, 3);
  });

  it('the results screen reads the child and can widen back to everyone', () => {
    assert.match(results, /useState<string \| null>\(\(\) => firstParam\(params\.child\) \|\| null\)/);
    assert.match(results, /focusChild\(groups, focusKey\)/);
    assert.match(results, /onPress=\{\(\) => setFocusKey\(null\)\}/);
    assert.match(results, /shown\.map\(\(group, groupIndex\)/);
  });
});

describe("the selected chip's label reads on its fill", () => {
  it('uses the palette foreground, never white', () => {
    assert.ok(!school.includes("'#fff'"), "no hand-written white on «المدرسة»");
    assert.match(school, /color: on \? palette\.primaryForeground : colors\.foreground/);
  });

  it('that foreground clears 4.5:1 on the primary in both schemes', () => {
    for (const p of [light, dark]) assert.ok(contrast(p.primaryForeground, p.primary) >= 4.5, `${p.primaryForeground} on ${p.primary}`);
    assert.ok(contrast('#FFFFFF', dark.primary) < 3, 'white on the dark primary is what this fixes');
  });
});

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
