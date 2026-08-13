/**
 * Evaluation detail — review the generated questions and publish.
 *
 * Read-only: editing an individual question (retype the stem, fix an option,
 * change its marks) is the authoring-UI work this pass doesn't build. What's
 * here is enough to see what was generated, understand why a requested type
 * didn't show up, and publish so the evaluation becomes reachable by the
 * attempts API that already exists.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import {
  EvaluationError,
  generateEvaluation,
  getEvaluation,
  publishEvaluation,
  type Evaluation,
  type EvaluationQuestion,
  type QuestionType,
} from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

const STATUS_KEY: Record<Evaluation['status'], TranslationKey> = {
  draft: 'evalStatusDraft',
  published: 'evalStatusPublished',
  closed: 'evalStatusClosed',
};
const STATUS_COLOR: Record<Evaluation['status'], string> = {
  draft: '#F59E0B',
  published: '#10B981',
  closed: '#6B7280',
};
const TYPE_LABEL_KEY: Record<QuestionType, TranslationKey> = {
  multiple_choice: 'typeMultipleChoice',
  true_false: 'typeTrueFalse',
  matching: 'typeMatching',
  fill_blank: 'typeFillBlank',
  short_answer: 'typeShortAnswer',
  open_ended: 'typeOpenEnded',
  problem_solving: 'typeProblemSolving',
  practical_task: 'typePracticalTask',
};

/** The one field worth showing per type, regardless of shape. */
function questionText(q: EvaluationQuestion): string {
  const body = q.body;
  return (
    (body['stem'] as string | undefined)
    ?? (body['statement'] as string | undefined)
    ?? (body['template'] as string | undefined)
    ?? (body['prompt'] as string | undefined)
    ?? ''
  );
}

export default function EvaluationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'generate' | 'publish' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const data = await getEvaluation(id);
      setEvaluation(data.evaluation);
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof EvaluationError ? err.message : t('evaluationLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRegenerate = async () => {
    if (!id || busy) return;
    setBusy('generate');
    setError('');
    try {
      await generateEvaluation(id);
      await load();
    } catch (err) {
      setError(err instanceof EvaluationError ? err.message : t('evaluationGenerateFailed'));
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    if (!id || busy || questions.length === 0) return;
    const ok = await confirm({
      title: t('publishEvaluationBtn'),
      confirmLabel: t('publishEvaluationBtn'),
      cancelLabel: t('cancel'),
    });
    if (!ok) return;

    setBusy('publish');
    setError('');
    try {
      const updated = await publishEvaluation(id);
      setEvaluation(updated);
    } catch (err) {
      setError(err instanceof EvaluationError ? err.message : t('evaluationPublishFailed'));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]} numberOfLines={2}>
          {evaluation ? (lang === 'ar' ? evaluation.titleAr : evaluation.title) || t('newEvaluation') : ''}
        </Text>
        {evaluation && (
          <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>
                {t(STATUS_KEY[evaluation.status])}
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
              {t('evalQuestionCount', questions.length)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
              {t('evalTotalMarks', evaluation.totalMarks)}
            </Text>
          </View>
        )}
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.destructive, margin: 20, marginBottom: 0 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
            {error}
          </Text>
        </View>
      ) : null}

      {evaluation?.status === 'published' && (
        <View style={{ marginHorizontal: 20, marginTop: 16, gap: 10 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/evaluations/[id]/answers', params: { id: evaluation.id } })}
            style={[styles.enterAnswersBtn, { backgroundColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
              {t('enterAnswersBtn')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/evaluations/[id]/results', params: { id: evaluation.id } })}
            style={[styles.resultsBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="bar-chart-outline" size={18} color={ACCENT} />
            <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
              {t('resultsDashboardBtn')}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ padding: 20, gap: 10 }}>
        {questions.map((q, i) => (
          <View key={q.id} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.qTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.qNum, { backgroundColor: ACCENT }]}>
                <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: ACCENT + '18' }]}>
                <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>
                  {t(TYPE_LABEL_KEY[q.type])}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
                {t('marksAbbrev', q.marks)}
              </Text>
            </View>
            <Text style={[styles.qText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {questionText(q) || '—'}
            </Text>
          </View>
        ))}
      </View>

      {evaluation?.status === 'draft' && (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Pressable
            onPress={onPublish}
            disabled={!!busy || questions.length === 0}
            style={[styles.actionBtn, { backgroundColor: ACCENT, opacity: !!busy || questions.length === 0 ? 0.6 : 1 }]}
          >
            {busy === 'publish' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
                {t('publishEvaluationBtn')}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={onRegenerate}
            disabled={!!busy}
            style={[styles.actionBtnOutline, { borderColor: ACCENT, opacity: !!busy ? 0.6 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            {busy === 'generate' ? (
              <ActivityIndicator color={ACCENT} size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color={ACCENT} />
                <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
                  {t('regenerateQuestionsBtn')}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  headerTitle: { fontSize: 20, color: '#fff' },
  metaRow: { alignItems: 'center', gap: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  qCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  qTop: { alignItems: 'center', gap: 8, marginBottom: 8 },
  qNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  qText: { fontSize: 14, lineHeight: 20 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 10 },
  actionBtnOutline: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, marginBottom: 10 },
  enterAnswersBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  resultsBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5 },
});
