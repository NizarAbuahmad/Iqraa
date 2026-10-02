import React from 'react';
import { ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

// The PNGs hold only the Arabic إقرأ glyph (the Latin line was cropped off
// 2026-10-02). The wordmark under it is text, so it always carries the
// brand's spelling — Iqrra, as the domain — and never needs a new export.
const MARK_LIGHT = require('@/assets/images/logo-mark.png');
const MARK_DARK = require('@/assets/images/logo-mark-dark.png');

const NAVY = '#081B3A';
const TEAL = '#00A99D';

/** Below this box height the wordmark would be under 7px tall: glyph only. */
const WORDMARK_MIN_HEIGHT = 40;

type Props = {
  /**
   * true  → light glyphs (for dark / teal backgrounds)
   * false → dark Midnight Navy glyphs (for light backgrounds)
   */
  onDark?: boolean;
  /** Box for the glyph; the wordmark sits under it and adds its own height. */
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * Iqrra brand mark: the Arabic glyph with the IQRRA wordmark under it, glyph
 * colour picked for the background.
 */
export function BrandLogo({
  onDark = false,
  width = 26,
  height = 24,
  style,
  containerStyle,
  accessibilityLabel = 'Iqrra',
}: Props) {
  const fontSize = Math.round(width * 0.17);

  return (
    <View
      style={[styles.column, containerStyle]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image source={onDark ? MARK_LIGHT : MARK_DARK} style={[{ width, height }, style]} resizeMode="contain" />
      {height >= WORDMARK_MIN_HEIGHT ? (
        <Text
          style={[
            styles.wordmark,
            { color: onDark ? '#FFFFFF' : NAVY, fontSize, letterSpacing: fontSize * 0.4, marginTop: Math.round(height * 0.04) },
          ]}
        >
          I<Text style={styles.q}>Q</Text>RRA
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center' },
  wordmark: {
    fontFamily: 'Cairo_500Medium',
    textAlign: 'center',
    // Centre the glyph run: letterSpacing trails the last letter too.
    paddingLeft: 4,
  },
  q: { color: TEAL },
});
