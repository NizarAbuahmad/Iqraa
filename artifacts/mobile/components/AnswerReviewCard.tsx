/**
 * One question of a student's own paper after hand-in: the verdict, the marks,
 * the question, their answer and — only when the server sent it — the correct
 * answer and the worked steps.
 *
 * Shared by «راجع إجاباتك» (`app/exam-review/[id].tsx`) and the hand-in screen
 * (`app/take/[code].tsx`), which shows the same cards for an exam on «تغذية
 * راجعة فورية». What a card may show is the server's decision
 * (`modules/assessment/answerReview.ts`): in feedback mode `correctAnswer` and
 * `steps` arrive null, so this lays out what it is given and nothing more.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { ExamReviewItem } from '@/services/studentExam';
import { questionText } from '@/services/evaluationQuestionText';
import type { EvaluationQuestion } from '@/services/evaluations';
import { isolateForeignRuns } from '@/services/mathRender';
import { formatMarks } from '@/services/studentAnswers';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

const ACCENT = palette.primary;

/** `color: null` is the theme's destructive colour, read in render. */
const VERDICT: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string | null; label: TranslationKey }> = {
  correct: { icon: 'checkmark-circle', color: palette.success, label: 'reviewCorrect' },
  partial: { icon: 'remove-circle', color: palette.warning, label: 'reviewPartial' },
  incorrect: { icon: 'close-circle', color: null, label: 'reviewIncorrect' },
  unanswered: { icon: 'ellipse-outline', color: '#667085', label: 'reviewUnanswered' },
};

/** No verdict yet: a question the teacher marks by hand, still unmarked. */
const AWAITING = { icon: 'time-outline' as const, color: '#667085', label: 'reviewAwaitingTeacher' as TranslationKey };

export function AnswerReviewCard({ item }: { item: ExamReviewItem }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const align = isRTL ? 'right' : 'left';
  const verdict = VERDICT[item.verdict ?? ''] ?? AWAITING;
  const verdictColor = verdict.color ?? colors.destructive;
  const text = questionText({ type: item.type, body: item.body, expectedAnswer: {} } as unknown as EvaluationQuestion, isAr);
  const row = (label: TranslationKey, value: string | null, color: string) => (
    <View style={{ gap: 2 }}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: align }}>{t(label)}</Text>
      <Text style={{ color, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }}>
        {value ? isolateForeignRuns(value) : t('reviewNoAnswer')}
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.num, { backgroundColor: ACCENT }]}>
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.micro }}>{item.number}</Text>
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={verdict.icon} size={ICON.md} color={verdictColor} />
          <Text style={{ color: verdictColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t(verdict.label)}</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
          {item.awardedMarks === null
            ? t('marksAbbrev', formatMarks(item.maxMarks))
            : `${formatMarks(item.awardedMarks)} / ${formatMarks(item.maxMarks)}`}
        </Text>
      </View>

      <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }}>
        {text || '—'}
      </Text>

      {item.type === 'read_aloud' ? null : row('reviewYourAnswer', item.yourAnswer, colors.foreground)}
      {item.correctAnswer ? row('reviewCorrectAnswer', item.correctAnswer, palette.success) : null}

      {item.steps ? (
        <View style={[styles.steps, { backgroundColor: ACCENT + '0D', borderColor: ACCENT + '33' }]}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: align }}>{t('workedStepsTitle')}</Text>
          {item.steps.map((step, n) => (
            <Text key={n} style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' }}>
              {isolateForeignRuns(`${n + 1}. ${step}`)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The line above a feedback-mode list: the correct answers come later. */
export function FeedbackAnswersLaterNote() {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  return (
    <View style={[styles.note, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Ionicons name="information-circle" size={ICON.md} color={colors.mutedForeground} />
      <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' }}>
        {t('feedbackAnswersLater')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: SPACE.lg, gap: SPACE.md },
  num: { width: 26, height: 26, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  steps: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, gap: SPACE.xs },
  note: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm, alignItems: 'center' },
});
