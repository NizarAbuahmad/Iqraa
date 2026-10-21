/**
 * A card's look: the card colour at radius 16, lifted by a soft shadow in
 * light mode on Android 9+ and iOS/web, and outlined by a 1px border in dark
 * mode (a shadow does not show on the navy page) and on older Android (React
 * Native draws no outset `boxShadow` below API 28). Use `useSurface()` in a Pressable's style array,
 * and `<Surface>` for a plain container.
 *
 * Two traps:
 * - Remove the card's own `borderWidth: 1` when it takes this. A light surface
 *   has no `borderColor`, so a leftover width draws a black border.
 * - Do not put `overflow: 'hidden'` on a surface: iOS clips a view's own shadow
 *   to its bounds. Round the child that needs clipping instead.
 */
import React from 'react';
import { Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { scheme } from '@/constants/colors';
import { ELEVATION, RADIUS, type Elevation } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';

// React Native draws no outset boxShadow on Android below API 28 (9), so a card there keeps its border.
const SHADOWS_DRAW = !(Platform.OS === 'android' && Number(Platform.Version) < 28);

export function useSurface(level: Elevation = 'card'): ViewStyle {
  const colors = useColors();
  return scheme === 'dark' || !SHADOWS_DRAW
    ? { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border }
    : { backgroundColor: colors.card, borderRadius: RADIUS.lg, boxShadow: ELEVATION[level] };
}

export function Surface({ level, style, ...rest }: ViewProps & { level?: Elevation }) {
  const surface = useSurface(level);
  return <View {...rest} style={[surface, style]} />;
}
