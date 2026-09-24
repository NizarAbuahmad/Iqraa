import colors, { palette } from '@/constants/colors';

/**
 * The design tokens for this session's colour scheme, plus scheme-independent
 * values like `radius`. The scheme is fixed at startup — see `scheme` in
 * constants/colors.ts for why it is not live.
 */
export function useColors() {
  return { ...palette, radius: colors.radius };
}
