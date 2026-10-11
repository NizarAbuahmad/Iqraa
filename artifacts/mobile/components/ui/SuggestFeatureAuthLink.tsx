/**
 * «اقترح ميزة» at the foot of the login and register screens — the entry point
 * for a visitor with no account. Opens /suggest-feature, which is a public
 * route and, signed out, posts to the rate-limited `POST /site/ideas`.
 *
 * Deliberately quieter than the sign-in links above it: it is an invitation,
 * not the thing this screen is for.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

export function SuggestFeatureAuthLink() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push('/suggest-feature' as never)}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="bulb-outline" size={16} color={colors.mutedForeground} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{t('suggestFeatureAuthLink')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 8 },
  label: { fontFamily: 'ReadexPro_500Medium', fontSize: 13, textDecorationLine: 'underline' },
});
