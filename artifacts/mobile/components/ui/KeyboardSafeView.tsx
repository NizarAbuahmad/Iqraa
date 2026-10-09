import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * Lifts its content above the software keyboard.
 *
 * Expo SDK 54 draws Android edge-to-edge and `KeyboardProvider` (root layout)
 * forces `navigationBarTranslucent`, so the system no longer resizes the window
 * for the keyboard — on screens *and* inside `<Modal>` windows. Nothing moves
 * unless a view asks, which is what this does.
 *
 * keyboard-controller's KeyboardAvoidingView, not React Native's. RN's keeps
 * the last keyboard event and recomputes its padding from it on every layout,
 * so a show it never saw the matching hide for left that padding behind for
 * good — and since this wraps every screen, it showed up as a band of the
 * navigator's grey background under the tab bar. This one interpolates the
 * padding from the live keyboard progress, which is 0 whenever the keyboard
 * is closed, and it handles `<Modal>` windows on Android itself.
 *
 * Used in two places only — the root Stack's `screenLayout` (every screen) and
 * inside a `<Modal>` (its own window, so the Stack's wrapper does not reach
 * it). Do NOT nest a second one inside a screen: both react to the same
 * keyboard with the same frame and the content lifts twice.
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
