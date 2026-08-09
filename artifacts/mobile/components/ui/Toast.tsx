import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface ToastProps {
  visible: boolean;
  message: string;
  /** Duration before auto-hide, ms. Default: 2000 */
  duration?: number;
  onHide?: () => void;
}

export function Toast({ visible, message, duration = 2000, onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(duration),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }
  }, [visible]);

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
