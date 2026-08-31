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
  setEvaluationClass,
  showBlanks,
  type Evaluation,
  type EvaluationQuestion,
  type QuestionType,
} from '@/services/evaluations';
import { summariseKeyChecks, type KeyCheckSummary } from '@/services/keyCheckSummary';
import { isolateForeignRuns } from '@/services/mathRender';
import { copyToClipboard } from '@/services/share';
import { ClassPickerSheet } from '@/components/ui/ClassPickerSheet';
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

/**
 * The one field worth showing per type, regardless of shape.
 *
 * Isolated here rather than at the render site because every branch below
 * returns model-written Arabic that can carry an equation, and an unisolated
 * «f(x) = 2x⁴ - x² + 3» comes out of the bidi algorithm reordered against the
 * Arabic around it — a wrong question, not just an ugly one.
 */
function questionText(q: EvaluationQuestion): string {
  const body = q.body;
  const template = body['template'] as string | undefined;
  return isolateForeignRuns(
    (body['stem'] as string | undefined)
    ?? (body['statement'] as string | undefined)
    ?? (template === undefined ? undefined : showBlanks(template))
    ?? (body['prompt'] as string | undefined)
    ?? '',
  );
}

export default function EvaluationDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [pickingClass, setPickingClass] = useState(false);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  // Silence used to be the answer for three different situations — keys
  // verified, verifier unreachable, nothing checkable — and a teacher cannot
  // act on silence. Derived from the questions so it survives a reload.
  const keyChecks = summariseKeyChecks(questions, evaluation?.subjectId);
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
      if (err instanceof EvaluationError) {
        setError(err.details.length ? `${err.message}:\n${err.details.join('\n')}` : err.message);
      } else {
        setError(t('evaluationPublishFailed'));
      }
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
        <ShareLinkCard
          shareCode={evaluation.shareCode ?? null}
          attachedToClass={Boolean(evaluation.classGroupId)}
          onAttach={() => setPickingClass(true)}
          colors={colors}
          isRTL={isRTL}
          align={align}
          t={t}
        />
      )}

      {/*
        Attaching was only possible from inside a class, which left the share
        card telling a teacher what was wrong and giving them nowhere to fix it.
        The same sheet the generators use handles it — it already loads the
        list, and already closes itself for a teacher who has no classes rather
        than offering an empty dialog.
      */}
      <ClassPickerSheet
        visible={pickingClass}
        onClose={() => setPickingClass(false)}
        onPick={async picks => {
          setPickingClass(false);
          // Single-pick (no `multiple`): an evaluation holds one class and has
          // no copy semantics, so there is never more than one here.
          const classId = picks[0]?.id;
          if (!id || !classId) return;
          try {
            await setEvaluationClass(id, classId);
            await load();
          } catch (err) {
            setError(err instanceof EvaluationError ? err.message : t('saveToClassFailed'));
          }
        }}
      />

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

      {keyChecks.kind !== 'silent' && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <KeyCheckNotice summary={keyChecks} colors={colors} isRTL={isRTL} align={align} t={t} />
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
            {/* Only a confirmed key is marked. Nothing is shown for the rest,
                because a "not verified" chip on most of the paper would read as
                doubt about questions the verifier never had an opinion on. */}
            {q.verification?.verified ? (
              <View style={[styles.verifiedRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <Text style={{ color: '#059669', fontFamily: 'Cairo_500Medium', fontSize: 11 }}>
                  {t('keyVerifiedBadge')}
                </Text>
              </View>
            ) : null}
            <Text
              style={[
                styles.qText,
                {
                  color: colors.foreground,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: align,
                  writingDirection: isRTL ? 'rtl' : 'ltr',
                },
              ]}
            >
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

/**
 * The link a teacher writes on the board.
 *
 * Shows the code large enough to read from the back of a classroom, because
 * that is literally what happens to it. The full URL is there to copy into
 * WhatsApp; the code is there for the board.
 *
 * An exam not attached to a class has a code that cannot work — the roster a
 * student picks their name from *is* the class. Rather than hide the card or
 * show a link that 404s, it says which step is missing.
 */
/**
 * One notice, three states, deliberately three different tones.
 *
 * Green is a claim: SymPy confirmed these keys. Amber is an outage the teacher
 * can retry, and its most important word is that nothing was removed. Grey is
 * not a complaint about the paper at all — most questions have no symbolic
 * answer, and a paper of them is perfectly good. None of the three may read as
 * "these answers are wrong": a key the verifier contradicts is dropped during
 * generation and never reaches this screen.
 */
function KeyCheckNotice({
  summary, colors, isRTL, align, t,
}: {
  summary: KeyCheckSummary;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const tone = summary.kind === 'verified'
    ? { fg: '#059669', bg: '#05966912', border: '#05966933', icon: 'shield-checkmark' as const }
    : summary.kind === 'verifier-down'
      ? { fg: '#B45309', bg: '#F59E0B14', border: '#F59E0B38', icon: 'cloud-offline-outline' as const }
      : { fg: colors.mutedForeground, bg: colors.card, border: colors.border, icon: 'information-circle-outline' as const };

  const title = summary.kind === 'verified'
    ? t('keysVerifiedSummary', String(summary.verified), String(summary.total))
    : summary.kind === 'verifier-down'
      ? t('keysVerifierDownTitle')
      : t('keysNoneCheckableTitle');

  const note = summary.kind === 'verified'
    ? t('keysVerifiedNote')
    : summary.kind === 'verifier-down'
      ? t('keysVerifierDownNote')
      : t('keysNoneCheckableNote');

  return (
    <View style={[styles.verifySummary, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={tone.icon} size={15} color={tone.fg} />
        <Text style={{ flex: 1, color: tone.fg, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, textAlign: align }}>
          {title}
        </Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, marginTop: 4, textAlign: align, lineHeight: 18 }}>
        {note}
      </Text>
    </View>
  );
}

function ShareLinkCard({
  shareCode, attachedToClass, onAttach, colors, isRTL, align, t,
}: {
  shareCode: string | null;
  attachedToClass: boolean;
  onAttach: () => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const [copied, setCopied] = useState(false);
  if (!shareCode) return null;

  // Built from where the app is actually being served, so a local build hands
  // out a local link and production hands out a production one. Hardcoding it
  // is how a pilot ends up telling thirty students to visit localhost.
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const url = `${origin}/take/${shareCode}`;

  return (
    <View style={{ marginHorizontal: 20, marginTop: 16 }}>
      <View style={[styles.shareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
          {t('shareExamTitle')}
        </Text>

        {!attachedToClass ? (
          <>
            <Text style={{ color: '#F59E0B', fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 8, textAlign: align }}>
              {t('shareExamNeedsClass')}
            </Text>
            {/* Naming the problem without offering the fix is what made this a
                dead end — the only way to attach was from inside the class. */}
            <Pressable
              onPress={onAttach}
              style={[styles.shareBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="people-outline" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                {t('shareExamAttachNow')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 4, textAlign: align }}>
              {t('shareExamHint')}
            </Text>
            <Text
              selectable
              style={{ color: ACCENT, fontFamily: 'Cairo_700Bold', fontSize: 34, letterSpacing: 4, textAlign: 'center', marginVertical: 12 }}
            >
              {shareCode}
            </Text>
            <Text selectable style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: 'center' }}>
              {url}
            </Text>
            <Pressable
              onPress={async () => {
                await copyToClipboard(url);
                setCopied(true);
              }}
              style={[styles.shareBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                {t(copied ? 'copiedToClipboard' : 'shareExamCopyLink')}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
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
  verifiedRow: { alignItems: 'center', gap: 5, marginBottom: 6 },
  verifySummary: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  actionBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 10 },
  actionBtnOutline: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, marginBottom: 10 },
  shareCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  shareBtn: { alignSelf: 'center', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  enterAnswersBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  resultsBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5 },
});
