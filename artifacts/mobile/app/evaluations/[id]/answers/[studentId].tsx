/**
 * Answer entry for one student — the teacher types or taps in what the
 * student wrote on paper, then submits for grading.
 *
 * Starting the screen finds-or-creates the attempt (idempotent — reopening a
 * student mid-register is the normal flow, not a retry). Each answer saves as
 * it's entered rather than in one batch at the end, so a dropped connection
 * loses at most the field being edited, not the whole sitting.
 *
 * Four of the eight types (multiple choice, true/false, matching, fill-blank)
 * mark themselves on submit. The other four have no automatic grader — Tier 3
 * (AI rubric grading) does not exist — so the teacher marks them here: a mark
 * box and a comment box under every question. The server never guesses a mark
 * from a blank, so a question left unmarked keeps the result provisional
 * rather than scoring the student zero.
 *
 * A mark the teacher types wins over the machine's, and re-submitting does not
 * wipe it — see the note on the submit route.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { copyToClipboard, formatAttemptResultText, shareAsText } from '@/services/share';
import { scopePickerParams } from '@/services/lessonPrep';
import { pickMarkSheetPhoto } from '@/services/documents/pick';
import { Toast } from '@/components/ui/Toast';
import {
  EvaluationError,
  countBlanks,
  getAttempt,
  saveAnswer,
  scanMarks,
  setQuestionGrade,
  setTeacherComment,
  showBlanks,
  startAttempt,
  submitAttempt,
  type AttemptEvaluationSummary,
  type AttemptQuestionGrade,
  type AttemptResult,
  type CompetencyKey,
  type EvaluationQuestion,
  type Grader,
  type LevelKey,
  type Recommendation,
  type RecommendationKind,
} from '@/services/evaluations';
import { isolateForeignRuns } from '@/services/mathRender';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

const LEVEL_KEY: Record<LevelKey, TranslationKey> = {
  beginner: 'levelBeginner',
  developing: 'levelDeveloping',
  proficient: 'levelProficient',
  advanced: 'levelAdvanced',
};
const LEVEL_COLOR: Record<LevelKey, string> = {
  beginner: '#EF4444',
  developing: '#F59E0B',
  proficient: '#10B981',
  advanced: '#059669',
};
const COMPETENCY_ORDER: CompetencyKey[] = ['knowledge', 'understanding', 'application', 'critical_thinking'];
const COMPETENCY_KEY: Record<CompetencyKey, TranslationKey> = {
  knowledge: 'competencyKnowledge',
  understanding: 'competencyUnderstanding',
  application: 'competencyApplication',
  critical_thinking: 'competencyCriticalThinking',
};

type Response = Record<string, unknown>;

/**
 * A question from an exam the app never wrote: no prompt, nothing to
 * transcribe. Tested on the body rather than on `gradingMode`, so a manually
 * graded question that *does* carry its own text still renders it.
 */
function isPaperQuestion(question: EvaluationQuestion): boolean {
  return !((question.body?.['prompt'] as string) ?? '').trim();
}

/**
 * The mark and comment as they sit in the boxes, before they're saved.
 * `saved` is the last value the server accepted — a rejected edit reverts to
 * it, so the box can never sit there showing a mark that was refused.
 */
type GradeDraft = { marks: string; note: string; saved: string; grader?: Grader };

/**
 * Only a teacher's own comment is loaded back into the comment box. A machine
 * grade's `rationaleAr` is the grader's sentence ("إجابة صحيحة"), and putting
 * that in the teacher's box would make them the author of a line they never
 * wrote the moment they saved anything else on that question.
 */
function gradeDrafts(rows: AttemptQuestionGrade[]): Record<string, GradeDraft> {
  return Object.fromEntries(
    rows.map(g => [
      g.questionId,
      {
        marks: String(Number(g.awardedMarks)),
        note: g.grader === 'teacher' ? g.rationaleAr ?? '' : '',
        saved: String(Number(g.awardedMarks)),
        grader: g.grader,
      },
    ]),
  );
}

