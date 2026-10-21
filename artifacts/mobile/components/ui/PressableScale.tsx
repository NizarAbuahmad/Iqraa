/**
 * A Pressable that gives as you press it: it springs to MOTION.pressScale
 * while held and back on release. That replaces the 70–85% opacity fades the
 * screens each chose for themselves.
 *
 * - With reduced motion, a held card dims to 0.85 instead of moving.
 * - On the web it has a pointer cursor and a focus ring in the current primary
 *   colour (the corner's, inside a corner), so a keyboard user can tell which
 *   card they are on.
 * - `accessibilityRole` is 'button' unless the caller passes another (e.g. 'link').
 * - `style` is a plain style, not a callback: the press state lives here.
 */
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';
import { MOTION } from '@/services/motion';
import { useColors } from '@/hooks/useColors';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function PressableScale({ style, accessibilityRole = 'button', onPressIn, onPressOut, onFocus, onBlur, children, ...rest }: Props) {
  const colors = useColors();
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <AnimatedPressable
      {...rest}
      accessibilityRole={accessibilityRole}
      onPressIn={e => {
        setHeld(true);
        if (!reduced) springTo(MOTION.pressScale);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        setHeld(false);
        if (!reduced) springTo(1);
        onPressOut?.(e);
      }}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        style,
        { transform: [{ scale }] },
        reduced && held ? { opacity: 0.85 } : null,
        Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              ...(focused ? { outlineStyle: 'solid', outlineWidth: 3, outlineColor: colors.primary, outlineOffset: 2 } : {}),
            } as object)
          : null,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
