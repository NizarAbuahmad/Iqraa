/**
 * «راجع إجاباتك» — a student's own paper after the exam: each question with
 * their answer, the correct one, the marks, and for maths the worked steps.
 *
 * Opened from a row of «اختباراتي» whose `review` is true. Whether it may open
 * at all is the server's decision (`modules/assessment/answerReview.ts`): a
 * closed exam, released results, and the teacher's «اعرض الإجابات». The
 * answers arrive as display text; this screen only lays them out.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getExamReview, type ExamReview, type ExamReviewItem } from '@/services/studentExam';
import { questionText } from '@/services/evaluationQuestionText';
import type { EvaluationQuestion } from '@/services/evaluations';
import { isolateForeignRuns } from '@/services/mathRender';
import { formatMarks } from '@/services/studentAnswers';
import { apiErrorMessage } from '@/services/apiErrorKey';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;

/** `color: null` is the theme's destructive colour, read in render. */
const VERDICT: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string | null; label: TranslationKey }> = {
  correct: { icon: 'checkmark-circle', color: palette.success, label: 'reviewCorrect' },
  partial: { icon: 'remove-circle', color: palette.warning, label: 'reviewPartial' },
  incorrect: { icon: 'close-circle', color: null, label: 'reviewIncorrect' },
  unanswered: { icon: 'ellipse-outline', color: '#667085', label: 'reviewUnanswered' },
};

export default function ExamReviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();
  const [review, setReview] = useState<ExamReview | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    if (!id) return;
    setError('');
    getExamReview(id)
      .then(setReview)
      .catch(e => setError(apiErrorMessage(e, 'reviewLoadFailed', t)));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id]);

  const title = review ? (lang === 'ar' ? review.titleAr || review.title : review.title || review.titleAr) : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {t('reviewTitle')}
        </Text>
        {title ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginTop: 4, textAlign: align }}>
            {title}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      >
        {error ? (
          <View style={{ alignItems: 'center', gap: SPACE.md, marginTop: 40 }}>
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: 'center' }}>{error}</Text>
            <Pressable onPress={load} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textDecorationLine: 'underline' }}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : !review ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : (
          review.items.map(item => (
            <ReviewCard key={item.questionId} item={item} colors={colors} isRTL={isRTL} isAr={lang === 'ar'} t={t} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ReviewCard({
  item, colors, isRTL, isAr, t,
}: {
  item: ExamReviewItem;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  isAr: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const verdict = VERDICT[item.verdict ?? ''] ?? null;
  const verdictColor = verdict?.color ?? colors.destructive;
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
        {verdict ? (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={verdict.icon} size={ICON.md} color={verdictColor} />
            <Text style={{ color: verdictColor, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t(verdict.label)}</Text>
          </View>
        ) : null}
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
  card: { borderWidth: 1, padding: SPACE.lg, gap: SPACE.md },
  num: { width: 26, height: 26, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  steps: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, gap: SPACE.xs },
});
