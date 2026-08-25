import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

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
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    const seq = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    // `finished` is false when a newer message stopped this run — that one owns
    // the view now, and hiding on its behalf would cut it short.
    seq.start(({ finished }) => { if (finished) onHide?.(); });
    return () => seq.stop();
  }, [visible, message, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    zIndex: 999,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Cairo_500Medium',
  },
});
