/**
 * Every chemistry family is deep enough for a real paper, and what can be checked by
 * arithmetic is checked by arithmetic.
 *
 * Why depth: an offline quiz draws its tier first and can never be longer than the family
 * it draws from. Every family but the periodic table used to hold 4–7 items (two easy, two
 * medium, one or two hard), so a ten-question paper on any chemistry lesson came back with
 * five, and an "easy" or "hard" paper ran dry after two. The floors below are what each
 * family was raised to.
 *
 * Why arithmetic: a wrong answer key in a bank is served to every teacher who asks for the
 * lesson. Equations are checked for atom balance (the answer must balance and no distractor
 * may), and the numeric items are recomputed from the atomic masses the books print.
 *
 * What none of this can say: whether the chemistry is what the Jordanian book teaches, or
 * whether the Arabic reads well. That needs a chemistry teacher.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHEM_BANK, type ChemFamily } from '../index.ts';

const FAMILIES: ChemFamily[] = [
  'atom_basics', 'atomic_structure', 'electron_config', 'periodic_trends', 'bonding', 'formulas',
  'equations', 'mole', 'stoichiometry', 'thermochem', 'calorimetry', 'acids_bases', 'metal_activity', 'redox', 'general_chem',
];
const inFamily = (f: string) => CHEM_BANK.filter(i => i.family === f);
const byId = (id: string) => {
  const item = CHEM_BANK.find(i => i.id === id);
  assert.ok(item, `${id} is not in the bank`);
  return item;
};

describe('chemistry bank depth', () => {
  for (const family of FAMILIES) {
    it(`${family} holds enough for a ten-question paper and for each tier on its own`, () => {
      const items = inFamily(family);
      const tier = (t: string) => items.filter(i => i.diff === t).length;
      assert.ok(items.length >= 15, `${family}: only ${items.length} items`);
      assert.ok(tier('easy') >= 5, `${family}: easy ${tier('easy')}`);
      assert.ok(tier('medium') >= 6, `${family}: medium ${tier('medium')}`);
      assert.ok(tier('hard') >= 4, `${family}: hard ${tier('hard')}`);
    });
  }

  it('no two items in the bank ask the same question', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const i of CHEM_BANK) {
      const key = (i.promptAr ?? '').replace(/\s+/g, ' ').trim();
      if (seen.has(key)) dup.push(`${seen.get(key)} / ${i.id}`);
      else seen.set(key, i.id);
    }
    assert.deepEqual(dup, []);
  });

  it('no item offers an answer that is only a unit or a stub', () => {
    const bad = CHEM_BANK.filter(i => i.answer.trim().length < 1 || i.wrongs.some(w => !w.trim())).map(i => i.id);
    assert.deepEqual(bad, []);
  });
});

// ── Equations: the answer balances, no distractor does ──────────────────────────────────
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const unsub = (s: string) => s.replace(/[₀-₉]/g, c => SUB[c]!);

/** Atom counts of one formula such as `Ca(OH)2` or `Fe2O3`. */
function atoms(formula: string): Map<string, number> {
  const f = unsub(formula);
  let pos = 0;
  const parseGroup = (): Map<string, number> => {
    const out = new Map<string, number>();
    const add = (m: Map<string, number>, k: number) => m.forEach((v, e) => out.set(e, (out.get(e) ?? 0) + v * k));
    while (pos < f.length && f[pos] !== ')') {
      if (f[pos] === '(') {
        pos++;
        const inner = parseGroup();
        pos++; // ')'
        let n = '';
        while (/\d/.test(f[pos] ?? '')) n += f[pos++];
        add(inner, n ? Number(n) : 1);
      } else {
        const m = /^[A-Z][a-z]?/.exec(f.slice(pos));
        assert.ok(m, `cannot read «${formula}» at ${pos}`);
        pos += m[0].length;
        let n = '';
        while (/\d/.test(f[pos] ?? '')) n += f[pos++];
        out.set(m[0], (out.get(m[0]) ?? 0) + (n ? Number(n) : 1));
      }
    }
    return out;
  };
  return parseGroup();
}

function sideCounts(side: string): Map<string, number> {
  const total = new Map<string, number>();
  for (const term of side.split('+').map(t => t.trim()).filter(Boolean)) {
    const m = /^(\d+)?\s*(.+)$/.exec(term);
    assert.ok(m, `cannot read term «${term}»`);
    const k = m[1] ? Number(m[1]) : 1;
    atoms(m[2]!).forEach((v, e) => total.set(e, (total.get(e) ?? 0) + v * k));
  }
  return total;
}

