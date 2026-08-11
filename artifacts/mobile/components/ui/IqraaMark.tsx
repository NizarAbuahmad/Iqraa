/**
 * Iqraa's identity mark — the assistant's face in chat.
 *
 * Separate from `BrandLogo` because they solve different problems. BrandLogo is
 * the full lockup: the Arabic اقرأ stacked over the IQRA wordmark, two lines of
 * type in a 1024px square. It was being rendered at 22–26px in message avatars
 * and the header chip, where each line of type lands about ten pixels tall and
 * dissolves into a grey smudge — which is why the avatars read as empty circles.
 *
 * A mark that has to work at 20px can carry one shape, not a wordmark. This
 * takes the leaf from above the أ — the one element of the logo that is a
 * silhouette rather than a letterform — and draws it as vector so it stays crisp
 * at any size. Use BrandLogo where there is room for the real thing (headers,
 * splash, export headers); use this everywhere the mark is small or repeated.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const TEAL = '#00A99D';
const AQUA = '#34D6C6';
const NAVY = '#081B3A';

type Props = {
  /** Outer size in px. The glyph scales with it. */
  size?: number;
  /**
   * 'brand' — teal ground, light glyph. For the header chip.
   * 'soft'  — tinted ground, teal glyph. For message avatars on a light surface.
   * 'bare'  — glyph only, no ground.
   */
  tone?: 'brand' | 'soft' | 'bare';
  /** Breathe while the assistant is composing. State, not decoration. */
  thinking?: boolean;
  style?: ViewStyle;
};

export function IqraaMark({ size = 34, tone = 'soft', thinking = false, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!thinking) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [thinking, pulse]);

  const ground =
    tone === 'brand' ? TEAL : tone === 'soft' ? 'rgba(0,169,157,0.12)' : 'transparent';
  const leaf = tone === 'brand' ? '#FFFFFF' : TEAL;
  const dot = tone === 'brand' ? AQUA : AQUA;

  // The glyph sits at ~62% of the ground so it has room to breathe.
  const glyph = Math.round(size * 0.62);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });

  return (
    <Animated.View
      style={[
        styles.ground,
        {
          width: size,
          height: size,
          borderRadius: tone === 'bare' ? 0 : Math.round(size * 0.32),
          backgroundColor: ground,
          transform: [{ scale }],
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="اقرأ"
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        {/*
          The leaf: a tapered stroke, point at lower-left, swelling to the upper
          right. Traced from the mark above the أ in the logo rather than
          invented, so it still reads as Iqraa at a glance.
        */}
        <Path
          d="M4.6 20.2c-.6-6.6 2.2-12.2 8.4-15.6 2.1-1.2 4.3-1.9 6.4-2.1.5 6.9-2.2 12.4-8 16.1-2.1 1.3-4.4 2-6.8 1.6z"
          fill={leaf}
        />
        {/* The two ق dots, kept as the second brand cue. */}
        <Circle cx="17.8" cy="20.4" r="2.05" fill={dot} />
      </Svg>
    </Animated.View>
  );
}

/** Flat navy variant for places that need the mark on a light chip. */
export const IQRAA_MARK_NAVY = NAVY;

const styles = StyleSheet.create({
  ground: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
