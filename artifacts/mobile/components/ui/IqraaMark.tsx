/**
 * Iqrra's identity mark — the assistant's face in chat.
 *
 * Separate from `BrandLogo` because they solve different problems. BrandLogo is
 * the full lockup (mark + اقرأ wordmark); at 22–26px the wordmark dissolves into
 * a smudge, which is why message avatars read as empty circles. A mark that has
 * to work at 20px carries one shape, so this draws just the leaf mark of the
 * logo, as vector, crisp at any size. Use BrandLogo where there is room for the
 * lockup (headers, splash, login); use this where the mark is small or repeated.
 */
import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Mask, Path, Rect } from 'react-native-svg';
import { NATIVE_DRIVER } from '@/constants/animation';
import { BRAND_TEAL, DOT, LEAF_PATH, MARK_RADIUS, STEM_PATH } from '@/constants/brandMark';

type Props = {
  /** Outer size in px. The glyph scales with it. */
  size?: number;
  /**
   * 'brand' — the logo's teal square, white leaf. For the header chip.
   * 'soft'  — tinted ground, teal leaf. For message avatars on a light surface.
   * 'bare'  — leaf only, no ground.
   */
  tone?: 'brand' | 'soft' | 'bare';
  /** Breathe while the assistant is composing. State, not decoration. */
  thinking?: boolean;
  style?: ViewStyle;
};

export function IqraaMark({ size = 34, tone = 'soft', thinking = false, style }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  // The stem is cut out of the leaf, so it shows whatever is behind the mark.
  const maskId = `iqmark${useId().replace(/:/g, '')}`;

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
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [thinking, pulse]);

  const ground =
    tone === 'brand' ? BRAND_TEAL : tone === 'soft' ? 'rgba(0,169,157,0.12)' : 'transparent';
  const leaf = tone === 'brand' ? '#FFFFFF' : BRAND_TEAL;

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });

  return (
    <Animated.View
      style={[styles.ground, { width: size, height: size, transform: [{ scale }] }, style]}
      accessibilityRole="image"
      accessibilityLabel="اقرأ"
    >
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={48} height={48}>
            <Rect width={48} height={48} fill="#FFFFFF" />
            <Path d={STEM_PATH} stroke="#000000" strokeWidth={1.8} strokeLinecap="round" fill="none" />
          </Mask>
        </Defs>
        {tone !== 'bare' ? <Rect width={48} height={48} rx={48 * MARK_RADIUS} fill={ground} /> : null}
        <Path d={LEAF_PATH} fill={leaf} mask={`url(#${maskId})`} />
        <Circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill={leaf} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
