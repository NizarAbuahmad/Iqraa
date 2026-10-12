/**
 * When this exam is planned to be sat — the date teachers at one school see on
 * their calendars (GET /exam-calendar), so a grade is not put through two exams
 * on the same day.
 *
 * Planning data only: it does not open or close the student link. The date is
 * also what students and parents see on «اختباراتي» and the School tab, but
 * only for a published exam attached to a class — the two hints say so. The warning
 * for a day that already holds another exam for the grade is a warning, never a
 * block — the server's `clash` flag on the calendar is what stays authoritative.
 *
 * A text box, not a native picker, like the teaching-plan dates: a picker is a
 * native module, and adding one means bumping app.json's `version` (CLAUDE.md,
 * on OTA runtime versions).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { setEvaluationExamSchedule, type Evaluation } from '@/services/evaluations';
import { getExamCalendar } from '@/services/examCalendar';
import { conflictingExams, normalizeTypedDate, normalizeTypedTime } from '@/services/examCalendarModel';
import { gradeLabel } from '@/services/classSubjects';
import { isValidPlanDate } from '@/services/planEntries';
import { palette } from '@/constants/colors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

const ACCENT = palette.primary;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function ExamDateCard({
  evaluation,
  onSaved,
}: {
  evaluation: Pick<Evaluation, 'id' | 'gradeId' | 'examDate' | 'examTime' | 'classGroupId' | 'status'>;
  onSaved: () => void | Promise<unknown>;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const queryClient = useQueryClient();
  const align = isRTL ? 'right' : 'left';

  const [dateText, setDateText] = useState(evaluation.examDate ?? '');
  const [timeText, setTimeText] = useState(evaluation.examTime ?? '');
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // A refetch after saving (or a different exam) hands down the stored values.
  useEffect(() => {
    setDateText(evaluation.examDate ?? '');
    setTimeText(evaluation.examTime ?? '');
  }, [evaluation.id, evaluation.examDate, evaluation.examTime]);

  const date = normalizeTypedDate(dateText);
  const time = normalizeTypedTime(timeText);
  const dateOk = isValidPlanDate(date);
  const timeOk = time === '' || TIME_RE.test(time);
  const dateTyped = dateText.trim() !== '';

  // Ask the calendar what else sits on the typed day, once it parses as a date.
  const { data: dayExams } = useQuery({
    queryKey: ['exam-calendar', date, date],
    queryFn: () => getExamCalendar(date, date),
    enabled: dateOk,
    staleTime: 30_000,
  });
  const conflicts = dateOk && dayExams ? conflictingExams(date, evaluation.gradeId, dayExams.exams, evaluation.id) : [];

  const refreshCalendars = async () => {
    await queryClient.invalidateQueries({ queryKey: ['exam-calendar'] });
    await onSaved();
  };

  const save = async () => {
    setError('');
    setSaved(false);
    if (!dateOk) return setError(t('examDateInvalid'));
    if (!timeOk) return setError(t('examTimeInvalid'));
    setBusy('save');
    try {
      await setEvaluationExamSchedule(evaluation.id, { examDate: date, examTime: time || null });
      await refreshCalendars();
      setSaved(true);
    } catch {
      setError(t('examDateSaveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    setError('');
    setSaved(false);
    setBusy('clear');
    try {
      await setEvaluationExamSchedule(evaluation.id, { examDate: null });
      setDateText('');
      setTimeText('');
      await refreshCalendars();
    } catch {
      setError(t('examDateSaveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const input = {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    color: colors.foreground,
    fontFamily: 'Almarai_400Regular',
    fontSize: 15,
    textAlign: align,
  } as const;

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="calendar-outline" size={18} color={ACCENT} />
        <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
          {t('examDateLabel')}
        </Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>
        {t('examDateHint')}
      </Text>
      {/* Families see a date only on an exam they can see: published, in a class.
          `=== null`, not falsy: an older server that omits the field says nothing. */}
      {evaluation.classGroupId === null ? (
        <Text style={{ color: colors.warning, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>
          {t('examDateNoClassHint')}
        </Text>
      ) : evaluation.status === 'draft' && evaluation.examDate ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>
          {t('examDateDraftHint')}
        </Text>
      ) : null}

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
        <TextInput
          value={dateText}
          onChangeText={v => { setDateText(v); setSaved(false); }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t('examDateLabel')}
          style={[input, { flex: 2, borderColor: dateTyped && !dateOk ? colors.destructive : colors.border }]}
        />
        <TextInput
          value={timeText}
          onChangeText={v => { setTimeText(v); setSaved(false); }}
          placeholder="HH:MM"
          placeholderTextColor={colors.mutedForeground}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={t('examTimeLabel')}
          style={[input, { flex: 1, borderColor: !timeOk ? colors.destructive : colors.border }]}
        />
      </View>

      {conflicts.length > 0 ? (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACE.sm }}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={{ flex: 1, color: colors.warning, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>
            {t('examDateConflict', gradeLabel(evaluation.gradeId, lang), conflicts.length)}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{error}</Text>
      ) : saved ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{t('examDateSaved')}</Text>
      ) : null}

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
        <Pressable
          onPress={() => void save()}
          disabled={busy !== null || !dateTyped}
          accessibilityRole="button"
          style={[styles.btn, { backgroundColor: ACCENT, opacity: busy !== null || !dateTyped ? 0.5 : 1 }]}
        >
          {busy === 'save' ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('examDateSave')}</Text>
          )}
        </Pressable>
        {evaluation.examDate ? (
          <Pressable
            onPress={() => void clear()}
            disabled={busy !== null}
            accessibilityRole="button"
            style={[styles.btn, { borderWidth: 1.5, borderColor: colors.border, opacity: busy !== null ? 0.5 : 1 }]}
          >
            {busy === 'clear' ? <ActivityIndicator color={colors.mutedForeground} /> : (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('examDateClear')}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.xl, marginTop: SPACE.lg, padding: SPACE.lg, borderRadius: RADIUS.md, borderWidth: 1, gap: SPACE.md },
  btn: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', minWidth: 96 },
});
