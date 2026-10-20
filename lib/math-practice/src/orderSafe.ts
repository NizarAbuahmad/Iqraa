/**
 * The solved items «رتّب» may draw — hand-audited (2026-10-11).
 *
 * «رتّب» shuffles an item's working, pins the last line (the result), and
 * marks one order right; the converter marks it automatically. That is only
 * fair when the remaining steps have exactly ONE valid order — each step uses
 * what the step before it introduced. Many items do not: two facts that can be
 * stated either way round (the formula and the givens, h and k, the two
 * quadrants), and a student who swaps them is marked wrong.
 *
 * So this is an allowlist, not a blocklist: an item is here only when a person
 * read its working (`steps-*.ts`) and found each step depending on the one
 * before it. When in doubt it was left out — an unlisted item just never
 * becomes «رتّب»; it still serves every other use. A new solved item is
 * unlisted until someone audits it. `orderSafe.test.ts` checks every id.
 *
 * Audited: every solved item with 3–6 steps — 92 maths, 72 chemistry.
 * Listed: 65 maths, 13 chemistry.
 */
export const ORDER_SAFE: ReadonlySet<string> = new Set([
  // ── exp_eq: base → substitute → equate → solve, each line feeds the next ──
  'exp-e1', 'exp-e2', 'exp-e3', 'exp-e4', 'exp-e5', 'exp-e6',
  'exp-m1', 'exp-m2', 'exp-m3', 'exp-m4', 'exp-m5', 'exp-m6',
  'exp-h1', // bases → x = 2y → substitute → y → x
  'exp-h2', // bases → x = 2y → substitute → y and x
  'exp-h3', // bases → power of a power → equate → expand
  'exp-h4', // split the power → rewrite → subtract → divide
  'exp-h5', // 32N₀ → divide by N₀ → base 2

  // ── system_graph: set equal → rearrange → factor → roots → y ──
  // out: g-e1, g-e2 (the «check» line can be read as the y-substitution),
  //      g-m2 («y = 0 in both cases» can sit anywhere after the first line)
  'g-m1', 'g-m3', 'g-h1', 'g-h2', 'g-h3',

  // ── linear_quad ──
  // out: lq-e2 («y is fixed» can sit anywhere)
  'lq-e1', 'lq-m1', 'lq-m2', 'lq-h1', 'lq-h2',

  // ── quad_system ──
  // out: qq-e1 («y is fixed» can sit anywhere)
  'qq-m1', 'qq-m2', 'qq-h1',

  // ── simplify_exp ──
  // out: se-m3, se-h2 (numerator and «divisor as a power» are independent),
  //      se-h1 (16^{3/4} and 8^{1/3} are independent)
  'se-e1', 'se-e2', 'se-e3', 'se-m1', 'se-m2',

  // ── circle: formula → substitute → evaluate ──
  // out: c-m1 (h, k, r in any order), c-h1 (the halves can be found before grouping)
  'c-e1', 'c-e2', 'c-m2',

  // ── trig ──
  // out: t-e3 (drawing vs the definition of tan), t-m1 and t-h1 (reference
  //      angle vs the quadrants where the ratio is positive)
  't-e1', 't-e2', 't-m2',

  // ── trig_apps: rule → substitute → evaluate ──
  'ta-e1', 'ta-m1', 'ta-h1',

  // ── functions ──
  // out: f-m1 (the definition of f∘g and evaluating g(2) can swap)
  'f-e1', 'f-e2', 'f-m2', 'f-h1',

  // ── sequences ──
  // out: q-e2 (the check can come first), q-m1 and q-m3 (d vs the formula),
  //      q-m2 (the check vs the next term)
  'q-e1', 'q-h1', 'q-h2',

  // ── derivative ──
  // out: d-m1 (the two terms), d-m2 and d-h1 (the definition vs differentiating)
  'd-e1', 'd-e2',

  // ── vectors ──
  // out: v-h1 (the criterion vs computing the dot product)
  'v-e1', 'v-e2', 'v-m2',

  // ── stats ──
  // out: s-e1 and s-e2 (the formula vs the counts), s-m1 (ordering vs counting)
  's-m2', 's-h1',

  // ── algebra ──
  // out: a-m2 (√49 = 7 can come first), a-h1 (the formula vs a, b, c)
  'a-e1', 'a-e2', 'a-e3', 'a-m1', 'a-m3', 'a-h2', 'a-h3',

  // ── chemistry: most items are reasons that can be given in either order ──
  // (definition and fact, formula and givens). Families with none listed:
  // atom_basics, atomic_structure, electron_config, periodic_trends, mole,
  // acids_bases, redox, general_chem.
  'ch-bd-m1', // sharing → pair drawn to O → polar
  'ch-fm-m1', // charges → LCM 6 → counts → check
  'ch-fm-m2', // charges → LCM 6 → counts → check
  'ch-eq-e1', // count → 2H₂O → then 2H₂ → check
  'ch-eq-m1', // count → 2NH₃ → then 3H₂ → check
  'ch-eq-h1', // LCM of O → 3O₂, 2Fe₂O₃ → then 4Fe → check
  'ch-st-e1', // equation → ratio → moles
  'ch-st-m1', // equation → ratio → expression → value
  'ch-st-m2', // equation → ratio → expression → value
  'ch-st-h2', // ratio → O₂ needed → limiting → product
  'ch-th-e1', // ΔH definition → negative so less → released
  'ch-th-h1', // ΔH = +180 → positive so more → absorbs
  'ch-ma-e1', // rule → Zn displaces Cu → ZnSO₄ + Cu
]);
