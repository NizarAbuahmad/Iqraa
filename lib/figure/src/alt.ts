import type { Figure } from './types.ts';

/** Maths is Latin `x` everywhere; «س» appears only when it is shown in Arabic. */
const show = (expr: string, lang: 'ar' | 'en'): string =>
  lang === 'ar' ? expr.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'س') : expr;

const pt = (p: [number, number]) => `(${p[0]}, ${p[1]})`;

/** A text alternative generated from the spec, for screen readers. */
export function figureAltText(figure: Figure, lang: 'ar' | 'en'): string {
  if (figure.kind === 'function-graph') {
    const list = figure.functions.map(f => `${f.label ? `${f.label}: ` : ''}${show(f.expr, lang)}`).join(lang === 'ar' ? '، ' : ', ');
    return lang === 'ar' ? `رسم بياني للاقتران: ${list}` : `Graph of: ${list}`;
  }
  const list = figure.vectors
    .map(v => (lang === 'ar'
      ? `${v.label ? `المتجه ${v.label}` : 'متجه'} من ${pt(v.from)} إلى ${pt(v.to)}`
      : `${v.label ? `vector ${v.label}` : 'vector'} from ${pt(v.from)} to ${pt(v.to)}`))
    .join(lang === 'ar' ? '؛ ' : '; ');
  return lang === 'ar' ? `رسم متجهات على المستوى الإحداثي: ${list}` : `Vectors on the coordinate plane: ${list}`;
}
