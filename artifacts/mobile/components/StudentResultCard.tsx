/**
 * A student's released result: level, marks, and the four competencies.
 *
 * Lifted out of the hand-in screen (`app/take/[code].tsx`) when «اختباراتي»
 * needed the same thing, so the result a student sees right after handing in
 * and the one they find later in their list are one rendering, not two that
 * drift. It renders only what `sanitizeResultForStudent` sends — never the
 * per-objective detail, which is a diagnostic for the teacher.
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { StudentResult } from '@/services/studentExam';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';
import type { useColors } from '@/hooks/useColors';

const ACCENT = palette.primary;

export const LEVEL_LABEL_KEY: Record<string, TranslationKey> = {
  beginner: 'levelBeginner',
  developing: 'levelDeveloping',
  proficient: 'levelProficient',
  advanced: 'levelAdvanced',
};

const COMPETENCY_ORDER = ['knowledge', 'understanding', 'application', 'critical_thinking'] as const;
const COMPETENCY_LABEL_KEY: Record<(typeof COMPETENCY_ORDER)[number], TranslationKey> = {
  knowledge: 'competencyKnowledge',
  understanding: 'competencyUnderstanding',
  application: 'competencyApplication',
  critical_thinking: 'competencyCriticalThinking',
};

export function StudentResultCard({
  result,
  colors,
  isRTL,
  t,
  showTitle = true,
}: {
  result: StudentResult;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
  showTitle?: boolean;
}) {
  const levelKey = result.levelKey ? LEVEL_LABEL_KEY[result.levelKey] : undefined;
  return (
    <View style={{ gap: 10, alignItems: 'center', width: '100%', maxWidth: 340, alignSelf: 'center' }}>
      {showTitle && (
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16 }}>
          {t('takeResultTitle')}
        </Text>
      )}
      {levelKey && (
        <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: 22 }}>
          {t(levelKey)}
        </Text>
      )}
      <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15 }}>
        {t('marksLabel')}: {result.earnedMarks} / {result.totalMarks}
        {' '}({result.percent}%)
      </Text>
      <View style={{ width: '100%', borderTopWidth: 1, borderColor: colors.border, marginTop: 4, paddingTop: 10, gap: 6 }}>
        {COMPETENCY_ORDER.map(key => {
          const c = result.competencyScores[key];
          return (
            <View key={key} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15 }}>
                {t(COMPETENCY_LABEL_KEY[key])}
              </Text>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                {c?.sufficient ? `${c.percent}%` : t('insufficientEvidence')}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
