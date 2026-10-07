/**
 * A law as a card: the formula big, the quantities with units, and the
 * lesson's own vocabulary terms. No Arabic prose written by us appears here —
 * the terms are copied verbatim from the lesson and tested against it.
 *
 * The formula is latin and always laid out left-to-right, even in an RTL
 * screen: «F = m × a» reads wrongly mirrored.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LabLawItem } from '@workspace/curriculum/lab';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

export function LabLawCard({ item }: { item: LabLawItem }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labFormula')}
      </Text>
      <View style={[styles.formulaBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formula, { color: colors.primary, fontFamily: 'ReadexPro_700Bold' }]}>{item.formula}</Text>
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labQuantities')}
      </Text>
      {item.quantities.map(q => (
        <View
          key={q.symbol}
          style={[styles.qRow, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Text style={[styles.symbol, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{q.symbol}</Text>
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}>
            {q.nameEn}
          </Text>
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>{q.unit}</Text>
        </View>
      ))}

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labTerms')}
      </Text>
      <View style={[styles.terms, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {item.termsAr.map(term => (
          <View key={term} style={[styles.term, { backgroundColor: colors.secondary }]}>
            <Text style={{ color: colors.secondaryForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>{term}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 10 },
  label: { fontSize: 13, marginTop: 6 },
  formulaBox: { borderWidth: 1, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center' },
  // `writingDirection: 'ltr'` keeps the formula from being mirrored on an RTL screen.
  formula: { fontSize: 32, writingDirection: 'ltr', textAlign: 'center' },
  qRow: { alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  symbol: { fontSize: 20, minWidth: 56, writingDirection: 'ltr', textAlign: 'center' },
  unit: { fontSize: 13, writingDirection: 'ltr' },
  terms: { flexWrap: 'wrap', gap: 8 },
  term: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
