import colors from '@/constants/colors';

/**
 * Returns the design tokens for the app. Light only, on purpose.
 *
 * ponytail: dark mode is off. ~60 screens still hardcode navy heroes, `#fff`
 * surfaces and category hexes that do not flip, so following the OS scheme
 * produced navy-on-navy headers. `colors.dark` is kept and ready; re-enable by
 * switching on `useColorScheme()` here once those screens read tokens.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
