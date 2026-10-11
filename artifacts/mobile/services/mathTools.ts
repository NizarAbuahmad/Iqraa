/**
 * Routes and registry for the Math Corner. A tool URL is shareable, so the id
 * that arrives in the route param is untrusted: it resolves to a known tool or
 * to null, never to a guess. Free of react-native so `node --test` loads it.
 *
 * The id set holds only tools that have shipped, so the hub never lists a dead
 * card; each new tool adds its id here and its component in `MathTool.tsx`
 * (a `Record<MathToolId, …>`, so a missing component fails to compile).
 */
import type { TranslationKey } from './i18n.ts';
import { PROD_ORIGIN } from './siteOrigin.ts';

export const MATH_ROUTE = '/curriculum/math';

export const MATH_TOOL_IDS = ['calculator', 'grapher', 'converter', 'formulas'] as const;
export type MathToolId = (typeof MATH_TOOL_IDS)[number];

export type MathToolMeta = {
  /** An Ionicons glyph name; the component narrows it. */
  icon: string;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
};

export const MATH_TOOLS: Record<MathToolId, MathToolMeta> = {
  calculator: {
    icon: 'calculator-outline',
    titleKey: 'mathToolCalculator',
    hintKey: 'mathToolCalculatorHint',
  },
  grapher: {
    icon: 'analytics-outline',
    titleKey: 'mathToolGrapher',
    hintKey: 'mathToolGrapherHint',
  },
  converter: {
    icon: 'swap-horizontal-outline',
    titleKey: 'mathToolConverter',
    hintKey: 'mathToolConverterHint',
  },
  formulas: {
    icon: 'document-text-outline',
    titleKey: 'mathToolFormulas',
    hintKey: 'mathToolFormulasHint',
  },
};

export function mathToolPath(id: MathToolId): string {
  return `${MATH_ROUTE}/${encodeURIComponent(id)}`;
}

/**
 * The link a teacher pastes into a chat. Built from the production origin, not
 * `Linking.createURL`, for the same reason as `labShareUrl`.
 */
export function mathShareUrl(id: MathToolId): string {
  return `${PROD_ORIGIN}${mathToolPath(id)}`;
}

export function resolveMathParam(param: string | string[] | undefined): MathToolId | null {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;
  return (MATH_TOOL_IDS as readonly string[]).includes(id) ? (id as MathToolId) : null;
}