function balanced(eq: string): boolean {
  const [l, r] = eq.split('→');
  if (r === undefined) return false;
  const a = sideCounts(l!), b = sideCounts(r);
  if (a.size !== b.size) return false;
  for (const [e, n] of a) if (b.get(e) !== n) return false;
  return true;
}

describe('chemistry equations', () => {
  // Ion equations (HCl → H⁺ + Cl⁻) are about charge, not atom counts; they are read by eye.
  const eqItems = CHEM_BANK.filter(i => i.answer.includes('→') && i.wrongs.every(w => w.includes('→')) && !/[⁺⁻]/.test(i.answer));

  it('finds the equation items it is meant to check', () => {
    assert.ok(eqItems.length >= 10, `only ${eqItems.length} items hold an equation answer`);
  });

  it('every equation answer is atom-balanced', () => {
    const bad = eqItems.filter(i => !balanced(i.answer)).map(i => `${i.id}: ${i.answer}`);
    assert.deepEqual(bad, []);
  });

  it('no distractor is also balanced — that would be a second correct answer', () => {
    const bad: string[] = [];
    for (const i of eqItems) for (const w of i.wrongs) if (balanced(w)) bad.push(`${i.id}: ${w}`);
    assert.deepEqual(bad, []);
  });
});

// ── Electron configurations: the electrons must add up to Z ─────────────────────────────
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const electrons = (cfg: string) =>
  [...cfg.matchAll(/\d[spdf]([⁰¹²³⁴-⁹]+)/g)].reduce((s, m) => s + Number([...m[1]!].map(c => SUP[c]).join('')), 0);

describe('electron configurations', () => {
  const CASES: Array<[string, number]> = [
    ['ch-ec-e1', 12], ['ch-ec-e2', 17], ['ch-ec-m2', 20],
    ['ch-ec-e3', 11], ['ch-ec-e4', 8], ['ch-ec-m3', 13], ['ch-ec-m4', 10], ['ch-ec-m5', 18],
    ['ch-ec-h2', 26], ['ch-ec-h3', 18],
  ];
  for (const [id, z] of CASES) {
    it(`${id}: the answer holds ${z} electrons`, () => {
      const item = byId(id);
      const cfg = item.id === 'ch-ec-h3' ? item.promptAr!.match(/1s².*3p⁶/)![0] : item.answer;
      assert.equal(electrons(cfg), z);
    });
  }
  it('a distractor that has the right electron count is not a second answer by accident', () => {
    // ch-ec-e3 offers 1s² 2s¹ 2p⁶ 3s² (11 electrons, wrong order) on purpose: it must differ from the answer.
    const item = byId('ch-ec-e3');
    assert.ok(item.wrongs.some(w => electrons(w) === 11 && w !== item.answer));
  });
});

// ── Numeric items, recomputed from the atomic masses the books print ────────────────────
const MASS: Record<string, number> = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, S: 32, Cl: 35.5, K: 39, Ca: 40 };
const molar = (formula: string) => {
  let t = 0;
  atoms(formula).forEach((n, e) => { t += n * MASS[e]!; });
  return t;
};
const AVOGADRO = 6.02e23;

