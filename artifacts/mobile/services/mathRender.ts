/**
 * Parse a slide line into renderable math structure.
 *
 * The projector used to draw equations as flat strings — "3x^2/4" projected
 * with a caret and a slash reads as typing, not mathematics, and Grade 10 is
 * exactly where fractions, powers and roots become the whole lesson. This
 * parser finds those constructs so MathText can draw them properly (stacked
 * fraction bars, raised exponents, a real radical with an overline).
 *
 * Deliberately conservative: anything not confidently recognized stays plain
 * text, rendered exactly as before. A parser that guesses wrong on prose
 * would corrupt every non-math line it touches, so the failure mode here is
 * always "looks like today", never "looks mangled".
 *
 * Pure logic, no React — node:test covers it directly.
 */

export type MathNode =
  | { kind: 'text'; text: string }
  | { kind: 'sup'; base: string; exp: string }
  | { kind: 'frac'; num: MathNode[]; den: MathNode[] }
  | { kind: 'root'; body: MathNode[] };

/** Letters that act as variables in this curriculum: latin plus س ص ع ن. */
const VAR = 'a-zA-Zسصعن';
/** Latin and Arabic-Indic digits — slides may carry either at display time. */
const DIGIT = '0-9٠-٩';

const SIMPLE_TOKEN = new RegExp(`^(?:[${DIGIT}]+(?:[.,][${DIGIT}]+)?|[${VAR}])$`, 'u');
const EXP_TOKEN = new RegExp(`^[+-]?[${DIGIT}${VAR}]+$`, 'u');

/** Match a balanced parenthesized group starting at `i` (must be '('). */
function matchParen(s: string, i: number): string | null {
  if (s[i] !== '(') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++;
    else if (s[j] === ')') {
      depth--;
      if (depth === 0) return s.slice(i + 1, j);
    }
  }
  return null;
}

function isTokenChar(c: string): boolean {
  return new RegExp(`[${DIGIT}${VAR}]`, 'u').test(c);
}

/** Read a maximal digit/letter run ending at position `end` (exclusive). */
function tokenEndingAt(s: string, end: number): string {
  let start = end;
  while (start > 0 && isTokenChar(s[start - 1])) start--;
  return s.slice(start, end);
}

/**
 * The exponent's base in `12x^3` is `x`, not `12x` — a trailing variable
 * letter binds tighter than its coefficient. Only when the run is all digits
 * (`2^10`) does the digit run itself become the base.
 */
function supBaseEndingAt(s: string, end: number): string {
  if (end === 0) return '';
  const last = s[end - 1];
  if (new RegExp(`[${VAR}]`, 'u').test(last)) return last;
  let start = end;
  while (start > 0 && new RegExp(`[${DIGIT}]`, 'u').test(s[start - 1])) start--;
  return s.slice(start, end);
}

function pushText(nodes: MathNode[], buf: string): void {
  if (buf) nodes.push({ kind: 'text', text: buf });
}

/**
 * Parse one line. Returns a flat list of nodes; `frac` and `root` bodies are
 * parsed recursively so `√(x^2 + 1)` nests a superscript under the radical.
 */
