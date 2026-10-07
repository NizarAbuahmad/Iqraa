import React from 'react';
import { KeyboardAvoidingView, StyleProp, StyleSheet, ViewStyle } from 'react-native';

/**
 * Lifts its content above the software keyboard.
 *
 * Expo SDK 54 draws Android edge-to-edge and `KeyboardProvider` (root layout)
 * forces `navigationBarTranslucent`, so the system no longer resizes the window
 * for the keyboard — on screens *and* inside `<Modal>` windows. Nothing moves
 * unless a view asks, which is what this does. `behavior="padding"` on every
 * platform: RN's KeyboardAvoidingView listens to `keyboardDidShow/Hide` on
 * Android, and on web no keyboard event fires, so it is inert there.
 *
 * Used in two places only — the root Stack's `screenLayout` (every screen) and
 * inside a `<Modal>` (its own window, so the Stack's wrapper does not reach
 * it). Do NOT nest a second one inside a screen: both react to the same event
 * with the same stale frame and the content lifts twice.
 */
export function KeyboardSafeView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
