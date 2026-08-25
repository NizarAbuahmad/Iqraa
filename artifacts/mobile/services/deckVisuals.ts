/**
 * Deck visuals — one spec, three renderers.
 *
 * The deck has three renderers (live presenter, HTML→PDF, PPTX) and until now
 * only one of them could show a graph: `type: 'graph'` slides carry GeoGebra
 * commands, which are an iframe, so both exports fell back to printing
 * `f(x)=x^2` as text next to a note apologising that the graph is interactive
 * inside the app. The most valuable picture in a maths deck was missing from
 * the file teachers actually put on the projector.
 *
 * **The rule this module exists to enforce:** a visual is *data*, never a live
 * embed. Data can be drawn as SVG, as a native PowerPoint chart, or as
 * react-native-svg. An iframe can only be one of those, so it dies at the
 * export boundary.
 *
 * **The union is open on purpose.** `plot` and `chart` cover mathematics,
 * financial literacy, statistics and physics. Chemistry needs `flow` and
 * `figure`; Arabic and English need annotated text; art needs an exemplar set.
 * Those are not designed here — guessing at them from subjects that do not
 * exist yet would be wrong in expensive ways. Adding a kind must stay additive,
 * which is why every renderer is required to skip kinds it does not know
 * rather than throw: decks generated next year still have to open in an export
 * path written today.
 */

// ─── The block ───────────────────────────────────────────────────────────────

export type PlotSeries = {
  label: string;
  /** Sampled points, already in domain units. */
  points: { x: number; y: number }[];
};

export type VisualBlock =
  | {
      kind: 'plot';
      series: PlotSeries[];
      xLabel?: string;
      yLabel?: string;
      caption?: string;
    }
  | {
      kind: 'chart';
      chartType: 'bar' | 'pie' | 'line';
      categories: string[];
      values: number[];
      caption?: string;
    };

/** Kinds this build can draw. Renderers check this before drawing. */
export const KNOWN_VISUAL_KINDS = ['plot', 'chart'] as const;

export function isRenderableVisual(v: VisualBlock | undefined): v is VisualBlock {
  return !!v && (KNOWN_VISUAL_KINDS as readonly string[]).includes(v.kind);
}

// ─── Expression sampling ─────────────────────────────────────────────────────

/**
 * Evaluate a small arithmetic subset at a point.
 *
 * Deliberately tiny: `+ - * / ^`, parentheses, unary minus, and the implicit
 * multiplication school notation uses (`3x`, `2(x+1)`). It exists to plot the
 * polynomials the Grade 10 books are full of, not to be a computer algebra
 * system — SymPy already plays that role, server-side.
 *
 * Fails closed. Anything it cannot parse returns null and the caller omits the
 * plot, matching how the verifier declines to claim what it cannot prove. A
 * wrong curve on a classroom wall is worse than no curve.
 */
function tokenize(src: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i]!)) n += src[i++]!;
      if ((n.match(/\./g) ?? []).length > 1) return null;
      out.push(n);
      continue;
    }
    if (/[a-zA-Z]/.test(c)) { out.push(c); i++; continue; }
    if ('+-*/^()'.includes(c)) { out.push(c); i++; continue; }
    return null; // anything else — give up rather than guess
  }
  return out;
}

/** Insert the multiplication school notation leaves implicit: 3x → 3*x. */
function withImplicitMultiplication(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1];
    out.push(t);
    if (next === undefined) continue;
    const endsValue = /^[0-9.]+$/.test(t) || /^[a-zA-Z]$/.test(t) || t === ')';
    const startsValue = /^[0-9.]+$/.test(next) || /^[a-zA-Z]$/.test(next) || next === '(';
    if (endsValue && startsValue) out.push('*');
  }
  return out;
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