export function parseMathLine(line: string): MathNode[] {
  const nodes: MathNode[] = [];
  let buf = '';
  let i = 0;
  const s = line ?? '';

  while (i < s.length) {
    // ── Root: √(...) / sqrt(...) / √25 / √x ──────────────────────────────
    const rootLead = s.startsWith('sqrt', i) ? 4 : (s[i] === '√' ? 1 : 0);
    if (rootLead > 0) {
      let j = i + rootLead;
      while (s[j] === ' ') j++;
      const paren = matchParen(s, j);
      if (paren !== null) {
        pushText(nodes, buf); buf = '';
        nodes.push({ kind: 'root', body: parseMathLine(paren) });
        i = j + paren.length + 2;
        continue;
      }
      // Bare √ before a token: take the whole digit/letter run.
      if (s[i] === '√' && j < s.length && isTokenChar(s[j])) {
        let k = j;
        while (k < s.length && isTokenChar(s[k])) k++;
        pushText(nodes, buf); buf = '';
        nodes.push({ kind: 'root', body: [{ kind: 'text', text: s.slice(j, k) }] });
        i = k;
        continue;
      }
    }

    // ── Parenthesized group followed by ^ or / ────────────────────────────
    if (s[i] === '(') {
      const group = matchParen(s, i);
      if (group !== null) {
        const after = i + group.length + 2;
        if (s[after] === '^') {
          const exp = readExponent(s, after + 1);
          if (exp) {
            pushText(nodes, buf); buf = '';
            nodes.push({ kind: 'sup', base: `(${group})`, exp: exp.text });
            i = exp.end;
            continue;
          }
        }
        if (s[after] === '/') {
          const denParen = matchParen(s, after + 1);
          if (denParen !== null) {
            pushText(nodes, buf); buf = '';
            nodes.push({ kind: 'frac', num: parseMathLine(group), den: parseMathLine(denParen) });
            i = after + denParen.length + 3;
            continue;
          }
        }
        // Plain group — emit as text and move past it, so its contents are
        // not re-scanned for a stray '/' that belongs to prose.
        buf += `(${group})`;
        i = after;
        continue;
      }
    }

    // ── Superscript: token^exp ────────────────────────────────────────────
    if (s[i] === '^' && buf.length > 0) {
      const base = supBaseEndingAt(buf, buf.length);
      if (base) {
        const exp = readExponent(s, i + 1);
        if (exp) {
          const before = buf.slice(0, buf.length - base.length);
          pushText(nodes, before); buf = '';
          nodes.push({ kind: 'sup', base, exp: exp.text });
          i = exp.end;
          continue;
        }
      }
    }

    // ── Simple fraction: token/token (3/4, x/2) ───────────────────────────
    if (s[i] === '/' && buf.length > 0) {
      const num = tokenEndingAt(buf, buf.length);
      if (num && SIMPLE_TOKEN.test(num)) {
        let k = i + 1;
        while (k < s.length && isTokenChar(s[k])) k++;
        const den = s.slice(i + 1, k);
        if (den && SIMPLE_TOKEN.test(den)) {
          const before = buf.slice(0, buf.length - num.length);
          pushText(nodes, before); buf = '';
          nodes.push({
            kind: 'frac',
            num: [{ kind: 'text', text: num }],
            den: [{ kind: 'text', text: den }],
          });
          i = k;
          continue;
        }
      }
    }

    buf += s[i];
    i++;
  }

  pushText(nodes, buf);
  return nodes;
}

/** Match a balanced `{...}` group starting at `i` (must be '{'). */
function matchBrace(s: string, i: number): string | null {
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') {
      depth--;
      if (depth === 0) return s.slice(i + 1, j);
    }
  }
  return null;
}

/**
 * Read an exponent after '^': signed token, parenthesized expression, or the
 * bank's own `{...}` form (`3^{2x}`, `2^{x+3}`). An empty or unclosed brace
 * is not an exponent, so the line stays plain text.
 */
function readExponent(s: string, i: number): { text: string; end: number } | null {
  const paren = matchParen(s, i);
  if (paren !== null) return { text: paren, end: i + paren.length + 2 };
  const brace = matchBrace(s, i);
  if (brace !== null && brace.trim() !== '') return { text: brace.trim(), end: i + brace.length + 2 };
  let k = i;
  if (s[k] === '+' || s[k] === '-') k++;
  let start = k;
  while (k < s.length && isTokenChar(s[k])) k++;
  if (k === start) return null;
  const text = s.slice(i, k);
  return EXP_TOKEN.test(text) ? { text, end: k } : null;
}

/**
 * Does this line READ as Arabic? A leading list marker — «1)», «2.», «(3)»,
 * «-» — is skipped: «1) نكتب 27 بالأساس 3» is an Arabic sentence that happens
 * to start with a digit. Judged on the first letter alone it counted as a
 * left-to-right line and the browser's bidi reordered it.
 */
const ARABIC_LED = /^[\s\d٠-٩().\-–•]*[؀-ۿ]/u;
export function isArabicLed(line: string): boolean {
  return ARABIC_LED.test(line ?? '');
}

