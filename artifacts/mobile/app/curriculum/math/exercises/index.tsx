/**
 * Math Corner exercises — pick a grade, then a lesson from its book.
 *
 * Under `/curriculum` so students reach it with no gating change (the same
 * prefix the rest of the corner relies on). Only lessons the practice bank
 * covers are listed (`services/mathExercises.ts`), each with the student's best
 * test-yourself score on this device. The grade rides in the URL so
 * back-navigation from a lesson lands on the same grade.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { EXERCISE_GRADES, exerciseLessonPath, exerciseUnits } from '@/services/mathExercises';
import { useExerciseBests } from '@/services/mathExerciseProgress';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

function initialGrade(param: string | undefined, gradeIds: string[] | undefined): number {
  const valid = (n: number) => (EXERCISE_GRADES as readonly number[]).includes(n);
  const fromParam = Number(param);
  if (valid(fromParam)) return fromParam;
  // A teacher lands on the first grade they teach; anyone else on Grade 1.
  const taught = (gradeIds ?? []).map(id => Number(id.match(/^grade-(\d+)$/)?.[1])).find(valid);
  return taught ?? 1;
}

export default function MathExercisesScreen() {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ grade?: string }>();
  const grade = initialGrade(params.grade, user?.gradeIds);
  const units = useMemo(() => exerciseUnits(grade), [grade]);
  const { bests } = useExerciseBests();
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  return (
    <CornerFrame title={t('mathExTitle')} subtitle={t('mathExHint')}>
      <View style={[styles.chips, { flexDirection: row }]}>
        {EXERCISE_GRADES.map(g => {
          const on = g === grade;
          return (
            <Pressable
              key={g}
              onPress={() => router.setParams({ grade: String(g) })}
              accessibilityRole="button"
              aria-selected={on}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
            >
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                {t('hubGrade', g)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {units.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t('mathExNoLessons')}</Text>
      ) : (
        units.map(({ unit, lessons }) => (
          <View key={unit.id} style={styles.unit}>
            <Text style={[styles.unitTitle, { color: colors.mutedForeground, textAlign: align }]}>
              {lang === 'ar' ? unit.titleAr : unit.titleEn || unit.titleAr}
            </Text>
            <CornerGrid>
              {lessons.map(l => (
                <PressableScale
                  key={l.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(exerciseLessonPath(l.id) as never);
                  }}
                  accessibilityRole="button"
                  style={[styles.card, surface, { flexDirection: row }]}
                >
                  <View style={{ flex: 1, gap: SPACE.xxs }}>
                    <Text style={[styles.lessonTitle, { color: colors.foreground, textAlign: align }]}>
                      {lang === 'ar' ? l.titleAr : l.titleEn || l.titleAr}
                    </Text>
                    {bests[l.id] ? (
                      <Text style={[styles.best, { color: colors.primary, textAlign: align }]}>
                        {t('mathExBest', bests[l.id]!.correct, bests[l.id]!.total)}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
                </PressableScale>
              ))}
            </CornerGrid>
          </View>
        ))
      )}
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  chips: { flexWrap: 'wrap', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  empty: { textAlign: 'center', padding: SPACE.xl, fontFamily: 'Almarai_400Regular' },
  unit: { marginTop: SPACE.md },
  unitTitle: { paddingHorizontal: SPACE.lg, marginBottom: SPACE.xs, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  card: { flexGrow: 1, alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  lessonTitle: { fontSize: TYPE.body, fontFamily: 'ReadexPro_500Medium' },
  best: { fontSize: TYPE.caption, fontFamily: 'ReadexPro_600SemiBold' },
});
