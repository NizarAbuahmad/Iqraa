import { isSceneFigure, type AnyFigure, type PhysicsValue, type SceneFigure } from './sceneTypes.ts';
import { formatValue } from './scene.ts';

/** Maths is Latin `x` everywhere; «س» appears only when it is shown in Arabic. */
const show = (expr: string, lang: 'ar' | 'en'): string =>
  lang === 'ar' ? expr.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'س') : expr;

const pt = (p: [number, number]) => `(${p[0]}, ${p[1]})`;

const tag = (label: string, v?: PhysicsValue) => (v ? `${label} = ${formatValue(v)}` : label);

function sceneAlt(f: SceneFigure, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  switch (f.kind) {
    case 'forces': {
      const list = f.arrows.map(a => tag(a.label, a.value)).join(ar ? '، ' : ', ');
      const where = f.incline !== undefined ? (ar ? ` على سطح مائل بزاوية ${f.incline}°` : ` on a ${f.incline}° incline`) : '';
      return ar ? `مخطط قوى على ${f.body === 'block' ? 'جسم' : 'نقطة'}${where}: ${list}` : `Force diagram on a ${f.body}${where}: ${list}`;
    }
    case 'attraction': {
      const d = f.distance ? (ar ? `، والمسافة بينهما ${tag(f.distance.label, f.distance.value)}` : `, ${tag(f.distance.label, f.distance.value)} apart`) : '';
      return ar ? `قوتا تجاذب ${f.force} بين ${f.bodies[0]} و${f.bodies[1]}${d}` : `Attraction forces ${f.force} between ${f.bodies[0]} and ${f.bodies[1]}${d}`;
    }
    case 'projectile':
      return f.launch === 'ground'
        ? (ar ? `مسار مقذوف أُطلق بزاوية ${f.angle}° من سطح الأرض` : `Path of a projectile launched at ${f.angle}° from the ground`)
        : (ar ? `مسار جسم قُذف أفقيًا من ارتفاع${f.height ? ` ${formatValue(f.height)}` : ''}` : `Path of a body thrown horizontally from a height${f.height ? ` of ${formatValue(f.height)}` : ''}`);
    case 'circular': {
      const list = f.arrows.join(ar ? '، ' : ', ');
      return ar
        ? `حركة دائرية منتظمة ${f.turning === 'ccw' ? 'عكس' : 'مع'} اتجاه دوران عقارب الساعة: ${list}`
        : `Uniform circular motion, ${f.turning === 'ccw' ? 'counter-clockwise' : 'clockwise'}: ${list}`;
    }
    case 'wave': {
      const n = f.cycles;
      const base = ar ? `موجة على ${n === 1 ? 'طول موجي واحد' : n === 2 ? 'طولين موجيين' : 'ثلاثة أطوال موجية'}` : `A wave over ${n} wavelength${n === 1 ? '' : 's'}`;
      const second = f.second ? (ar ? `، وموجة ثانية ${f.second.phase === 'in' ? 'متفقة' : 'معاكسة'} في الطور${f.second.sum ? ' ومحصلتهما' : ''}` : `, a second wave ${f.second.phase === 'in' ? 'in' : 'out of'} phase${f.second.sum ? ' and their sum' : ''}`) : '';
      return base + second;
    }
  }
}

/** A text alternative generated from the spec, for screen readers. */
export function figureAltText(figure: AnyFigure, lang: 'ar' | 'en'): string {
  if (isSceneFigure(figure)) return sceneAlt(figure, lang);
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
