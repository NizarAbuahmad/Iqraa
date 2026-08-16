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

/** Read an exponent after '^': signed token or parenthesized expression. */
function readExponent(s: string, i: number): { text: string; end: number } | null {
  const paren = matchParen(s, i);
  if (paren !== null) return { text: paren, end: i + paren.length + 2 };
  let k = i;
  if (s[k] === '+' || s[k] === '-') k++;
  let start = k;
  while (k < s.length && isTokenChar(s[k])) k++;
  if (k === start) return null;
  const text = s.slice(i, k);
  return EXP_TOKEN.test(text) ? { text, end: k } : null;
}

/**
 * True when the line contains something worth structured rendering — the
 * caller keeps the plain-text path otherwise, so prose never risks re-layout.
 */
export function hasRenderableMath(line: string): boolean {
  return parseMathLine(line).some(n => n.kind !== 'text');
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