/**
 * A line with no Arabic in it that is not maths — a URL, an English credit —
 * reads left to right even inside an Arabic bubble. Laid out right-to-left it
 * reordered: «https:» moved to the end of a link, and a credit's
 * comma-separated parts came out in reverse. Maths is excluded because it has
 * its own layout (`MathParagraph`).
 */
const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/u;
export function isLatinProseLine(line: string): boolean {
  const s = line ?? '';
  return HAS_LATIN.test(s) && !ARABIC_LETTER.test(s) && !hasRenderableMath(s);
}

/** One visual unit of a line: a phrase of prose, or one equation. */
export type LineSegment =
  | { kind: 'prose'; text: string }
  | { kind: 'math'; nodes: MathNode[] };

/**
 * An Arabic phrase: Arabic letters (with the spaces and Arabic commas between
 * them), plus one trailing colon or stop so «المعادلة:» keeps its colon on the
 * Arabic side of the equation instead of leading it.
 */
const ARABIC_PHRASE = /[؀-ۿ](?:[؀-ۿ\s،؛]*[؀-ۿ])?[:،؛؟!]?/gu;

/**
 * Split an Arabic-led line into prose phrases and whole equations.
 *
 * MathText draws such a line with `row-reverse` so the prose reads right to
 * left. Applied node by node that also reversed the pieces of ONE equation —
 * «أوجد حل المعادلة: 3^x = 27» came out as «= 27 | 3ˣ | prose», the equation
 * back to front (seen running the worksheet screen, 2026-10-05). Everything
 * that is not Arabic prose is gathered into a single group here, so the caller
 * can reverse between phrases and equations but keep each equation left to
 * right.
 *
 * A group's edge spaces are trimmed: in a left-to-right group a leading space
 * sits on the wrong side, away from the Arabic it separates from. The caller
 * spaces groups with a margin instead.
 */
export function groupRtlSegments(nodes: MathNode[]): LineSegment[] {
  const segs: LineSegment[] = [];
  const pushMath = (n: MathNode) => {
    const last = segs[segs.length - 1];
    if (last && last.kind === 'math') last.nodes.push(n);
    else segs.push({ kind: 'math', nodes: [n] });
  };

  for (const n of nodes) {
    if (n.kind !== 'text') { pushMath(n); continue; }
    let at = 0;
    for (const m of n.text.matchAll(ARABIC_PHRASE)) {
      const idx = m.index ?? 0;
      if (idx > at) pushMath({ kind: 'text', text: n.text.slice(at, idx) });
      segs.push({ kind: 'prose', text: m[0] });
      at = idx + m[0].length;
    }
    if (at < n.text.length) pushMath({ kind: 'text', text: n.text.slice(at) });
  }

  const out: LineSegment[] = [];
  for (const g of segs) {
    if (g.kind === 'prose') { out.push(g); continue; }
    const ns = g.nodes.slice();
    const first = ns[0];
    if (first && first.kind === 'text') ns[0] = { kind: 'text', text: first.text.replace(/^\s+/, '') };
    const last = ns[ns.length - 1];
    if (last && last.kind === 'text') ns[ns.length - 1] = { kind: 'text', text: last.text.replace(/\s+$/, '') };
    const kept = ns.filter(x => !(x.kind === 'text' && x.text === ''));
    if (kept.length) out.push({ kind: 'math', nodes: kept });
  }
  return out;
}

/**
 * A token that belongs to an equation rather than a sentence: it carries a
 * digit or an operator («32», «=», «2:», «x+1»), or it is a lone variable.
 * «a» and «I» are English words, not variables.
 */
function isMathToken(tok: string): boolean {
  if (/[0-9٠-٩]/.test(tok)) return true;
  if (/^[=+\-×÷<>≤≥≠±:,.()/]+$/.test(tok)) return true;
  return /^[b-hj-zB-HJ-Z]$/.test(tok);
}

/**
 * Split a left-to-right line into prose and whole equations, so a flex-wrap
 * row can break between the two but never inside an equation.
 *
 * `parseMathLine` hands back «Solve the equation: » · 2ˣ · « = 32» — three
 * nodes, and a wrapping row breaks wherever it runs out of width, so on a
 * phone-width projector the exponent sat alone with « = 32» on the next line.
 * The numbers and operators touching a raised exponent, fraction or radical
 * are part of that equation: they are moved into its group, up to the first
 * ordinary word. A pure equation comes back as one group.
 */
