import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

const LOGO_MARK_LIGHT = require('@/assets/images/logo-mark.png');
const LOGO_MARK_DARK = require('@/assets/images/logo-mark-dark.png');
const LOGO_LOCKUP_LIGHT = require('@/assets/images/logo-lockup.png');
const LOGO_LOCKUP_DARK = require('@/assets/images/logo-lockup-dark.png');

const NAVY = '#081B3A';
const TEAL = '#00A99D';

type Variant = 'mark' | 'lockup';

type Props = {
  /** mark = Arabic + IQRA wordmark; lockup = full stacked brand lockup */
  variant?: Variant;
  /**
   * true  → light glyphs (for dark / teal backgrounds)
   * false → dark Midnight Navy glyphs (for light backgrounds)
   */
  onDark?: boolean;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * IQRA brand logo with automatic light/dark glyph selection for contrast.
 * Falls back to Midnight Navy wordmark + teal accent if a dark asset is missing.
 */
export function BrandLogo({
  variant = 'mark',
  onDark = false,
  width,
  height,
  style,
  containerStyle,
  accessibilityLabel = 'IQRA',
}: Props) {
  const defaults =
    variant === 'lockup'
      ? { width: 140, height: 32 }
      : { width: 26, height: 24 };

  const w = width ?? defaults.width;
  const h = height ?? defaults.height;

  // Prefer asset variants; text fallback keeps Midnight Navy + teal if dark PNG is absent.
  const darkAsset = variant === 'lockup' ? LOGO_LOCKUP_DARK : LOGO_MARK_DARK;
  const lightAsset = variant === 'lockup' ? LOGO_LOCKUP_LIGHT : LOGO_MARK_LIGHT;
  const source = onDark ? lightAsset : darkAsset;

  if (!onDark && !darkAsset) {
    return (
      <View
        style={[styles.fallback, { width: w, height: h }, containerStyle]}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.fallbackIqra}>
          I<Text style={styles.fallbackQ}>Q</Text>RA
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[{ width: w, height: h }, style]}
      resizeMode="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIqra: {
    color: NAVY,
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
    letterSpacing: 2,
  },
  fallbackQ: {
    color: TEAL,
  },
});