/** Shunting-yard to RPN. `^` is right-associative, as in maths. */
function toRpn(tokens: string[]): string[] | null {
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t) || /^[a-zA-Z]$/.test(t)) { out.push(t); continue; }
    if (t === '(') { ops.push(t); continue; }
    if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
      if (!ops.length) return null; // unbalanced
      ops.pop();
      continue;
    }
    const p = PRECEDENCE[t];
    if (p === undefined) return null;
    while (ops.length) {
      const top = ops[ops.length - 1]!;
      const tp = PRECEDENCE[top];
      if (tp === undefined) break;
      if (tp > p || (tp === p && t !== '^')) out.push(ops.pop()!);
      else break;
    }
    ops.push(t);
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === '(') return null; // unbalanced
    out.push(op);
  }
  return out;
}

function evalRpn(rpn: string[], variable: string, x: number): number | null {
  const st: number[] = [];
  for (const t of rpn) {
    if (/^[0-9.]+$/.test(t)) { st.push(Number(t)); continue; }
    if (/^[a-zA-Z]$/.test(t)) {
      if (t !== variable) return null; // an unknown symbol is not something to guess at
      st.push(x);
      continue;
    }
    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) return null;
    switch (t) {
      case '+': st.push(a + b); break;
      case '-': st.push(a - b); break;
      case '*': st.push(a * b); break;
      case '/': st.push(b === 0 ? NaN : a / b); break;
      case '^': st.push(Math.pow(a, b)); break;
      default: return null;
    }
  }
  return st.length === 1 ? st[0]! : null;
}

/** Unary minus is rewritten as `0-…` so the RPN stage only sees binary ops. */
function normaliseUnaryMinus(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const prev = out[out.length - 1];
    const isUnary = t === '-' && (prev === undefined || prev === '(' || PRECEDENCE[prev] !== undefined);
    if (isUnary) { out.push('0', '-'); continue; }
    out.push(t);
  }
  return out;
}

export type CompiledExpression = (x: number) => number | null;

/** Compile once, evaluate many — sampling calls this hundreds of times. */
export function compileExpression(src: string, variable = 'x'): CompiledExpression | null {
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return null;
  const rpn = toRpn(withImplicitMultiplication(normaliseUnaryMinus(tokens)));
  if (!rpn) return null;
  // Reject up front rather than at render time: an expression that cannot be
  // evaluated at a sample point is not plottable at all.
  if (evalRpn(rpn, variable, 1) === null) return null;
  return (x: number) => evalRpn(rpn, variable, x);
}

export type SampleOptions = {
  from?: number;
  to?: number;
  steps?: number;
};

/**
 * Sample an expression into points, dropping anything not finite.
 *
 * Asymptotes and negative roots produce Infinity/NaN at some x; those points
 * are omitted rather than clamped, so a hyperbola simply has a gap instead of
 * a vertical line the maths does not contain.
 */
export function samplePlot(
  expression: string,
  { from = -5, to = 5, steps = 80 }: SampleOptions = {},
): { x: number; y: number }[] | null {
  const f = compileExpression(expression);
  if (!f || steps < 2 || !(to > from)) return null;
  const points: { x: number; y: number }[] = [];
  const dx = (to - from) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const x = from + i * dx;
    const y = f(x);
    if (y !== null && Number.isFinite(y)) points.push({ x, y });
  }
  // Two points is a line segment, not a curve — below that there is nothing
  // worth projecting.
  return points.length >= 2 ? points : null;
}

/**
 * Rewrite an equation so the curve it names can be sampled.
 *
 * The textbook does not write its systems as `y = …`. It writes «x − y = 1»,
 * «4y − 8x = −21», «y − x² = 7 − 5x» — general form, y buried in the middle —
 * and until this existed every one of those extracted nothing and drew
 * nothing, which is why a system question could carry a full set of equations
 * and still project a blank slide.
 *
 * **No symbolic algebra.** Anything linear in y is `a(x)·y + b(x) = 0`, so
 * three evaluations of the SAME compiled expression recover it exactly:
 * substitute y = 0, 1, 2 as literals, and
 *
 *     b = E(x, 0)      a = E(x, 1) − E(x, 0)      y = −b / a
 *
 * The third evaluation is the guard, not a spare: `E(x, 2)` must equal
 * `2a + b` or the equation is not linear in y and this must refuse it. That is
 * what stops «x² + y² = 5» being silently mangled into a line — a circle is
 * quadratic in y, fails the check, and returns null instead of a confident
 * wrong curve on a projector.
 */
