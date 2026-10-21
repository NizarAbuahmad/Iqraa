/**
 * Brings its child in: a fade and an MOTION.rise-px rise over MOTION.enterMs,
 * starting entranceDelay(index) after mount, so a list arrives one card after
 * another. With reduced motion the child renders in place, fully visible on
 * its first frame.
 *
 * It animates once, on mount. A list that re-renders does not replay it.
 * Layout styles (flexBasis, width, flexGrow) go on `style`, because this view
 * is the one the parent lays out.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';
import { MOTION, entranceDelay } from '@/services/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode };

export function Entrance({ index = 0, style, children }: Props) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const run = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const timing = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.enterMs,
      delay: entranceDelay(index),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    run.current = timing;
    timing.start();
    return () => timing.stop();
    // Mount only: a re-render must not replay the entrance.
  }, []);

  // The device's answer can arrive after this mounted: snap into place rather
  // than finish the motion.
  useEffect(() => {
    if (!reduced) return;
    run.current?.stop();
    progress.setValue(1);
  }, [reduced, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [MOTION.rise, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