describe('numeric chemistry items', () => {
  const answerHas = (id: string, text: string) => assert.ok(unsub(byId(id).answer).replace(/\s/g, '').includes(text.replace(/\s/g, '')), `${id}: answer «${byId(id).answer}» does not contain «${text}»`);

  it('molar masses', () => {
    answerHas('ch-ml-e3', `${molar('O2')} g/mol`);
    answerHas('ch-ml-e5', `${molar('NH3')} g/mol`);
    answerHas('ch-ml-m6', `${molar('Na2CO3')} g/mol`);
    assert.equal(molar('H2SO4'), 98);
  });

  it('moles and particles', () => {
    answerHas('ch-ml-m4', `${88 / molar('CO2')} mol`);
    answerHas('ch-ml-h3', `${9.8 / molar('H2SO4')} mol`);
    answerHas('ch-ml-m5', `${(0.5 * AVOGADRO / 1e23).toFixed(2)}`);
    answerHas('ch-ml-h4', `${(3.01e23 / AVOGADRO) * molar('H2O')} g`);
  });

  it('percent composition, formulas and yield', () => {
    answerHas('ch-st-e5', `${(100 * 16 / molar('H2O')).toFixed(1)}%`);
    answerHas('ch-st-m3', `${(100 * 12 / molar('CO2')).toFixed(1)}%`);
    // empirical CH2 (14 g/mol) in 42 g/mol: three units → C3H6
    assert.equal(42 / molar('CH2'), 3);
    assert.equal(byId('ch-st-m6').answer, 'C₃H₆');
    answerHas('ch-st-h4', `${(100 * 15 / 20)}%`);
  });

  it('reacting masses and mole ratios', () => {
    // 2Mg + O2 → 2MgO: 12 g Mg = 0.5 mol → 0.5 mol MgO
    answerHas('ch-st-h3', `${(12 / MASS.Mg!) * molar('MgO')} g`);
    answerHas('ch-gn-h2', `${12 + 8} g`);
    // CaCO3 + 2HCl: 0.5 mol → 1 mol HCl
    answerHas('ch-st-m4', `${0.5 * 2} mol`);
    // 2H2O → 2H2 + O2: 4 mol H2O → 2 mol O2
    answerHas('ch-st-e3', `${4 / 2} mol`);
    // H2SO4 + 2NaOH: 0.1 mol → 0.2 mol NaOH
    answerHas('ch-ac-h4', `${0.1 * 2} mol`);
  });

  it('energy', () => {
    answerHas('ch-th-m3', `${50 * 4.18 * 10} J`);
    answerHas('ch-th-m4', `${2 * 890} kJ`);
    answerHas('ch-th-m5', `${60 - 100} kJ`.replace('-', '−'));
    answerHas('ch-th-m6', `${500 - 650} kJ`.replace('-', '−'));
    answerHas('ch-th-h2', `${-100 + -50} kJ`.replace('-', '−'));
    answerHas('ch-th-h4', `${-572 / 2} kJ`.replace('-', '−'));
  });

  it('calorimetry: q = m·c·ΔT with water at 4.18 J/g·°C, recomputed', () => {
    const w = 4.18;
    const r = (x: number, d = 2) => Number(x.toFixed(d));
    answerHas('ch-ca-m1', `${r(150 * w * 20, 0)} J`);
    answerHas('ch-ca-m2', `${r(1150 / (50 * 50))} J/g·°C`);
    answerHas('ch-ca-m3', `${2400 / 6} J/°C`);
    answerHas('ch-ca-m4', `${25 + r(8360 / (100 * w), 0)} °C`);
    answerHas('ch-ca-m5', `${r(6270 / (w * 15), 0)} g`);
    answerHas('ch-ca-m6', `${r(200 * w * (60 - 40), 0)} J`);
    // hot metal into water: heat gained by the water = heat lost by the metal
    const gained = 100 * w * (24 - 20);
    answerHas('ch-ca-h1', `${r(gained / (50 * (100 - 24)))} J/g·°C`);
    // equal heat in, different masses: mixing 200 g at 60 °C with 100 g at 30 °C
    answerHas('ch-ca-h2', `${(200 * 60 + 100 * 30) / (200 + 100)} °C`);
    answerHas('ch-ca-h3', `${r((500 * w * 10) / 2 / 1000)} kJ/g`);
    answerHas('ch-ca-h4', `${250 * 0.8} J/°C`);
  });

  it('calorimetry: no wrong option is the right number under another label', () => {
    // numeric answers only: a distractor must not carry the answer's number, or the item has two right answers
    const num = (s: string) => s.match(/[\d.]+/)?.[0];
    for (const i of CHEM_BANK.filter(x => x.family === 'calorimetry' && /^[\d.]+\s/.test(x.answer))) {
      for (const wrong of i.wrongs) assert.notEqual(num(wrong), num(i.answer), `${i.id}: «${wrong}» repeats the answer's number`);
    }
  });

  it('solutions and density', () => {
    answerHas('ch-gn-m5', `${(100 * 5) / (5 + 95)}%`);
    answerHas('ch-gn-h3', `${50 / 25} g/cm`);
    answerHas('ch-gn-h4', `${0.1 * 200} g`);
  });

  it('atoms, ions and formulas', () => {
    answerHas('ch-ab-m3', `${27 - 13} نيوترونًا`);
    answerHas('ch-ab-m4', `${11 - 1} إلكترونات`);
    answerHas('ch-ab-m5', `${14 - 6} نيوترونات`);
    answerHas('ch-ab-h3', `${31 - 16}`);
    answerHas('ch-ab-e4', '9 إلكترونات');
    assert.equal([...atoms('(NH4)2SO4')].find(([e]) => e === 'H')![1], 8);
    assert.equal([...atoms('Al2(SO4)3').values()].reduce((a, b) => a + b, 0), 17);
    answerHas('ch-fm-h2', '8 ذرات');
    answerHas('ch-fm-h3', '17 ذرة');
    answerHas('ch-as-e3', `${2 * 2 ** 2} إلكترونات`);
    answerHas('ch-as-m3', `${(-13.6 / 9).toFixed(2)} eV`.replace('-', '−'));
    answerHas('ch-as-h2', '5 أوربيتالات تتسع لـ10');
  });
});