function solveLinearInY(equation: string): CompiledExpression | null {
  const [lhs, rhs, ...extra] = equation.split('=');
  if (extra.length > 0 || lhs === undefined || rhs === undefined) return null;
  if (!/y/i.test(equation)) return null;

  // E(x, y) = lhs − (rhs). Substituting a literal for y keeps this inside the
  // existing single-variable compiler, which is the whole point: no second
  // evaluator to keep in step with the first.
  const withY = (value: number) =>
    compileExpression(`(${lhs.replace(/y/gi, `(${value})`)})-((${rhs.replace(/y/gi, `(${value})`)}))`);
  const e0 = withY(0);
  const e1 = withY(1);
  const e2 = withY(2);
  if (!e0 || !e1 || !e2) return null;

  const coefficients = (x: number) => {
    const b = e0(x);
    const one = e1(x);
    const two = e2(x);
    if (b === null || one === null || two === null) return null;
    if (!Number.isFinite(b) || !Number.isFinite(one) || !Number.isFinite(two)) return null;
    const a = one - b;
    // Linearity, checked at this very x rather than assumed from a sample
    // elsewhere: 2a + b is what E(x, 2) must be.
    const scale = Math.max(1, Math.abs(two), Math.abs(b), Math.abs(a));
    if (Math.abs(two - (2 * a + b)) > 1e-9 * scale) return null;
    return { a, b };
  };

  // A curve that is not linear in y anywhere is not this function's business.
  // Probed at several x rather than one: `xy = 1` is linear in y everywhere,
  // while a quadratic can coincidentally satisfy the check at a single point.
  const probes = [-2.3, -0.7, 0.9, 2.6];
  if (!probes.every(x => coefficients(x) !== null)) return null;

  return (x: number) => {
    const c = coefficients(x);
    // `a === 0` is a vertical line (x = 3): a real curve, but not one y = f(x)
    // can express, so the point is dropped rather than sent to Infinity.
    if (!c || c.a === 0) return null;
    const y = -c.b / c.a;
    // Negating a zero intercept yields -0, which plots identically but is not
    // `Object.is`-equal to 0 — a surprise waiting in any caller that compares.
    return y === 0 ? 0 : y;
  };
}

/**
 * The y-value function a plot command names, however the equation is written.
 *
 * Explicit definitions keep the existing string path so `samplePlot` and its
 * tests are untouched; everything else goes through the linear-in-y solver
 * above. Returns null for anything this build cannot draw — a circle, a
 * vertical line, prose — so the caller shows nothing rather than something
 * wrong.
 */
export function curveFromCommand(command: string): CompiledExpression | null {
  const explicit = expressionFromCommand(command);
  if (explicit) return compileExpression(explicit);
  const normalised = command
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .trim();
  if (!/x/i.test(normalised)) return null;
  return solveLinearInY(normalised);
}

/** `samplePlot`, for a curve already compiled rather than named by a string. */
export function sampleCurve(
  f: CompiledExpression,
  { from = -5, to = 5, steps = 80 }: SampleOptions = {},
): { x: number; y: number }[] | null {
  if (steps < 2 || !(to > from)) return null;
  const points: { x: number; y: number }[] = [];
  const dx = (to - from) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    const x = from + i * dx;
    const y = f(x);
    if (y !== null && Number.isFinite(y)) points.push({ x, y });
  }
  return points.length >= 2 ? points : null;
}

