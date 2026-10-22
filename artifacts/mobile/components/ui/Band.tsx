/**
 * A header band: a diagonal gradient from `color` to it 18% darker
 * (services/band.ts), an optional motif, and in light mode a soft shadow
 * where it meets the page.
 *
 * The shadow is on an outer view and the clipping on an inner one, because
 * iOS clips a view's own shadow when it has `overflow: 'hidden'`. The outer
 * view takes `zIndex: 1` so the shadow paints over the scroll view below it.
 * `style` (padding and the rest of the band's own layout) goes on the inner
 * view.
 *
 * White text on it is measured on both stops by cornerTheme.test.ts.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scheme } from '@/constants/colors';
import type { MotifId } from '@/constants/corners';
import { ELEVATION } from '@/constants/theme';
import { bandGradient } from '@/services/band';
import { CornerMotif } from '@/components/corners/CornerMotif';

/** The leaf motif's strength on a brand-teal band: like the corners', subtle enough for the band text. */
export const BRAND_MOTIF_OPACITY = 0.1;

type Props = {
  color: string;
  motif?: MotifId;
  motifOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Band({ color, motif, motifOpacity = BRAND_MOTIF_OPACITY, style, children }: Props) {
  const [from, to] = bandGradient(color);
  return (
    <View style={[styles.outer, scheme === 'light' ? { boxShadow: ELEVATION.raised } : null]}>
      <View style={[styles.inner, { backgroundColor: color }, style]}>
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {motif ? <CornerMotif motif={motif} opacity={motifOpacity} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { zIndex: 1 },
  inner: { overflow: 'hidden' },
});
