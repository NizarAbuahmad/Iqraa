/**
 * HTML escaping for every exported document. A leaf module: `exportHtml.ts` and
 * `formatPrintHtml.ts` both need `esc`, and while it lived in the former the
 * two imported each other.
 */
import { isolateForeignRuns, normalizeExponents } from './mathRender.ts';

/** Escape only. For attribute values — above all URLs, which must not carry
 *  the directional isolates `esc` adds. */
export function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * `esc` with the text's line breaks kept as `<br>`, each line escaped and
 * isolated on its own. For text that is several lines by construction — a
 * system of equations, a key answer followed by its reason — where layout's
 * whitespace collapsing would run the lines together.
 */
export function escLines(s: string): string {
  return (s ?? '').split('\n').map(esc).join('<br>');
}

/**
 * Escape *and* bidi-isolate. Every text node in this file is model-written
 * Arabic that can carry an equation, and a printed worksheet reordering
 * «f(x) = 2x⁴ - x² + 3» is the same bug the screens had — a teacher hands it
 * to a class on paper, where nobody can reload to check. Isolation belongs
 * here rather than at the 57 call sites so a new builder cannot forget it;
 * `escAttr` is the deliberate opt-out for the one URL attribute.
 */
export function esc(s: string): string {
  // Null-safe via isolateForeignRuns, which two builders here relied on when
  // they each carried their own `s ?? ''` copy of this function.
  //
  // Exponents are normalised BEFORE isolating, so «2^{12}» becomes «2¹²» and the
  // run is then isolated as a whole. Doing it here rather than at each option
  // and key line is the same argument as the isolation itself: 57 call sites,
  // and a new builder must not be able to forget.
  return raiseExponents(escAttr(isolateForeignRuns(normalizeExponents(s))));
}

/**
 * Whatever `normalizeExponents` could not turn into Unicode — a letter or a
 * bracketed exponent, «5^x», «3^(2x)», «4^(x+1)» — raised with `<sup>`. Unicode
 * has no superscript for most letters, so those reached the paper with a
 * literal caret: every question on the exponential-equations worksheet, while
 * the screen raised them. Runs on escaped text, so it is text-node only; an
 * attribute takes `escAttr`.
 */
function raiseExponents(html: string): string {
  // A bracketed exponent is matched to ITS closing bracket, so «2^(2(x+1))»
  // raises «2(x+1)» whole; an unclosed one is left as written.
  let out = '';
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '^' && html[i + 1] === '(') {
      let depth = 0;
      let j = i + 1;
      for (; j < html.length; j++) {
        if (html[j] === '(') depth++;
        else if (html[j] === ')' && --depth === 0) break;
      }
      if (j < html.length) {
        out += `<sup>${html.slice(i + 2, j)}</sup>`;
        i = j;
        continue;
      }
    }
    out += html[i];
  }
  return out.replace(/\^([+\-\u2212]?[A-Za-z0-9]+)/g, '<sup>$1</sup>');
}