export function groupLtrSegments(nodes: MathNode[]): LineSegment[] {
  type Piece = { math: boolean; node: MathNode };
  const pieces: Piece[] = [];

  nodes.forEach((n, k) => {
    if (n.kind !== 'text') { pieces.push({ math: true, node: n }); return; }
    const toks = n.text.match(/\s+|\S+/g) ?? [];
    const isWord = (t: string) => !/^\s+$/.test(t);
    let lo = 0;
    let hi = toks.length;
    if (k > 0 && nodes[k - 1].kind !== 'text') {
      while (lo < hi && (!isWord(toks[lo]) || isMathToken(toks[lo]))) lo++;
    }
    if (k < nodes.length - 1 && nodes[k + 1].kind !== 'text') {
      while (hi > lo && (!isWord(toks[hi - 1]) || isMathToken(toks[hi - 1]))) hi--;
    }
    const head = toks.slice(0, lo).join('');
    const mid = toks.slice(lo, hi).join('');
    const tail = toks.slice(hi).join('');
    if (head) pieces.push({ math: true, node: { kind: 'text', text: head } });
    if (mid) pieces.push({ math: false, node: { kind: 'text', text: mid } });
    if (tail) pieces.push({ math: true, node: { kind: 'text', text: tail } });
  });

  const out: LineSegment[] = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (p.math) {
      if (last && last.kind === 'math') last.nodes.push(p.node);
      else out.push({ kind: 'math', nodes: [p.node] });
    } else {
      const text = (p.node as { text: string }).text;
      if (last && last.kind === 'prose') last.text += text;
      else out.push({ kind: 'prose', text });
    }
  }

  return out
    .map((g): LineSegment => {
      if (g.kind === 'prose') return { kind: 'prose', text: g.text.trim() };
      const ns = g.nodes.slice();
      const first = ns[0];
      if (first && first.kind === 'text') ns[0] = { kind: 'text', text: first.text.replace(/^\s+/, '') };
      const last = ns[ns.length - 1];
      if (last && last.kind === 'text') ns[ns.length - 1] = { kind: 'text', text: last.text.replace(/\s+$/, '') };
      return { kind: 'math', nodes: ns.filter(x => !(x.kind === 'text' && x.text === '')) };
    })
    .filter(g => (g.kind === 'prose' ? g.text !== '' : g.nodes.length > 0));
}

/**
 * Make the spaces around an operator non-breaking, so a plain-text line can
 * wrap between words but not inside «x = 3». Hyphens are left alone — a spaced
 * hyphen is punctuation in prose. For lines with no structured math to group
 * (see `groupLtrSegments`), which is where the projector otherwise drew «x» on
 * one line and «= 3» on the next.
 */
export function bindOperators(line: string): string {
  return (line ?? '').replace(/(\S) ([=+×÷<>≤≥≠≈±−]) (?=\S)/gu, '$1\u00A0$2\u00A0');
}

/**
 * True when the line contains something worth structured rendering — the
 * caller keeps the plain-text path otherwise, so prose never risks re-layout.
 */
export function hasRenderableMath(line: string): boolean {
  return parseMathLine(line).some(n => n.kind !== 'text');
}

/**
 * Wrap runs of Latin letters, digits and math symbols in Unicode
 * directional isolates (LRI `⁦` ... PDI `⁩`) so the platform's own
 * bidi algorithm keeps each run in place instead of reordering it against
 * the surrounding Arabic — "f(x) = 2x + 3" embedded in «إذا كان f(x) = 2x +
 * 3 و g(x) = x²، فإن...» rendered with the equation and the Arabic clauses
 * scrambled relative to each other until this ran, on any plain RN `<Text>`
 * with `writingDirection: 'rtl'`.
 *
 * Deliberately broader than `hasRenderableMath` above: plain function
 * notation like "f(x) = 2x + 3" has no `^`, `/` or `√` for that parser to
 * catch, so a line built entirely from prose plus notation like that never
 * routes to MathText and fell straight through to a bare `<Text>` with no
 * bidi protection at all. This runs on that fallback text instead.
 *
 * A run may contain single interior spaces ("2x + 3") so "2x", "+" and "3"
 * isolate together rather than each getting its own isolate; a run never
 * starts or ends on a space, so it never eats into the Arabic word-spacing
 * around it.
 */
