import colors, { palette, scheme } from '@/constants/colors';
import { useCorner } from '@/context/CornerTheme';
import type { CornerTokens } from '@/constants/corners';
import type { Palette } from '@/constants/colors';

// `CornerTokens` is spelled out in constants/corners.ts (it cannot import
// constants/colors.ts, which `node --test` cannot load). This fails the
// typecheck if a palette key it overrides is ever renamed, instead of the
// corner silently spreading a stray key.
const _cornerKeysArePaletteKeys: Pick<Palette, keyof CornerTokens> = {} as CornerTokens;
void _cornerKeysArePaletteKeys;

/**
 * The design tokens for this session's colour scheme, plus scheme-independent
 * values like `radius`. The scheme is fixed at startup — see `scheme` in
 * constants/colors.ts for why it is not live.
 *
 * Inside a corner (context/CornerTheme.tsx) the corner's own hero, primary,
 * secondary and selected replace the teal ones, so a button or chip rendered
 * there takes the corner's hue without knowing it is in one.
 */
export function useColors() {
  const corner = useCorner();
  return { ...palette, ...(corner ? corner[scheme] : {}), radius: colors.radius };
}
