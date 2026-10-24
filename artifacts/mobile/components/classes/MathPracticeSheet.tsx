/**
 * «تمارين الرياضيات» for one class, from `GET /classes/:id/math-practice`, in two views:
 * - «حسب الدرس»: every lesson of the class's grade the Math Corner covers, in book
 *   order, with how many students practised it and their average best score, or
 *   «لم يتدرّب أحد» — and a filter to only those (`practiceByLesson`). Shown first
 *   when the class has a grade with exercises.
 * - «حسب الطالب»: each student's best score per lesson they practised.
 * Opened from the class's students tab; loads when opened; read-only, so no text
 * input and no KeyboardSafeView. Lesson titles come from the knowledge base by id.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { toArabicDigits } from '@/services/labFormat';
import { gameScoreText } from '@/services/homework';
import { countStudents } from '@/services/i18n';
import { getLessonById } from '@/services/knowledgeBase';
import { exerciseGradeOfClass, practiceByLesson, practiceByStudent, type ClassPracticeRow } from '@/services/mathExercises';
import { fetchClassPractice } from '@/services/mathExerciseProgress';

type SheetView = 'lesson' | 'student';

export function MathPracticeSheet({
  classId,
  gradeId,
  onClose,
}: {
  /** Null = closed. */
  classId: string | null;
  /** The class's grade (`grade-5`); the by-lesson view needs one with exercises. */
  gradeId: string | null | undefined;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const digits = (s: string) => (isRTL ? toArabicDigits(s) : s);
  const grade = exerciseGradeOfClass(gradeId);
  const [rows, setRows] = useState<ClassPracticeRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [picked, setView] = useState<SheetView>('lesson');
  // The class's grade can arrive after the sheet mounts; without one there is no lesson list.
  const view: SheetView = grade ? picked : 'student';
  const [onlyNobody, setOnlyNobody] = useState(false);

  useEffect(() => {
    if (!classId) return;
    let live = true;
    setRows(null);
    setFailed(false);
    fetchClassPractice(classId).then(
      r => {
        if (live) setRows(r);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [classId, attempt]);

  const byLesson = useMemo(() => (rows && grade ? practiceByLesson(rows, grade) : null), [rows, grade]);

  const lessonTitle = (id: string) => {
    const l = getLessonById(id);
    return l ? (lang === 'ar' ? l.titleAr : l.titleEn || l.titleAr) : id;
  };

  const tabs = grade ? (
    <View style={[styles.tabs, { flexDirection: rowDir }]}>
      {(['lesson', 'student'] as const).map(v => {
        const on = v === view;
        return (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="button"
            aria-selected={on}
            style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
          >
            <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
              {t(v === 'lesson' ? 'mathPracticeByLesson' : 'mathPracticeByStudent')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  const lessonView = byLesson ? (
    <>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
        {digits(t('mathPracticeCoverage', byLesson.practisedLessons, byLesson.totalLessons))}
      </Text>
      <View style={[styles.filter, { flexDirection: rowDir }]}>
        <Switch value={onlyNobody} onValueChange={setOnlyNobody} accessibilityLabel={t('mathPracticeOnlyNobody')} />
        <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
          {t('mathPracticeOnlyNobody')}
        </Text>
      </View>
      {onlyNobody && byLesson.practisedLessons === byLesson.totalLessons ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: 'center', paddingVertical: SPACE.xl }}>
          {t('mathPracticeAllPractised')}
        </Text>
      ) : null}
      {byLesson.units.map(({ unit, lessons }) => {
        const shown = onlyNobody ? lessons.filter(l => l.practised === 0) : lessons;
        if (shown.length === 0) return null;
        return (
          <View key={unit.id} style={{ gap: SPACE.xs }}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: align, marginTop: SPACE.sm }}>
              {lang === 'ar' ? unit.titleAr : unit.titleEn || unit.titleAr}
            </Text>
            {shown.map(l => (
              <View key={l.lesson.id} style={[styles.lessonRow, { borderColor: colors.border, flexDirection: rowDir }]}>
                <Text numberOfLines={2} style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {lang === 'ar' ? l.lesson.titleAr : l.lesson.titleEn || l.lesson.titleAr}
                </Text>
                <Text
                  style={{
                    color: l.averagePct === null ? colors.mutedForeground : colors.primary,
                    fontFamily: l.averagePct === null ? 'Almarai_400Regular' : 'ReadexPro_600SemiBold',
                    fontSize: TYPE.caption,
                  }}
                >
                  {l.averagePct === null ? t('mathPracticeNobody') : digits(t('mathPracticeAverage', countStudents(l.practised, lang), l.averagePct))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </>
  ) : null;

  const studentView =
    rows && rows.length === 0 ? (
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: 'center', paddingVertical: SPACE.xl }}>
        {t('mathPracticeEmpty')}
      </Text>
    ) : (
      practiceByStudent(rows ?? []).map(s => (
        <View key={s.studentId} style={[styles.student, { borderColor: colors.border }]}>
          <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: align }}>
            {s.displayName}
          </Text>
          {s.lessons.map(r => (
            <View key={r.lessonId} style={[styles.lesson, { flexDirection: rowDir }]}>
              <View style={{ flex: 1, gap: SPACE.xxs }}>
                <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {lessonTitle(r.lessonId)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, textAlign: align }}>
                  {digits(t('hwGameAttempts', r.attempts))}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>
                {gameScoreText(r.correct, r.total, isRTL)}
              </Text>
            </View>
          ))}
        </View>
      ))
    );

  return (
    <Modal visible={classId !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align }}>
            {t('mathPracticeTitle')}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
            {t('mathPracticeHint')}
          </Text>
          {tabs}
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: SPACE.sm }} showsVerticalScrollIndicator={false}>
            {failed ? (
              <View style={{ alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xl }}>
                <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body }}>{t('mathPracticeFailed')}</Text>
                <Pressable onPress={() => setAttempt(a => a + 1)} accessibilityRole="button" hitSlop={8}>
                  <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textDecorationLine: 'underline' }}>{t('retry')}</Text>
                </Pressable>
              </View>
            ) : rows === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: SPACE.xl }} />
            ) : view === 'lesson' && lessonView ? (
              lessonView
            ) : (
              studentView
            )}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>{t('libraryPickerDone')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  card: { width: '100%', maxWidth: 480, borderRadius: RADIUS.lg, padding: SPACE.xl, gap: SPACE.md },
  tabs: { gap: SPACE.sm },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, minHeight: 36, justifyContent: 'center' },
  filter: { alignItems: 'center', gap: SPACE.sm },
  lessonRow: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  student: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm },
  lesson: { alignItems: 'center', gap: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
});
