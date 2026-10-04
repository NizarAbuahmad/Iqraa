import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

/**
 * A list that failed to load, with the one thing the teacher can do about it.
 *
 * Messages, classes, evaluations, teaching plans, schedule and calendar each
 * printed the error and stopped: the only way back was to leave the screen
 * and come in again, which nothing told them. `onRetry` re-runs the screen's
 * own load, which clears the error first. `onDismiss` is for screens whose
 * error slot also carries action failures (a save that did not go through),
 * where hiding the message is a reasonable answer too.
 */
export function LoadError({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  return (
    <View style={[styles.box, row, { borderColor: colors.destructive }]} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
      <Text style={[styles.text, { color: colors.destructive, textAlign: isRTL ? 'right' : 'left' }]}>{message}</Text>
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => [styles.retry, row, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="refresh" size={14} color={colors.destructive} />
        <Text style={[styles.retryText, { color: colors.destructive }]}>{t('retry')}</Text>
      </Pressable>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('close')}>
          <Ionicons name="close" size={16} color={colors.destructive} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  text: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 },
  retry: { alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  retryText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 },
});
