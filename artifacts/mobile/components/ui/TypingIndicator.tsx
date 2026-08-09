/**
 * Three-dot "assistant is typing" animation.
 *
 * Replaces the generic ActivityIndicator in the chat: a spinner reads as
 * "loading a screen", while bouncing dots read as "someone is replying to me",
 * which is what the moment actually is.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type Props = {
  color: string;
  size?: number;
};

function Dot({ color, size, delay }: { color: string; size: number; delay: number }) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(360 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, value]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            {
              translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
            },
          ],
        },
      ]}
    />
  );
}

export function TypingIndicator({ color, size = 6 }: Props) {
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      <Dot color={color} size={size} delay={0} />
      <Dot color={color} size={size} delay={120} />
      <Dot color={color} size={size} delay={240} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 12 },
  dot: {},
});