/**
 * `f(x)=x^2-5x+6` / `y = 2x + 1` → the right-hand side.
 * Returns null for anything that is not a single-variable definition, so a
 * GeoGebra command this module cannot plot simply produces no visual.
 */
export function expressionFromCommand(command: string): string | null {
  const normalised = command
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .trim();
  // f, g and h as well as y: extractGraphCommands emits all four, and a
  // second curve on the same axes (`g(x)=x+1` beside `f(x)=x^2`) is exactly
  // the comparison a teacher draws by hand.
  const m = normalised.match(/^(?:[fgh]\s*\(\s*x\s*\)|y)\s*=\s*(.+)$/i);
  const body = (m?.[1] ?? '').trim();
  if (!body || !/x/i.test(body)) return null;
  return compileExpression(body) ? body : null;
}

// ─── Shared geometry ─────────────────────────────────────────────────────────
// Computed once here so the SVG, the PowerPoint chart and the on-screen
// presenter cannot drift into drawing subtly different pictures.

export type PlotGeometry = {
  width: number;
  height: number;
  /** Series mapped into pixel space, ready to become a polyline or path. */
  series: { label: string; points: { x: number; y: number }[] }[];
  /** Pixel position of the axes, when zero falls inside the visible range. */
  axisX: number | null;
  axisY: number | null;
  domain: { minX: number; maxX: number; minY: number; maxY: number };
};

export function plotGeometry(
  block: Extract<VisualBlock, { kind: 'plot' }>,
  width: number,
  height: number,
  padding = 28,
): PlotGeometry | null {
  const all = block.series.flatMap(s => s.points);
  if (all.length < 2) return null;

  const xs = all.map(p => p.x);
  const ys = all.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  // A flat line would divide by zero and collapse to the top edge.
  if (maxY - minY < 1e-9) { minY -= 1; maxY += 1; }

  const w = width - padding * 2;
  const h = height - padding * 2;
  const toPx = (p: { x: number; y: number }) => ({
    x: padding + ((p.x - minX) / (maxX - minX)) * w,
    // SVG y grows downward; maths does not.
    y: padding + h - ((p.y - minY) / (maxY - minY)) * h,
  });

  return {
    width,
    height,
    series: block.series.map(s => ({ label: s.label, points: s.points.map(toPx) })),
    axisY: minX <= 0 && maxX >= 0 ? padding + ((0 - minX) / (maxX - minX)) * w : null,
    axisX: minY <= 0 && maxY >= 0 ? padding + h - ((0 - minY) / (maxY - minY)) * h : null,
    domain: { minX, maxX, minY, maxY },
  };
}

// ─── SVG ─────────────────────────────────────────────────────────────────────
// The HTML/PDF renderer. Inline SVG rather than an <img>, so the curve is
// vector-sharp when a teacher prints the deck or projects the PDF, and so
// there is no asset to fetch and race (the reason hero images were missing
// from exports until the load wait was added to share.ts).

const SERIES_COLORS = ['#1B6B62', '#C2410C', '#4F46E5', '#B91C1C'];

function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function num(n: number): string {
  // Two decimals keeps the markup readable and well under any precision that
  // matters at projector resolution.
  return Number.isFinite(n) ? n.toFixed(2) : '0';
}

/**
 * A chart's bars/slices as SVG. Categorical data has no shared geometry with a
 * plot, so it is laid out here rather than through plotGeometry.
 */
