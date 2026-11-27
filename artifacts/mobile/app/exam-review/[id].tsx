/**
 * «راجع إجاباتك» — a student's own paper after the exam: each question with
 * their answer, the correct one, the marks, and for maths the worked steps.
 *
 * Opened from a row of «اختباراتي» whose `review` is true. Whether it may open
 * at all is the server's decision (`modules/assessment/answerReview.ts`): a
 * closed exam, released results, and the teacher's «اعرض الإجابات» — or, for
 * an exam on «تغذية راجعة فورية», right and wrong only (`mode: 'feedback'`),
 * with the correct answers to come. The answers arrive as display text; this
 * screen only lays them out (`AnswerReviewCard`).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getExamReview, type ExamReview } from '@/services/studentExam';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { AnswerReviewCard, FeedbackAnswersLaterNote } from '@/components/AnswerReviewCard';

const ACCENT = palette.primary;

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
          {t(review?.mode === 'feedback' ? 'feedbackTitle' : 'reviewTitle')}
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
          <>
            {review.mode === 'feedback' ? <FeedbackAnswersLaterNote /> : null}
            {review.items.map(item => (
              <AnswerReviewCard key={item.questionId} item={item} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: 4, marginBottom: 8 },
});
