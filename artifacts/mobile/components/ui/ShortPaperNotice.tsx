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
 *
 * Also says «some of these are the same questions as before» after a
 * regenerate whose bank had nothing else to offer, so a repeat reads as a
 * limit of the lesson and not as a button that did nothing.
 */
export function ShortPaperNotice({ shortfall, repeated, repeatedUnit = 'questions' }: {
  shortfall?: { requested: number; produced: number };
  repeated?: { count: number; of: number };
  /** What the repeated things are: a paper's questions, or a lesson plan's sections. */
  repeatedUnit?: 'questions' | 'sections';
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const short = !!shortfall && shortfall.produced < shortfall.requested;
  const repeats = !!repeated && repeated.count > 0 && repeated.of > 0;
  if (!short && !repeats) return null;
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  return (
    <View
      style={[styles.box, row, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}
      accessibilityRole="alert"
    >
      <Ionicons name="information-circle" size={20} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
        {[
          short ? t('shortPaperNotice', shortfall!.produced, shortfall!.requested) : '',
          repeats ? t(repeatedUnit === 'sections' ? 'repeatedSectionsNotice' : 'repeatedQuestionsNotice', repeated!.count, repeated!.of) : '',
        ].filter(Boolean).join(' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', gap: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  text: { flex: 1, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20 },
});