function chartSvg(block: Extract<VisualBlock, { kind: 'chart' }>, width: number, height: number): string {
  const { categories, values } = block;
  if (!categories.length || categories.length !== values.length) return '';
  const pad = 30;
  const w = width - pad * 2;
  const h = height - pad * 2;

  if (block.chartType === 'pie') {
    const total = values.reduce((s, v) => s + Math.max(0, v), 0);
    if (total <= 0) return '';
    const r = Math.min(w, h) / 2;
    const cx = width / 2;
    const cy = height / 2;
    let angle = -Math.PI / 2;
    const slices = values.map((v, i) => {
      const sweep = (Math.max(0, v) / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      angle += sweep;
      const x2 = cx + r * Math.cos(angle);
      const y2 = cy + r * Math.sin(angle);
      const large = sweep > Math.PI ? 1 : 0;
      const fill = SERIES_COLORS[i % SERIES_COLORS.length]!;
      return `<path d="M ${num(cx)} ${num(cy)} L ${num(x1)} ${num(y1)} A ${num(r)} ${num(r)} 0 ${large} 1 ${num(x2)} ${num(y2)} Z" fill="${fill}" opacity="0.9"/>`;
    });
    return slices.join('');
  }

  const max = Math.max(...values, 0);
  if (max <= 0) return '';
  const slot = w / categories.length;
  const barW = slot * 0.6;
  return values
    .map((v, i) => {
      const bh = (Math.max(0, v) / max) * h;
      const x = pad + i * slot + (slot - barW) / 2;
      const y = pad + h - bh;
      const fill = SERIES_COLORS[i % SERIES_COLORS.length]!;
      return `<rect x="${num(x)}" y="${num(y)}" width="${num(barW)}" height="${num(bh)}" fill="${fill}" rx="3"/>`
        + `<text x="${num(x + barW / 2)}" y="${num(height - 10)}" font-size="11" text-anchor="middle" fill="#6B7280">${esc(categories[i]!)}</text>`;
    })
    .join('');
}

/**
 * Render a visual block to a standalone SVG string.
 *
 * Returns '' for a kind this build does not know, so an older export path
 * silently omits a future block rather than throwing on a deck it did not
 * expect. That degradation is the contract that keeps the union open.
 */
export function visualToSvg(block: VisualBlock, width = 640, height = 340): string {
  if (!isRenderableVisual(block)) return '';
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img">`;

  if (block.kind === 'chart') {
    const body = chartSvg(block, width, height);
    return body ? `${open}${body}</svg>` : '';
  }

  const g = plotGeometry(block, width, height);
  if (!g) return '';

  const axes = [
    g.axisX !== null
      ? `<line x1="0" y1="${num(g.axisX)}" x2="${width}" y2="${num(g.axisX)}" stroke="#9CA3AF" stroke-width="1"/>`
      : '',
    g.axisY !== null
      ? `<line x1="${num(g.axisY)}" y1="0" x2="${num(g.axisY)}" y2="${height}" stroke="#9CA3AF" stroke-width="1"/>`
      : '',
  ].join('');

  const curves = g.series
    .map((s, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length]!;
      const d = s.points.map(p => `${num(p.x)},${num(p.y)}`).join(' ');
      return `<polyline points="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join('');

  const legend = g.series.length > 1
    ? g.series
        .map((s, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length]!;
          return `<text x="12" y="${18 + i * 16}" font-size="12" fill="${color}">${esc(s.label)}</text>`;
        })
        .join('')
    : '';

  return `${open}${axes}${curves}${legend}</svg>`;
}

// ─── Slide → visual ──────────────────────────────────────────────────────────

/** Structural, so this module stays free of the deck's own imports. */
export type VisualSource = {
  type?: string;
  graphCommands?: string[] | undefined;
  visual?: VisualBlock | undefined;
};

/**
 * The visual a slide should draw, if any.
 *
 * Deriving this at render time rather than baking it into the deck means decks
 * teachers saved *before* this existed gain their plots too: a `graph` slide
 * has always carried its GeoGebra commands, and those are enough to sample a
 * curve from. An explicit `visual` wins when the generator supplied one.
 *
 * Returns null when nothing can be drawn honestly — a GeoGebra command outside
 * the plottable subset (`Circle(...)`, a trig function) produces no picture
 * rather than a wrong one.
 */
export function visualForSlide(slide: VisualSource): VisualBlock | null {
  if (isRenderableVisual(slide.visual)) return slide.visual;

  const commands = slide.graphCommands ?? [];
  if (!commands.length) return null;

  const series: PlotSeries[] = [];
  for (const command of commands) {
    const curve = curveFromCommand(command);
    if (!curve) continue;
    const points = sampleCurve(curve);
    if (points) series.push({ label: command, points });
  }
  return series.length ? { kind: 'plot', series } : null;
}

// ─── Chart extraction ────────────────────────────────────────────────────────

/** More than this and the bars are too thin to read from the back row. */
const MAX_CATEGORIES = 8;
/** Fewer than this is a sentence containing a number, not a dataset. */
const MIN_CATEGORIES = 3;

/**
 * Pull labelled quantities out of lesson prose — a budget split, a set of
 * percentages — so financial-literacy and statistics lessons get a chart.
 *
 * **The hard part is not finding numbers, it is refusing them.** A statistics
 * lesson says «أوجد المتوسط الحسابي للبيانات: 2، 4، 6، 8»; charting that would
 * produce four unlabelled bars that mean nothing. A worked example says «بعد 3
 * سنوات». Both contain numbers and neither is a dataset.
 *
 * So every value must carry its own text label, and there must be at least
 * three of them. Everything else returns null and the deck simply has no
 * chart — the same fail-closed posture the sampler and the verifier take. A
 * chart is a claim about data; an invented one is worse than none.
 */
export function extractChartData(
  text: string,
): { categories: string[]; values: number[] } | null {
  if (!text) return null;

  const categories: string[] = [];
  const values: number[] = [];
  const seen = new Set<string>();

  // Arabic comma, Latin comma, newline and bullets all separate items in the
  // books; '.' does not, because it ends sentences and appears in decimals.
  for (const raw of text.split(/[،,\n•]/)) {
    // Drop an intro phrase: «وزّع الدخل كالآتي: السكن 200» carries its first
    // item behind a colon, and without this that item is silently lost —
    // which also skews a percentage split away from summing to 100.
    const segment = raw.replace(/^[^:：]*[:：]\s*/, '').trim();
    if (!segment) continue;

    // label  then  number  then an optional unit (%, دينار, JD).
    const m = segment.match(
      /^(?:[-–—]\s*)?([\p{L}][\p{L}\sً-ْ]{1,29}?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:%|٪|دينار|د\.?أ\.?|JOD|JD)?\.?$/u,
    );
    if (!m) continue;

    const label = m[1]!.trim();
    const value = Number(m[2]!.replace(',', '.'));
    // A label that is itself a number word would come through the letter class
    // above; a non-finite or non-positive value has nothing to draw.
    if (!Number.isFinite(value) || value <= 0) continue;
    if (label.length < 2) continue;
    // Repeated labels mean the pattern matched something that is not a
    // breakdown — two bars called the same thing cannot both be right.
    const key = label.replace(/\s+/g, ' ');
    if (seen.has(key)) return null;
    seen.add(key);

    categories.push(label);
    values.push(value);
    if (categories.length > MAX_CATEGORIES) return null;
  }

  return categories.length >= MIN_CATEGORIES ? { categories, values } : null;
}

/**
 * A chart block for a lesson, when its text unambiguously contains one.
 *
 * Percentages become a pie because they are parts of a whole; anything else
 * becomes bars. Returns null far more often than not, which is the point.
 */
export function chartForLesson(text: string, caption?: string): VisualBlock | null {
  const data = extractChartData(text);
  if (!data) return null;
  const looksLikeShares =
    /[%٪]/.test(text) && Math.abs(data.values.reduce((s, v) => s + v, 0) - 100) < 2;
  return {
    kind: 'chart',
    chartType: looksLikeShares ? 'pie' : 'bar',
    categories: data.categories,
    values: data.values,
    ...(caption ? { caption } : {}),
  };
}