// Subscripts and comparison operators belong to the run for the same reason
// the superscripts do: «قيمة x₁ ≤ 5» split into three isolates renders its
// pieces in three different places. Deliberately excluded: `,` (Arabic prose
// uses the latin comma), and `*` / `_` (markdown emphasis, which would change
// already-shipped chat rendering to no benefit here).
//
// U+2212 `−` is in the class on purpose: the curriculum data writes every minus
// as U+2212, not the ASCII hyphen. With only `-` here «y = 2x−5» was cut at the
// sign, and bidi then reordered the pieces — the worked example
// «x²−7x+12=0» reached the projector as «7x+12=0−x²».
const FOREIGN_CHAR = "A-Za-z0-9(){}=+\\-\\u2212./^√×÷∘′'¹²³⁰⁴-⁹⁺⁻ⁿ₀-₉<>≤≥≠≈±∞";

// Reaction and implication arrows. They may sit INSIDE a run but never at its
// edge. Left out of the run, «N₂ + H₂ → NH₃» became two isolates with the arrow
// stranded between them in the page's RTL flow, and the three pieces laid out
// right to left — the printed equation read «NH₃ → N₂ + H₂», the reverse
// reaction, on every chemistry paper the HTML export produced. Keeping the
// arrow interior-only is deliberate: «Wi-Fi → الإعدادات» has an arrow at the
// edge of a Latin word and Arabic prose, and pulling it into the isolate would
// change layout that was already right.
const FOREIGN_ARROW = '→←↔⇒⇐⇔⇌⇄⟶⟵⟷';

const FOREIGN_RUN_RE = new RegExp(
  `[${FOREIGN_CHAR}](?:[${FOREIGN_CHAR}${FOREIGN_ARROW} ]*[${FOREIGN_CHAR}])?`,
  'g',
);

/**
 * A run only earns an isolate if it could actually be reordered against the
 * Arabic around it: it holds a Latin letter, or a number *and* an operator.
 *
 * Without this test the pass wraps a lone `.` or a bare «ص 45» page number,
 * because `.` and the digits are in the class above. That is not merely
 * useless — it broke the abjad option marker «أ.» into «أ⁦.⁩» and split the
 * page citation, which is how it was caught. A standalone number or a
 * standalone punctuation mark is laid out correctly by the bidi algorithm on
 * its own; only a mixed run of them needs help.
 */
const HAS_LATIN = /[A-Za-z]/;
const HAS_DIGIT = /[0-9₀-₉¹²³⁰⁴-⁹]/;
const HAS_OPERATOR = /[=+\-−/^√×÷∘<>≤≥≠≈±∞]/;

function worthIsolating(run: string): boolean {
  if (HAS_LATIN.test(run)) return true;
  return HAS_DIGIT.test(run) && HAS_OPERATOR.test(run);
}

export function isolateForeignRuns(line: string): string {
  return (line ?? '').replace(FOREIGN_RUN_RE, m => (worthIsolating(m) ? `⁦${m}⁩` : m));
}

/**
 * SymPy prints `3*x**2`; a projector should show `3x²`-style math. Turn the
 * verifier's raw syntax into the notation the parser above renders: `**`
 * becomes `^`, and the explicit `*` between a coefficient and a variable (or
 * a closing paren and an opening one) disappears. A `*` between two numbers
 * is real multiplication and is kept as ×.
 */
