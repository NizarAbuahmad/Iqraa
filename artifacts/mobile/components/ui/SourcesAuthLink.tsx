/**
 * «المصادر وإخلاء المسؤولية» at the foot of the login and register screens, so
 * a visitor (or a store reviewer) can read what the app is not before signing
 * in. Opens `/legal/sources`, a public route. Styled like
 * `SuggestFeatureAuthLink` beside it: quiet, not the point of the screen.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { SOURCES_ROUTE, sourcesCopy } from '@/constants/sources';

export function SourcesAuthLink() {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push(SOURCES_ROUTE as never)}
      accessibilityRole="link"
      hitSlop={6}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="library-outline" size={16} color={colors.mutedForeground} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{sourcesCopy(lang).title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 8 },
  label: { fontFamily: 'ReadexPro_500Medium', fontSize: 13, textDecorationLine: 'underline' },
});
