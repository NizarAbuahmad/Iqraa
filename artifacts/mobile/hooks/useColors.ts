import colors, { palette, scheme } from '@/constants/colors';
import { useCorner } from '@/context/CornerTheme';

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
