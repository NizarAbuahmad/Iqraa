/**
 * IQRA "reasoning" indicator.
 *
 * A plain spinner tells the teacher nothing. This shows the assistant walking
 * through named steps ("reviewing the curriculum" → "choosing activities" →
 * "drafting the plan"), so the wait reads as work rather than lag.
 *
 * Uses the core Animated API on purpose — it runs identically on iOS, Android
 * and react-native-web, which is where this screen is demoed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
};

type Props = {
  /** Ordered reasoning steps. The last one holds until the reply lands. */
  steps: string[];
  colors: Colors;
  isRTL: boolean;
  /** ms each step stays on screen before advancing. */
  stepDuration?: number;
};

const DOT_COUNT = 3;

export function ThinkingIndicator({ steps, colors, isRTL, stepDuration = 1500 }: Props) {
  const safeSteps = steps.length ? steps : [''];
  const [stepIndex, setStepIndex] = useState(0);
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0)),
  ).current;
  const halo = useRef(new Animated.Value(0)).current;

  // Bouncing dots — staggered so the row reads as a wave, not a blink.
  useEffect(() => {
    const loops = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 360,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - i) * 140),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [dots]);

  // Soft breathing halo behind the avatar — "the agent is awake".
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);

  // Advance through the named steps, cross-fading the label.
  useEffect(() => {
    if (safeSteps.length < 2) return;
    const timer = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= safeSteps.length - 1) return prev;
        Animated.sequence([
          Animated.timing(labelOpacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(labelOpacity, {
            toValue: 1,
            duration: 220,
            delay: 40,
            useNativeDriver: true,
          }),
        ]).start();
        return prev + 1;
      });
    }, stepDuration);
    return () => clearInterval(timer);
  }, [labelOpacity, safeSteps.length, stepDuration]);

  const rowDir = isRTL ? 'row-reverse' : 'row';
  const label = safeSteps[Math.min(stepIndex, safeSteps.length - 1)] ?? '';
  const progress = safeSteps.length > 1 ? (stepIndex + 1) / safeSteps.length : 1;

  return (
    <View style={[styles.row, { flexDirection: rowDir }]}>
      <View style={styles.avatarWrap}>
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: colors.primary,
              opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.28] }),
              transform: [
                { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.25] }) },
              ],
            },
          ]}
        />
        <View style={[styles.avatar, { backgroundColor: colors.primary + '1F' }]}>
          <BrandLogo variant="mark" width={20} height={18} />
        </View>
      </View>

      <View
        style={[
          styles.bubble,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.bubbleRow, { flexDirection: rowDir }]}>
          <View style={[styles.dots, { flexDirection: rowDir }]}>
            {dots.map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: colors.primary,
                    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                    transform: [
                      { translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                    ],
                  },
                ]}
              />
            ))}
          </View>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: colors.mutedForeground,
                opacity: labelOpacity,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          >
            {label}
          </Animated.Text>
        </View>

        {/* Step progress — makes a multi-second generation feel bounded. */}
        {safeSteps.length > 1 ? (
          <View style={[styles.track, { backgroundColor: colors.primary + '1A' }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.round(progress * 100)}%`,
                  alignSelf: isRTL ? 'flex-end' : 'flex-start',
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatarWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 34, height: 34, borderRadius: 17 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
    minWidth: 180,
    maxWidth: '82%',
  },
  bubbleRow: { alignItems: 'center', gap: 10 },
  dots: { alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12.5, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
});