export function prettifySymPy(s: string): string {
  return (s ?? '')
    .replace(/\*\*/g, '^')
    .replace(new RegExp(`([${DIGIT}${VAR})])\\s*\\*\\s*(?=[${VAR}(√])`, 'gu'), '$1')
    .replace(/\*/g, '×')
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a math line as static HTML/CSS — same AST as MathText.tsx, but for
 * contexts with no React tree: the printed/PDF export. CSS handles the
 * fraction bar and raised exponent natively, so this needs no measurement
 * tricks the RN version does.
 */
export function mathLineToHtml(line: string): string {
  return parseMathLine(line).map(nodeToHtml).join('');
}

function nodeToHtml(node: MathNode): string {
  if (node.kind === 'text') return escapeHtml(node.text);
  if (node.kind === 'sup') {
    return `${escapeHtml(node.base)}<sup>${escapeHtml(node.exp)}</sup>`;
  }
  if (node.kind === 'frac') {
    const num = node.num.map(nodeToHtml).join('');
    const den = node.den.map(nodeToHtml).join('');
    return `<span class="mfrac"><span class="mfrac-n">${num}</span><span class="mfrac-d">${den}</span></span>`;
  }
  // root
  const body = node.body.map(nodeToHtml).join('');
  return `<span class="mroot">√<span class="mroot-body">${body}</span></span>`;
}

/** Shared with every HTML export that calls mathLineToHtml. */
export const MATH_HTML_STYLES = `
.mfrac { display: inline-flex; flex-direction: column; align-items: center; vertical-align: middle; margin: 0 2px; font-size: 0.85em; }
.mfrac-n, .mfrac-d { line-height: 1.3; }
.mfrac-n { border-bottom: 1.5px solid currentColor; padding: 0 3px 1px; }
.mfrac-d { padding: 1px 3px 0; }
.mroot-body { border-top: 1.5px solid currentColor; padding: 0 2px; margin-inline-start: 1px; }
sup { font-size: 0.62em; }
`;

/** Unicode superscript digits/signs — covers every exponent this curriculum actually uses. */
const SUP_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', 'n': 'ⁿ',
};

/**
 * Plain-text fallback for surfaces with no rich layout at all (PPTX text
 * runs). Numeric/`n` exponents become real Unicode superscripts; anything
 * else keeps its `^exp` notation rather than guess at a shape. Fractions and
 * roots print as `(a)/(b)` and `√(...)` — readable, and the teacher can
 * still reformat it once the file is open in PowerPoint.
 */
export function mathLineToUnicode(line: string): string {
  return parseMathLine(line).map(nodeToUnicode).join('');
}

function nodeToUnicode(node: MathNode): string {
  if (node.kind === 'text') return node.text;
  if (node.kind === 'sup') {
    const supers = [...node.exp].map(c => SUP_MAP[c]);
    const exp = supers.every(Boolean) ? supers.join('') : `^${node.exp}`;
    return `${node.base}${exp}`;
  }
  if (node.kind === 'frac') {
    return `(${node.num.map(nodeToUnicode).join('')})/(${node.den.map(nodeToUnicode).join('')})`;
  }
  return `√(${node.body.map(nodeToUnicode).join('')})`;
}

/**
 * Print exponents the way the question stems already do.
 *
 * The bank keeps maths in a canonical, computer-friendly form — `2^7 = 128`,
 * `5^{10}`, `a^{-2}`, `8^{2/3}` — and its `promptAr` carries the display form,
 * `2³ · 2⁴`. The convention is to convert at display time, and the app does
 * (`parseMathLine`). The HTML export did not, so one printed worksheet mixed
 * both: stems in real superscripts, options and the whole answer key in raw
 * `5^{10}` and `3^6 = 729`, with LaTeX braces leaking into a distractor.
 *
 * Deliberately NOT `mathLineToUnicode`, which also rewrites fractions and would
 * turn a key entry «1/2» into «(1)/(2)». This touches exponents and nothing
 * else. A numeric, `n`, `+` or `-` exponent becomes real superscripts; one that
 * cannot (`2/3`) keeps a plain `^(2/3)` — the same convention the stems use,
 * since no Unicode superscript exists for a slash.
 *
 * Idempotent, and a no-op on text with no caret.
 */
export function normalizeExponents(line: string): string {
  const toSup = (e: string): string | null => {
    const sup = [...e].map(c => SUP_MAP[c]);
    return sup.every(Boolean) ? sup.join('') : null;
  };
  return (line ?? '')
    // ^{...} — braces are LaTeX, never something to print.
    .replace(/\^\{([^{}]+)\}/g, (_m, e: string) => toSup(e) ?? `^(${e})`)
    // ^12, ^-2, ^n — bare exponents. `^(` is left for the fractional case.
    .replace(/\^([+-]?[0-9]+|n)/g, (m, e: string) => toSup(e) ?? m);
}
