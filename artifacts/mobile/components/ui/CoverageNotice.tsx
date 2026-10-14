import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { coverageSummary, type CoverageLesson } from '@/services/coveragePlan';
import { coveredNamesText } from '@/services/coverageNoticeText';

/**
 * «الدروس المغطاة» — which lessons of a wide scope the paper's questions are about.
 *
 * Offline the list is exact: each question is drawn from a named lesson. Live
 * it is read from the model's own tags, which are unreliable, so it says so
 * (`modelReported`) instead of presenting a claim as a fact. Renders nothing
 * when no question carries a lesson — an untagged live reply has nothing true
 * to say here, and a blank list would read as «nothing covered». The names
 * are capped (`coveredNamesText`); the «n من total» count is always shown.
 * The box styling mirrors `ShortPaperNotice`, which sits in the same place on
 * the quiz and worksheet screens: no outer horizontal margin, the screen's own
 * padding positions it.
 */
export function CoverageNotice({ lessons, questions, modelReported }: {
  lessons: CoverageLesson[];
  questions: readonly { lessonId?: string }[];
  modelReported: boolean;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const { covered, uncovered } = coverageSummary(questions, lessons);
  if (covered.length === 0) return null;
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const text = [
    t('coveredLessons', covered.length, lessons.length, coveredNamesText(covered.map(l => l.title), isRTL ? '، ' : ', ', k => t('coveredLessonsMore', k))),
    uncovered.length > 0 ? t('uncoveredLessons', uncovered.length) : '',
    modelReported ? t('coverageModelReported') : '',
  ].filter(Boolean).join(' ');
  return (
    <View style={[styles.box, row, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
      <Ionicons name="layers-outline" size={18} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', gap: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  text: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: 'Almarai_400Regular' },
});
