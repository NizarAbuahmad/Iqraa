/**
 * A short, non-blocking celebration: a burst of confetti and a small badge.
 *
 * It marks four moments of real progress — an exam handed in during this
 * sitting (app/take/[code].tsx), a public game finished
 * (components/publicGames/GameShell.tsx), all of a student's homework done,
 * and a lesson's prep ready on Today. Each caller fires it on the CROSSING
 * (`justCompleted` in services/celebration.ts), never on opening a screen
 * that is already complete.
 *
 * It never blocks input: the root is an absolute fill with
 * `pointerEvents="none"`, on top of the screen, and it removes itself by
 * calling `onDone` after 1.8 s (`small`) or 2.2 s (`big`).
 *
 * Reduced motion (`useReduceMotion`): no confetti and no scaling — the badge
 * only fades in and out. The message is also announced to screen readers, and
 * on native a success haptic is played (errors from it are ignored).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Surface } from '@/components/ui/Surface';
import { NATIVE_DRIVER } from '@/constants/animation';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { MOTION } from '@/services/motion';
import { confettiPieces, type ConfettiPiece } from '@/services/celebration';

const FALL_MS = 1200;
const HOLD_MS = { small: 1800, big: 2200 } as const;

type Burst = {
  pieces: ConfettiPiece[];
  progress: Animated.Value[];
  badgeOpacity: Animated.Value;
  badgeScale: Animated.Value;
};

export function Celebrate({
  visible, message, size = 'small', onDone,
}: {
  visible: boolean;
  message: string;
  size?: 'small' | 'big';
  onDone: () => void;
}) {
  const colors = useColors();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const [burst, setBurst] = useState<Burst | null>(null);

  // Read at the moment the burst starts, so a re-render with a new inline
  // `onDone`, message or size cannot restart or cut it short.
  const latest = useRef({ message, size, reduceMotion, onDone });
  latest.current = { message, size, reduceMotion, onDone };

  useEffect(() => {
    if (!visible) return undefined;
    const { message: text, size: kind, reduceMotion: reduced } = latest.current;

    try { AccessibilityInfo.announceForAccessibility(text); } catch { /* announcing is best effort */ }
    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch { /* no haptics on this device */ }
    }

    const pieces = reduced ? [] : confettiPieces(kind === 'big' ? 24 : 12, Date.now());
    const next: Burst = {
      pieces,
      progress: pieces.map(() => new Animated.Value(0)),
      badgeOpacity: new Animated.Value(0),
      badgeScale: new Animated.Value(reduced ? 1 : 0.85),
    };
    setBurst(next);

    const running: Animated.CompositeAnimation[] = [];
    const run = (a: Animated.CompositeAnimation, done?: () => void) => {
      running.push(a);
      a.start(done ? ({ finished }) => { if (finished) done(); } : undefined);
    };

    pieces.forEach((p, i) => run(Animated.timing(next.progress[i], {
      toValue: 1,
      duration: FALL_MS,
      delay: p.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    })));
    run(Animated.timing(next.badgeOpacity, { toValue: 1, duration: MOTION.enterMs, useNativeDriver: NATIVE_DRIVER }));
    if (!reduced) {
      run(Animated.timing(next.badgeScale, { toValue: 1, duration: MOTION.enterMs, useNativeDriver: NATIVE_DRIVER }));
    }

    const timer = setTimeout(() => {
      run(Animated.timing(next.badgeOpacity, { toValue: 0, duration: MOTION.enterMs, useNativeDriver: NATIVE_DRIVER }), () => {
        setBurst(null);
        latest.current.onDone();
      });
    }, HOLD_MS[kind]);

    return () => {
      clearTimeout(timer);
      running.forEach(a => a.stop());
      setBurst(null);
    };
  }, [visible]);

  if (!visible || !burst) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents="none">
      {burst.pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * width,
            top: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: RADIUS.xs,
            opacity: burst.progress[i].interpolate({ inputRange: [0, 0.66, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: burst.progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, 0.6 * height] }) },
              { translateX: burst.progress[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: burst.progress[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] }) },
            ],
          }}
        />
      ))}
      <View style={styles.center} pointerEvents="none">
        <Animated.View style={{ opacity: burst.badgeOpacity, transform: [{ scale: burst.badgeScale }] }}>
          <Surface style={styles.badge}>
            <Ionicons name="checkmark-circle" size={44} color={colors.primary} />
            <Text style={[styles.message, { color: colors.foreground }]}>{message}</Text>
          </Surface>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badge: { padding: SPACE.lg, gap: SPACE.sm, alignItems: 'center', minWidth: 200 },
  message: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: 'center' },
});
