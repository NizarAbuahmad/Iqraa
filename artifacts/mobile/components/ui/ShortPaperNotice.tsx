import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

/**
 * «This paper is shorter than you asked for».
 *
 * A lesson's question bank can hold fewer items than a teacher requests, and
 * the generator now stops there rather than padding the paper with sentences
 * that read like questions and test nothing. Without this, 10 requested and 3
 * delivered looks like a bug. Renders nothing when the paper is complete.
 */
export function ShortPaperNotice({ shortfall }: { shortfall?: { requested: number; produced: number } }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  if (!shortfall || shortfall.produced >= shortfall.requested) return null;
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  return (
    <View
      style={[styles.box, row, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}
      accessibilityRole="alert"
    >
      <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
        {t('shortPaperNotice', shortfall.produced, shortfall.requested)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', gap: 8, borderWidth: 1, padding: 12, marginBottom: 12 },
  text: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20 },
});
