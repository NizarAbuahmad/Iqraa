import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useColors } from '@/hooks/useColors';
import { ICON } from '@/constants/icons';

/**
 * One tick-box row: the terms on the register screen, and the age / guardian
 * confirmation a student gives there and wherever an existing account becomes a
 * student (settings, `/claim-required`, `/setup-subjects`). They were two copies
 * of the same markup, and when the terms row was restyled (a framed panel and a
 * dark outline, because `colors.border` is near-white on the card) the copy kept
 * the old look and its leftover `borderWidth` drew a black frame. One component
 * keeps every box the same.
 */
export function CheckRow({ checked, onPress, isRTL, colors, children }: {
  checked: boolean;
  onPress: () => void;
  isRTL: boolean;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      // The row is a framed panel and the unticked box has a dark outline:
      // `colors.border` is near-white on the card, so the box read as empty
      // space and the line beside it as a caption, not something to tick.
      style={[
        styles.row,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          backgroundColor: checked ? colors.primary + '14' : colors.input,
          borderColor: checked ? colors.primary : colors.mutedForeground,
          borderRadius: colors.radius,
        },
      ]}
      accessibilityRole="checkbox"
      // react-native-web 0.21 drops `accessibilityState`; only `aria-*`
      // reaches the DOM, so a screen reader heard an unticked box.
      aria-checked={checked}
    >
      <View style={[
        styles.box,
        {
          borderColor: checked ? colors.primary : colors.mutedForeground,
          backgroundColor: checked ? colors.primary : colors.card,
        },
      ]}>
        {checked && <Ionicons name="checkmark" size={ICON.lg} color={colors.primaryForeground} />}
      </View>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', flex: 1 }]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, lineHeight: 20 },
});
