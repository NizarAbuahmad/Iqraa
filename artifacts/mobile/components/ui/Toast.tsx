import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';
import { useColors } from '@/hooks/useColors';

interface ToastProps {
  visible: boolean;
  message: string;
  /** Duration before auto-hide, ms. Default: 2000 */
  duration?: number;
  onHide?: () => void;
}

/*
  The animation keys on the message as well as `visible`. It used to key on
  `visible` alone, which broke every back-to-back toast: tapping the favourite
  star twice set `visible` true when it already was, so the effect never re-ran
  — the second message swapped into a view that was already fading out, and the
  first sequence's `onHide` then unmounted it outright. Star on, star off, one
  confirmation. Restarting the sequence for a new message is what makes the
  second tap say «أزلتها من المفضلة».
*/
export function Toast({ visible, message, duration = 2000, onHide }: ToastProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: NATIVE_DRIVER }),
    ]);
    // `finished` is false when a newer message stopped this run — that one owns
    // the view now, and hiding on its behalf would cut it short.
    seq.start(({ finished }) => { if (finished) onHide?.(); });
    return () => seq.stop();
  }, [visible, message, duration]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          // The inverse of the screen — navy on light, pale on dark — so it
          // reads as a layer above the page in both themes.
          backgroundColor: colors.foreground,
          transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: colors.background }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    // A long message (a partial-send report names several parents) wraps
    // inside the screen instead of running off both edges.
    maxWidth: '90%',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'ReadexPro_500Medium',
  },
});
