/**
 * Elements 1–20 for the Science Lab.
 *
 * Twenty, not 118: that is what the grade 10 electron-configuration lesson
 * works with, and every Arabic name here has to be witnessed in the printed
 * book (`elements.test.ts`). Adding an element means finding its printed
 * spelling first.
 *
 * The configuration is computed from the Aufbau order rather than stored. For
 * Z ≤ 20 there are no exceptions to it (the first is chromium, Z = 24), which
 * is also why this stops at 20 instead of quietly returning a wrong answer for
 * a heavier element.
 */
import raw from './data/elements.json' with { type: 'json' };

export interface Element {
  z: number;
  symbol: string;
  nameAr: string;
  nameEn: string;
  atomicMass: number;
  period: number;
  group: number;
}

export const ELEMENTS: Element[] = raw.elements as Element[];

export function getElement(z: number): Element | undefined {
  return ELEMENTS.find(e => e.z === z);
}

/** Case-sensitive: `Co` is cobalt and `CO` is a molecule, and the parser relies on that. */
export function elementBySymbol(symbol: string): Element | undefined {
  return ELEMENTS.find(e => e.symbol === symbol);
}

const FILL_ORDER = [
  { n: 1, sub: 's', cap: 2 },
  { n: 2, sub: 's', cap: 2 },
  { n: 2, sub: 'p', cap: 6 },
  { n: 3, sub: 's', cap: 2 },
  { n: 3, sub: 'p', cap: 6 },
  { n: 4, sub: 's', cap: 2 },
] as const;

export interface SubshellFill {
  n: number;
  sub: 's' | 'p';
  electrons: number;
}

export function electronConfiguration(z: number): SubshellFill[] {
  if (!Number.isInteger(z) || z < 1 || z > 20) return [];
  const out: SubshellFill[] = [];
  let left = z;
  for (const s of FILL_ORDER) {
    if (left <= 0) break;
    const electrons = Math.min(left, s.cap);
    out.push({ n: s.n, sub: s.sub, electrons });
    left -= electrons;
  }
  return out;
}

/** `"1s2 2s2 2p6 3s1"` — latin, exponents as plain digits. The screen renders them raised. */
export function formatConfiguration(z: number): string {
  return electronConfiguration(z)
    .map(c => `${c.n}${c.sub}${c.electrons}`)
    .join(' ');
}

/** Electrons per principal shell: sodium → `[2, 8, 1]`. */
export function shellCounts(z: number): number[] {
  const counts: number[] = [];
  for (const c of electronConfiguration(z)) {
    counts[c.n - 1] = (counts[c.n - 1] ?? 0) + c.electrons;
  }
  return counts;
}