export default function AnswerEntryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id, studentId } = useLocalSearchParams<{ id: string; studentId: string }>();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [studentName, setStudentName] = useState('');
  const [evaluationTitle, setEvaluationTitle] = useState('');
  const [answers, setAnswers] = useState<Record<string, Response>>({});
  const [grades, setGrades] = useState<Record<string, GradeDraft>>({});
  const [comment, setComment] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [nextSteps, setNextSteps] = useState<Recommendation[]>([]);
  const [scope, setScope] = useState<AttemptEvaluationSummary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  useEffect(() => {
    if (!id || !studentId) return;
    (async () => {
      try {
        const attempt = await startAttempt(id, studentId);
        const data = await getAttempt(attempt.id);
        setAttemptId(attempt.id);
        setQuestions(data.questions);
        setStudentName(data.student.displayName);
        setEvaluationTitle(lang === 'ar' ? data.evaluation.titleAr : data.evaluation.title);
        setScope(data.evaluation);
        setNextSteps(data.recommendations ?? []);
        setAnswers(Object.fromEntries(data.answers.map(a => [a.questionId, a.response])));
        setGrades(gradeDrafts(data.grades));
        setComment(data.attempt.teacherComment ?? '');
        setResult(data.result);
      } catch (err) {
        setError(err instanceof EvaluationError ? err.message : t('attemptLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, studentId]);

  const setAnswer = useCallback((questionId: string, response: Response) => {
    setAnswers(prev => ({ ...prev, [questionId]: response }));
  }, []);

  const persist = useCallback((questionId: string, response: Response) => {
    if (!attemptId) return;
    saveAnswer(attemptId, questionId, response).catch(() => showToast(t('attemptLoadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const setGradeField = useCallback((questionId: string, patch: Partial<GradeDraft>) => {
    setGrades(prev => {
      const current: GradeDraft = prev[questionId] ?? { marks: '', note: '', saved: '' };
      return { ...prev, [questionId]: { ...current, ...patch } };
    });
  }, []);

  /**
   * Saves on blur, not on every keystroke: a mark is one short field and a
   * half-typed "1" out of "12" is a mark the server would accept as real.
   */
  const commitGrade = useCallback(
    async (question: EvaluationQuestion, marks: string, note: string) => {
      if (!attemptId) return;
      if (marks.trim() === '') return;
      const max = Number(question.marks);
      const value = Number(marks.trim());
      if (!Number.isFinite(value) || value < 0 || value > max) {
        showToast(t('markOutOfRange', String(max)));
        // Put the accepted mark back in the box. Leaving the refused one on
        // screen reads as saved once the toast fades.
        setGrades(prev => {
          const current = prev[question.id];
          return current ? { ...prev, [question.id]: { ...current, marks: current.saved } } : prev;
        });
        return;
      }
      try {
        const res = await setQuestionGrade(attemptId, question.id, { awardedMarks: value, note });
        setGradeField(question.id, { grader: 'teacher', saved: String(value) });
        setResult(res.result);
        setNextSteps(res.recommendations ?? []);
      } catch {
        showToast(t('markSaveFailed'));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attemptId, setGradeField],
  );

  /**
   * Fill the mark boxes from a photo of the paper.
   *
   * Nothing is saved here — the proposals go into the boxes and the teacher
   * confirms each one the way they would if they had typed it. That is the
   * point: a misread cannot become a mark without a person seeing the number.
   *
   * Questions the scan could not read are left **empty**, never zero, and the
   * teacher is told how many still need them.
   */
  const onScanMarks = useCallback(async () => {
    if (!attemptId || scanning) return;
    const image = await pickMarkSheetPhoto();
    if (!image) return;
    setScanning(true);
    setError('');
    try {
      const res = await scanMarks(attemptId, image);
      if (res.proposals.length === 0) {
        showToast(t('scanFoundNothing'));
        return;
      }
      setGrades(prev => {
        const next = { ...prev };
        for (const p of res.proposals) {
          const current: GradeDraft = next[p.questionId] ?? { marks: '', note: '', saved: '' };
          // `saved` is left alone deliberately: these are not saved yet, and
          // a rejected edit must still revert to the last accepted mark.
          next[p.questionId] = { ...current, marks: String(p.awardedMarks) };
        }
        return next;
      });
      showToast(
        res.skipped.length > 0
          ? t('scanFilledSome', String(res.proposals.length), String(res.skipped.length))
          : t('scanFilledAll', String(res.proposals.length)),
      );
    } catch (err) {
      // The API answers in English, and this screen is Arabic. Every failure
      // here carries a code precisely so the teacher is told what to do in
      // their own language instead of being shown the server's sentence —
      // which is what production did on the first real scan.
      const code = err instanceof EvaluationError ? err.code : '';
      setError(
        code === 'image_too_large' || code === 'payload_too_large'
          ? t('scanTooLarge')
          : code === 'live_mode_off'
            ? t('scanUnavailable')
            : code === 'user_quota_exceeded' || code === 'budget_exceeded'
              ? t('scanBudgetSpent')
              : t('scanFailed'),
      );
    } finally {
      setScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, scanning]);

  const commitComment = useCallback(
    async (value: string) => {
      if (!attemptId) return;
      try {
        await setTeacherComment(attemptId, value);
      } catch {
        showToast(t('commentSaveFailed'));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attemptId],
  );

  const onSubmit = async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await submitAttempt(attemptId);
      // Re-read rather than patching state from the response: submit returns
      // only the marks it produced, and the machine may have just replaced a
      // rationale on a question the teacher had already looked at.
      const data = await getAttempt(attemptId);
      setGrades(gradeDrafts(data.grades));
      setResult(data.result);
      setNextSteps(data.recommendations ?? []);
      // The result card is at the top of the page and the button is at the
      // bottom, so a successful submit changed nothing where the teacher was
      // looking — it read as a button that did nothing. Say so, then take them
      // to the thing that changed.
      showToast(t('attemptGradedToast'));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err) {
      setError(err instanceof EvaluationError ? err.message : t('attemptSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const resultText = useMemo(
    () => (result ? formatAttemptResultText(result, studentName, evaluationTitle, lang === 'ar') : ''),
    [result, studentName, evaluationTitle, lang],
  );

  const onCopy = async () => {
    await copyToClipboard(resultText);
    showToast(t('copiedToClipboard'));
  };
  const onShare = async () => {
    const outcome = await shareAsText(resultText, evaluationTitle || t('resultTitle'));
    if (outcome === 'copied') showToast(t('copiedToClipboard'));
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>{studentName}</Text>
          <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align, color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
            {evaluationTitle}
          </Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.destructive, margin: 20, marginBottom: 0 }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
              {error}
            </Text>
          </View>
        ) : null}

        {result && (
          <ResultCard
            result={result}
            colors={colors}
            isRTL={isRTL}
            align={align}
            t={t}
            onCopy={onCopy}
            onShare={onShare}
          />
        )}

        {nextSteps.length > 0 && (
          <NextStepsCard
            recommendations={nextSteps}
            scope={scope}
            colors={colors}
            isRTL={isRTL}
            align={align}
            lang={lang}
            t={t}
          />
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Pressable
            onPress={onScanMarks}
            disabled={scanning}
            style={[styles.scanBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: scanning ? 0.6 : 1 }]}
          >
            {scanning ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Ionicons name="camera-outline" size={18} color={ACCENT} />
            )}
            <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
              {scanning ? t('scanReading') : t('scanMarksBtn')}
            </Text>
          </Pressable>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, marginTop: 6, textAlign: align }}>
            {t('scanMarksHint')}
          </Text>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          {questions.map((q, i) => (
            <QuestionInput
              key={q.id}
              index={i}
              question={q}
              response={answers[q.id] ?? {}}
              onChange={r => setAnswer(q.id, r)}
              onCommit={r => persist(q.id, r)}
              grade={grades[q.id]}
              onGradeChange={patch => setGradeField(q.id, patch)}
              onGradeCommit={(marks, note) => commitGrade(q, marks, note)}
              colors={colors}
              isRTL={isRTL}
              align={align}
              t={t}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align, marginBottom: 8 }}>
            {t('performanceCommentLabel')}
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            onBlur={() => commitComment(comment)}
            placeholder={t('performanceCommentPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.commentBox, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign: align, fontFamily: 'Almarai_400Regular' }]}
          />
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Pressable
            onPress={onSubmit}
            disabled={submitting || questions.length === 0}
            style={[styles.submitBtn, { backgroundColor: ACCENT, opacity: submitting ? 0.7 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
                {t('submitAndGradeBtn')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

function ResultCard({
  result, colors, isRTL, align, t, onCopy, onShare,
}: {
  result: AttemptResult;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
  onCopy: () => void;
  onShare: () => void;
}) {
  const noMarks = Number(result.totalMarks) <= 0;
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.resultTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16 }]}>
            {t('resultTitle')}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 14, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
            <Pressable onPress={onCopy} hitSlop={8} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="copy-outline" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>{t('iqraCopyMessage')}</Text>
            </Pressable>
            <Pressable onPress={onShare} hitSlop={8} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="share-outline" size={16} color={ACCENT} />
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>{t('exportShare')}</Text>
            </Pressable>
          </View>
        </View>

        {noMarks ? (
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 10, textAlign: align }]}>
            {t('noGradedQuestionsYet')}
          </Text>
        ) : (
          <>
            <View style={[styles.levelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {result.levelKey && (
                <View style={[styles.levelPill, { backgroundColor: LEVEL_COLOR[result.levelKey] + '20' }]}>
                  <Text style={{ color: LEVEL_COLOR[result.levelKey], fontFamily: 'Cairo_700Bold', fontSize: 14 }}>
                    {t(LEVEL_KEY[result.levelKey])}
                  </Text>
                </View>
              )}
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
                {t('resultPercentLabel', result.percent)}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
                {result.earnedMarks} / {result.totalMarks}
              </Text>
            </View>
            {result.isProvisional && (
              <Text style={[{ color: '#F59E0B', fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 8, textAlign: align }]}>
                {t('provisionalResultNote')}
              </Text>
            )}
            <View style={{ marginTop: 12, gap: 6 }}>
              {COMPETENCY_ORDER.map(key => {
                const c = result.competencyScores[key];
                return (
                  <View key={key} style={[styles.competencyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>
                      {t(COMPETENCY_KEY[key])}
                    </Text>
                    <Text style={{ color: c?.sufficient ? colors.foreground : colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                      {c?.sufficient ? `${c.percent}%` : t('insufficientEvidence')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const KIND_LABEL: Record<RecommendationKind, TranslationKey> = {
  review: 'recKindReview',
  practice: 'recKindPractice',
  activity: 'recKindActivity',
  reassess: 'recKindReassess',
};
const KIND_ICON: Record<RecommendationKind, keyof typeof Ionicons.glyphMap> = {
  review: 'refresh-outline',
  practice: 'create-outline',
  activity: 'bulb-outline',
  reassess: 'repeat-outline',
};

/**
 * What to teach next, from the marks just entered.
 *
 * The generator opens **scoped to this exam's grade and subject**, resolved
 * from the evaluation rather than left at the picker's first entry — a tool
 * that opens offering grade-1 material for a grade-10 gap is worse than one
 * that does not open at all. When the scope cannot be resolved the button is
 * not shown, rather than shown and wrong.
 */
function NextStepsCard({
  recommendations, scope, colors, isRTL, align, lang, t,
}: {
  recommendations: Recommendation[];
  scope: AttemptEvaluationSummary | null;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  lang: string;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  // Indices against the same bare picker lists the worksheet screen rebuilds —
  // see scopePickerParams: a grade-filtered list here would drift from the
  // receiver the day INVESTOR_MVP_CURRICULUM stops flattening the argument.
  const pickerParams = scope ? scopePickerParams(scope.gradeId, scope.subjectId) : null;
  const canGenerate = pickerParams !== null;

  const openWorksheet = (topic: string) => {
    router.push({
      pathname: '/ai-tools/worksheet',
      params: { topic, ...pickerParams },
    });
  };

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: align }}>
          {t('nextStepsTitle')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 4, textAlign: align }}>
          {t('nextStepsSubtitle')}
        </Text>

        <View style={{ marginTop: 12, gap: 12 }}>
          {recommendations.map(rec => {
            const title =
              (lang === 'ar' ? rec.payload.objectiveTitleAr : rec.payload.objectiveTitle) ||
              rec.payload.objectiveTitleAr ||
              rec.payload.objectiveTitle;
            return (
              <View key={rec.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={KIND_ICON[rec.kind]} size={15} color={ACCENT} />
                  <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
                    {t(KIND_LABEL[rec.kind])}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                    {t('recEvidence', String(rec.payload.percent), String(rec.payload.marksLost))}
                  </Text>
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                  {title}
                </Text>
                {canGenerate && rec.kind !== 'reassess' && title ? (
                  <Pressable
                    onPress={() => openWorksheet(title)}
                    style={[styles.recBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                  >
                    <Ionicons name="document-text-outline" size={14} color={ACCENT} />
                    <Text style={{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>
                      {t('recBuildWorksheet')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function QuestionInput({
  index, question, response, onChange, onCommit, grade, onGradeChange, onGradeCommit, colors, isRTL, align, t,
}: {
  index: number;
  question: EvaluationQuestion;
  response: Response;
  onChange: (r: Response) => void;
  onCommit: (r: Response) => void;
  grade: GradeDraft | undefined;
  onGradeChange: (patch: Partial<GradeDraft>) => void;
  onGradeCommit: (marks: string, note: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const body = question.body;

  return (
    <View style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.qTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.qNum, { backgroundColor: ACCENT }]}>
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 12 }}>{index + 1}</Text>
        </View>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
          {t('marksAbbrev', question.marks)}
        </Text>
      </View>

      {question.type === 'multiple_choice' && (
        <MultipleChoiceInput body={body} response={response} onChange={r => { onChange(r); onCommit(r); }} colors={colors} isRTL={isRTL} align={align} />
      )}
      {question.type === 'true_false' && (
        <TrueFalseInput body={body} response={response} onChange={r => { onChange(r); onCommit(r); }} colors={colors} isRTL={isRTL} align={align} t={t} />
      )}
      {question.type === 'matching' && (
        <MatchingInput body={body} response={response} onChange={r => { onChange(r); onCommit(r); }} colors={colors} isRTL={isRTL} align={align} t={t} />
      )}
      {question.type === 'fill_blank' && (
        <FillBlankInput body={body} response={response} onChange={onChange} onCommit={onCommit} colors={colors} isRTL={isRTL} align={align} t={t} />
      )}
      {isPaperQuestion(question) ? (
        // A paper exam holds no question text and no answer to transcribe —
        // the paper has both. Only the mark and the comment below apply.
        <Text style={[styles.qText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('paperQuestionOnSheet')}
        </Text>
      ) : (
        (question.type === 'short_answer' || question.type === 'open_ended' || question.type === 'problem_solving' || question.type === 'practical_task') && (
          <OpenTextInput body={body} response={response} onChange={onChange} onCommit={onCommit} colors={colors} align={align} t={t} />
        )
      )}

      <GradeRow
        question={question}
        grade={grade}
        onChange={onGradeChange}
        onCommit={onGradeCommit}
        colors={colors}
        isRTL={isRTL}
        align={align}
        t={t}
      />
    </View>
  );
}

/**
 * The mark and the comment for one answer.
 *
 * The badge says who produced the mark and is read from the server's `grader`,
 * never inferred from whether the box has a value — an automatic mark and a
 * teacher's mark look identical once they are both numbers in a box, and the
 * difference is the whole reason the override trail exists.
 */
function GradeRow({
  question, grade, onChange, onCommit, colors, isRTL, align, t,
}: {
  question: EvaluationQuestion;
  grade: GradeDraft | undefined;
  onChange: (patch: Partial<GradeDraft>) => void;
  onCommit: (marks: string, note: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const marks = grade?.marks ?? '';
  const note = grade?.note ?? '';
  const byTeacher = grade?.grader === 'teacher';

  return (
    <View style={[styles.gradeRow, { borderTopColor: colors.border }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>
          {t('markLabel')}
        </Text>
        <TextInput
          value={marks}
          onChangeText={v => onChange({ marks: v })}
          onBlur={() => onCommit(marks, note)}
          keyboardType="decimal-pad"
          style={[styles.markInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
          {t('markOutOf', question.marks)}
        </Text>
        {grade?.grader ? (
          <Text style={{ color: byTeacher ? ACCENT : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
            {t(byTeacher ? 'markedByTeacher' : 'markedAutomatically')}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={note}
        onChangeText={v => onChange({ note: v })}
        onBlur={() => onCommit(marks, note)}
        placeholder={t('answerCommentPlaceholder')}
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={[styles.noteInput, { color: colors.foreground, borderColor: colors.border, textAlign: align, fontFamily: 'Almarai_400Regular' }]}
      />
    </View>
  );
}

function MultipleChoiceInput({
  body, response, onChange, colors, isRTL, align,
}: {
  body: Record<string, unknown>; response: Response; onChange: (r: Response) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; align: 'left' | 'right';
}) {
  const stem = (body['stem'] as string) ?? '';
  const options = Array.isArray(body['options']) ? (body['options'] as { id: string; text: string }[]) : [];
  const multi = body['multiSelect'] === true;
  const picked = new Set(Array.isArray(response['optionIds']) ? (response['optionIds'] as string[]) : []);

  const toggle = (id: string) => {
    if (multi) {
      const next = new Set(picked);
      next.has(id) ? next.delete(id) : next.add(id);
      onChange({ optionIds: [...next] });
    } else {
      onChange({ optionIds: [id] });
    }
  };

  return (
    <View>
      <Text style={[
          styles.qText,
          {
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            textAlign: align,
            writingDirection: align === 'right' ? 'rtl' : 'ltr',
            marginBottom: 10,
          },
        ]}>{isolateForeignRuns(stem)}</Text>
      <View style={{ gap: 8 }}>
        {options.map(o => {
          const selected = picked.has(o.id);
          return (
            <Pressable
              key={o.id}
              onPress={() => toggle(o.id)}
              style={[styles.optRow, { borderColor: selected ? ACCENT : colors.border, backgroundColor: selected ? ACCENT + '12' : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name={selected ? (multi ? 'checkbox' : 'radio-button-on') : (multi ? 'square-outline' : 'radio-button-off')} size={18} color={selected ? ACCENT : colors.mutedForeground} />
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: 'Almarai_400Regular',
                  fontSize: 14,
                  flex: 1,
                  textAlign: align,
                  writingDirection: align === 'right' ? 'rtl' : 'ltr',
                }}
              >
                {isolateForeignRuns(o.text)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TrueFalseInput({
  body, response, onChange, colors, isRTL, align, t,
}: {
  body: Record<string, unknown>; response: Response; onChange: (r: Response) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; align: 'left' | 'right'; t: (key: TranslationKey) => string;
}) {
  const statement = (body['statement'] as string) ?? '';
  const value = typeof response['value'] === 'boolean' ? (response['value'] as boolean) : null;

  return (
    <View>
      <Text style={[
          styles.qText,
          {
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            textAlign: align,
            writingDirection: align === 'right' ? 'rtl' : 'ltr',
            marginBottom: 10,
          },
        ]}>{isolateForeignRuns(statement)}</Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
        {[{ v: true, key: 'trueLabel' as TranslationKey }, { v: false, key: 'falseLabel' as TranslationKey }].map(opt => {
          const selected = value === opt.v;
          return (
            <Pressable
              key={String(opt.v)}
              onPress={() => onChange({ value: opt.v })}
              style={[styles.tfBtn, { borderColor: selected ? ACCENT : colors.border, backgroundColor: selected ? ACCENT : 'transparent' }]}
            >
              <Text style={{ color: selected ? '#fff' : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14 }}>{t(opt.key)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MatchingInput({
  body, response, onChange, colors, isRTL, align, t,
}: {
  body: Record<string, unknown>; response: Response; onChange: (r: Response) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; align: 'left' | 'right'; t: (key: TranslationKey) => string;
}) {
  const left = Array.isArray(body['left']) ? (body['left'] as { id: string; text?: string }[]) : [];
  const right = Array.isArray(body['right']) ? (body['right'] as { id: string; text?: string }[]) : [];
  const pairs = Array.isArray(response['pairs']) ? (response['pairs'] as { left: string; right: string }[]) : [];
  const [openFor, setOpenFor] = useState<string | null>(null);

  const rightFor = (leftId: string) => pairs.find(p => p.left === leftId)?.right;
  const setPair = (leftId: string, rightId: string) => {
    const next = [...pairs.filter(p => p.left !== leftId), { left: leftId, right: rightId }];
    onChange({ pairs: next });
    setOpenFor(null);
  };

  return (
    <View style={{ gap: 8 }}>
      {left.map(l => {
        const chosen = rightFor(l.id);
        const chosenText = right.find(r => r.id === chosen)?.text ?? chosen;
        return (
          <View key={l.id}>
            <View style={[styles.matchRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>
                {l.text ?? l.id}
              </Text>
              <Pressable
                onPress={() => setOpenFor(openFor === l.id ? null : l.id)}
                style={[styles.matchPicker, { borderColor: chosen ? ACCENT : colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Text style={{ color: chosen ? ACCENT : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                  {chosenText ?? t('matchingPickPlaceholder')}
                </Text>
                <Ionicons name={openFor === l.id ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {openFor === l.id && (
              <View style={[styles.matchOptions, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {right.map(r => (
                  <Pressable key={r.id} onPress={() => setPair(l.id, r.id)} style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{r.text ?? r.id}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function FillBlankInput({
  body, response, onChange, onCommit, colors, align, t,
}: {
  body: Record<string, unknown>; response: Response; onChange: (r: Response) => void; onCommit: (r: Response) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; align: 'left' | 'right'; t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const template = (body['template'] as string) ?? '';
  const count = countBlanks(template);
  const blanks = Array.isArray(response['blanks']) ? (response['blanks'] as string[]) : [];

  const setBlank = (i: number, value: string) => {
    const next = [...blanks];
    while (next.length < count) next.push('');
    next[i] = value;
    onChange({ blanks: next });
  };

  return (
    <View>
      <Text style={[
          styles.qText,
          {
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            textAlign: align,
            writingDirection: align === 'right' ? 'rtl' : 'ltr',
            marginBottom: 10,
          },
        ]}>
        {isolateForeignRuns(showBlanks(template))}
      </Text>
      <View style={{ gap: 8 }}>
        {Array.from({ length: count }, (_, i) => (
          <TextInput
            key={i}
            value={blanks[i] ?? ''}
            onChangeText={v => setBlank(i, v)}
            onBlur={() => onCommit({ blanks: blanks.length ? blanks : Array.from({ length: count }, (_, j) => (j === i ? blanks[i] ?? '' : '')) })}
            placeholder={t('fillBlankLabel', i + 1)}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, textAlign: align }]}
          />
        ))}
      </View>
    </View>
  );
}

function OpenTextInput({
  body, response, onChange, onCommit, colors, align, t,
}: {
  body: Record<string, unknown>; response: Response; onChange: (r: Response) => void; onCommit: (r: Response) => void;
  colors: ReturnType<typeof useColors>; align: 'left' | 'right'; t: (key: TranslationKey) => string;
}) {
  const prompt = (body['prompt'] as string) ?? '';
  const text = typeof response['text'] === 'string' ? (response['text'] as string) : '';

  return (
    <View>
      <Text style={[
          styles.qText,
          {
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            textAlign: align,
            writingDirection: align === 'right' ? 'rtl' : 'ltr',
            marginBottom: 10,
          },
        ]}>{isolateForeignRuns(prompt)}</Text>
      <TextInput
        value={text}
        onChangeText={v => onChange({ text: v })}
        onBlur={() => onCommit({ text })}
        placeholder={t('openAnswerPlaceholder')}
        placeholderTextColor={colors.mutedForeground}
        multiline
        style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, textAlign: align }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  headerTitle: { fontSize: 22, color: '#fff' },
  headerSub: { fontSize: 13 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  resultCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  resultTop: { alignItems: 'center' },
  levelRow: { alignItems: 'center', gap: 12, marginTop: 12 },
  levelPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  competencyRow: { alignItems: 'center' },
  qCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  qTop: { alignItems: 'center', gap: 8, marginBottom: 10 },
  scanBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  recBtn: { alignSelf: 'flex-start', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  gradeRow: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 8 },
  markInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, textAlign: 'center', fontSize: 14 },
  noteInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44, fontSize: 13 },
  commentBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 76, fontSize: 14 },
  qNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  qText: { fontSize: 14, lineHeight: 20 },
  optRow: { alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 12 },
  tfBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 10, paddingVertical: 12 },
  matchRow: { alignItems: 'center', gap: 8 },
  matchPicker: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, minWidth: 120, justifyContent: 'space-between' },
  matchOptions: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 10, marginTop: 4 },
});
