import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useEnglishRefresh } from '@/hooks/useEnglishRefresh';
import { getT } from '@/services/i18n';
import { contentLang, topicInLang } from '@/services/contentLanguage';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { groundingRequestFields, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { QuizOutput, QuizQuestion } from '@/services/ai/AIService';
import { buildDeckFromQuiz } from '@/services/classDeck';
import { ShortPaperNotice } from '@/components/ui/ShortPaperNotice';
import { bookFigureUri } from '@/services/bookFigureUri';
import { summarizeVerification, type VerifyOutcome } from '@/services/quizVerification';
import { VerificationSummaryRow } from '@/components/ui/VerificationSummaryRow';
import { normalizeQuestionOptions, optionLetter } from '@/services/optionLabels';
import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, scopeFromParams, topicForScope, subjectPickerLabels } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { aiErrorText, getLastGeneration, isAbortError } from '@/services/ai/aiProvenance';
import { CoverageNotice } from '@/components/ui/CoverageNotice';
import { useWideScope } from '@/hooks/useWideScope';
import { DISTRIBUTIONS, type CoverageLesson, type Distribution } from '@/services/coveragePlan';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import {
  ALL_QUESTION_COUNTS, buildWideRequest, clampCountIndex, scopeFormState, visibleCountOptions,
} from '@/services/wideScopeRequest';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { captureGenerationScope, materialScope, reopenedGenerationScope, type GenerationScope } from '@/services/generationScope';
import { createVerificationTracker } from '@/services/verificationTracker';
import { readIndexParam } from '@/services/materialParams';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { EditableText } from '@/components/ui/Editable';
import { confirm } from '@/services/confirm';
import {
  applyOptionEdit,
  applyQuestionEdit,
  optionMarkerState,
  parsePoints,
  removeQuestionAt } from '@/services/quizEdits';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { usePrintStyle } from '@/hooks/usePrintStyle';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { GeneratorResultActions, GeneratorSaveBar } from '@/components/ui/GeneratorResultActions';
import { buildQuizHTML, buildQuizSlidesHTML, formatQuizText } from '@/services/share';
import { buildQuizDocx } from '@/services/quizDocx';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { ExamKindSwitch } from '@/components/ui/ExamKindSwitch';
import { palette } from '@/constants/colors';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { usePickedLesson } from '@/hooks/usePickedLesson';
import { carriedLessonTopic } from '@/services/pickedLesson';
import { nextFrame } from '@/services/nextFrame';
import { QUIZ_TYPE_ORDER, type QuizType } from '@workspace/exam-paper';
import { conceptOf } from '@/constants/icons';
import { SPACE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';
import { moreRowsLabel, previewRows, summaryLine } from '@/services/generatorSummary';
import { SegmentedControl } from '@/components/generator/SegmentedControl';
import { Stepper } from '@/components/generator/Stepper';
import { ChipGroup } from '@/components/generator/ChipGroup';
import { LessonCard } from '@/components/generator/LessonCard';
import { DockedAction, DOCKED_BAR_HEIGHT } from '@/components/generator/DockedAction';
import { GeneratorLayout, useIsDesktopGenerator } from '@/components/generator/GeneratorLayout';
import { PaperPreview } from '@/components/generator/PaperPreview';

/**
 * The quiz's own colour, from the concept list the Tools tab and the prep board
 * read (`constants/icons.ts`). It carries white text at 4.5:1, so it is the fill
 * for solid buttons; as text or a ring on a card the screen uses `accentInk`
 * (`readableOn`), which stays readable on the dark card.
 */
const ACCENT = conceptOf('quiz').color;

type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
type DifficultyLevel = 'normal' | 'high' | 'difficult' | 'mixed';

const DURATION_OPTIONS = [10, 15, 20, 25, 30, 45];
const MARKS_OPTIONS = [10, 20, 25, 30, 40, 50, 100];
// 25 and 30 are appended (saved positions keep their meaning) and shown only on a wide scope.
const NUM_Q_OPTIONS = ALL_QUESTION_COUNTS;
/** What a unit / semester / book paper is anchored to: the scope itself, never one lesson its label happens to match. */
const WIDE_GROUNDING = { lesson: null, grounded: true };
const DIFFICULTY_IDS: DifficultyLevel[] = ['normal', 'high', 'difficult', 'mixed'];
const DIFFICULTY_MAP: Record<DifficultyLevel, Difficulty> = {
  normal: 'easy',
  high: 'medium',
  difficult: 'hard',
  mixed: 'mixed',
};

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; gradeIdx?: string; subjectIdx?: string;
    topic?: string; durationIdx?: string; marksIdx?: string; numQIdx?: string; diffIdx?: string; selectedTypes?: string;
    scope?: string; distribution?: string;
    // The lesson itself (a lesson page, the lesson bar, a saved quiz) — `usePickedLesson`.
    lessonId?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => uiLang === 'ar' ? g.nameAr : g.name);
  const durationLabels = DURATION_OPTIONS.map(d => `${d} ${t('min')}`);
  const marksLabels = MARKS_OPTIONS.map(m => String(m));
  const numQLabels = NUM_Q_OPTIONS.map(n => String(n));
  const diffLabels = [t('difficultyNormal'), t('difficultyHigh'), t('difficultyDifficult'), t('difficultyMixed')];

  const parseTypes = (raw?: string): Set<QuizType> => {
    if (!raw) return new Set(['multiple_choice', 'true_false', 'short_answer']);
    try { return new Set(JSON.parse(raw) as QuizType[]); } catch { return new Set(['multiple_choice', 'true_false', 'short_answer']); }
  };

  // An index the picker list cannot honour is NOT index 0 — see
  // `scopeFromParams`. Grounding the topic is what recovers the right scope.
  // Only the grades/subjects this teacher picked on /setup-subjects are offered.
  const teacherScope = useTeacherScope();
  const [initialScope] = useState(() => scopeFromParams(params, uiLang, teacherScope.defaultScope, teacherScope));
  const [gradeIdx, setGradeIdx] = useState(initialScope.gradeIdx);
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = teacherScope.subjectHiddenFor(grades[gradeIdx].id);
  // Labels are per-grade too: Grade 6's creative-arts book has no music
  // in it, so it must not be offered under the combined name. Same
  // index alignment as the mask above.
  const subjectNames = subjectPickerLabels(grades[gradeIdx].id, uiLang);
  const [subjectIdx, setSubjectIdx] = useState(initialScope.subjectIdx);
  // The picked subject's material language — English quizzes are in English.
  const lang = contentLang(subjects[subjectIdx].id, uiLang);
  const [topic, setTopic] = useState(() => {
    const initial = topicForScope(params, uiLang, teacherScope.defaultScope, teacherScope);
    const initialLang = contentLang(subjects[initialScope.subjectIdx].id, uiLang);
    return (initial.trim() && carriedLessonTopic(params.lessonId, initialLang)) || topicInLang(
      initial, uiLang, initialLang,
      { gradeId: grades[initialScope.gradeIdx].id, subjectId: subjects[initialScope.subjectIdx].id },
    );
  });
  useWarmGrounding(topic, lang);
  const kbScope = { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id };
  const pickedLesson = usePickedLesson(params.lessonId, topic, kbScope);
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /** The wide scope and distribution the paper on screen was generated under — what Save records. */
  const [wideFrozen, setWideFrozen] = useState<{ sel: ScopeSelection; distribution: Distribution } | null>(
    () => (wideScope.isWide ? { sel: wideScope.scopeSel!, distribution: wideScope.distribution } : null),
  );
  /** Which lessons the paper covers, and whether that is exact (offline) or the model's own word (live). */
  const [coverageInfo, setCoverageInfo] = useState<{ lessons: CoverageLesson[]; modelReported: boolean } | null>(null);
  // Persisted with the material (it was not: a reopened «صعب» quiz regenerated
  // as easy), and range-checked like the other positions.
  const [diffIdx, setDiffIdx] = useState(readIndexParam(params.diffIdx, DIFFICULTY_IDS.length, 0));

  // Reset topic when grade or subject changes
  const prevGradeRef = React.useRef(gradeIdx);
  const prevSubjectRef = React.useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      // A «subject mismatch» refusal is about the old pairing; it used to
      // stay on screen in red under the now-empty topic field.
      setError('');
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  const [durationIdx, setDurationIdx] = useState(readIndexParam(params.durationIdx, DURATION_OPTIONS.length, 2));
  const [marksIdx, setMarksIdx] = useState(readIndexParam(params.marksIdx, MARKS_OPTIONS.length, 1));
  const [numQIdx, setNumQIdx] = useState(readIndexParam(params.numQIdx, NUM_Q_OPTIONS.length, 2));
  const [selectedTypes, setSelectedTypes] = useState<Set<QuizType>>(parseTypes(params.selectedTypes));
  // 25 and 30 exist on a wide scope only. Derived, not written back: the selector
  // reports no scope for a moment mid-pick (unit A to unit B), and a reset would
  // lose the teacher's 30 each time.
  const effNumQIdx = clampCountIndex(numQIdx, wideScope.isWide);
  const isDesktop = useIsDesktopGenerator();
  const accentInk = readableOn(ACCENT, colors.card);
  // The lesson card opens by itself while there is no lesson, and when the grade or
  // subject clears it; typing a title must not fold the field away mid-word, so only
  // the button (or an empty topic) changes it. Never unmounts the pickers below.
  const [lessonOpen, setLessonOpen] = useState(() => !topic.trim());
  useEffect(() => { if (!topic.trim()) setLessonOpen(true); }, [topic]);
  const [loading, setLoading] = useState(false);
  // Counts presses of generate. The status scroll depends on it as well as on the phase: a refusal
  // returns before `setError('')`, so pressing again with the same refusal leaves the phase at 'error'
  // and, without this, would show the teacher nothing.
  const [attempt, setAttempt] = useState(0);
  /**
   * Held across renders so Cancel can reach the in-flight request. A cancel
   * that only cleared the spinner would leave the call running and still
   * billing against AI_BUDGET_USD — the teacher would have stopped the
   * waiting, not the spending.
   */
  const abortRef = useRef<AbortController | null>(null);
  useAbortOnUnmount(abortRef);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<QuizOutput | null>(null);
  /** null = not checked yet (or the check failed); [] onwards = per question. */
  const [outcomes, setOutcomes] = useState<(VerifyOutcome | undefined)[] | null>(null);
  /**
   * The scope the quiz on screen was generated under — pickers, topic and
   * the grounded lesson, frozen at generation time (or re-derived from the
   * saved form state on reopen). Save, export and present read this, never
   * the live pickers: changing the subject clears the topic but keeps the
   * quiz, and reading the form at that point stored it under the new subject
   * as «اختبار: » and re-grounded the deck from an empty topic.
   */
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => {
      if (!params.savedId) return null;
      // A restored wide scope is anchored to the scope, not to whichever lesson its
      // label («الفصل الأول كاملًا», a unit title) would ground to if looked up again.
      if (wideFrozen && topic.trim()) {
        return captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING);
      }
      return reopenedGenerationScope(initialScope, topic, lang, params.lessonId);
    },
  );
  const scope = materialScope(generated, { gradeIdx, subjectIdx, topic });
  // The quiz on screen keeps the language it was generated in, even after the
  // pickers move on — like everything else read off `scope`.
  const outLang = contentLang(subjects[scope.subjectIdx].id, uiLang);
  const outT = getT(outLang);
  const outRTL = outLang === 'ar';
  const curriculumGrounded: boolean | null = generated ? generated.grounded : null;
  // A wide paper has no single lesson: name its scope instead of leaving the notice's tail empty.
  const groundedLesson: string | null = wideFrozen
    ? scopeLabel(wideFrozen.sel, outLang)
    : generated?.lesson
      ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
      : null;
  /** Ids of questions the teacher has changed, so provenance stays honest. */
  const [editedQuestions, setEditedQuestions] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [printStyle, setPrintStyle] = usePrintStyle();
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try { setResult(JSON.parse(item.content) as QuizOutput); } catch { /* noop */ }
          setFavorited(item.isFavorite);
        }
      });
    }
  }, [params.savedId]);

  useEffect(() => {
    if (result) setSaveLabel('save');
  }, [result]);

  const toggleType = (type: QuizType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // The form's checkboxes are chrome; the badges on the quiz are the quiz's.
  const typeLabels = (tr: typeof t): Record<QuizType, string> => ({
    multiple_choice: tr('typeMultipleChoice'),
    true_false: tr('typeTrueFalse'),
    fill_blank: tr('typeFillBlank'),
    short_answer: tr('typeShortAnswer'),
  });
  const TYPE_LABEL = typeLabels(t);
  const OUT_TYPE_LABEL = typeLabels(outT);
  const TYPE_COLOR: Record<QuizType, string> = {
    multiple_choice: palette.warning,
    true_false: palette.info,
    fill_blank: palette.warning,
    short_answer: palette.success,
  };

  /*
    An edited question's earlier outcome no longer describes it. The teacher may
    have rewritten the very answer that was proved, so the badge is dropped
    rather than carried over — a stale ✓ is worse than none.
  */
  const effectiveOutcomes: (VerifyOutcome | undefined)[] =
    outcomes && result
      ? outcomes.map((o, i) =>
          editedQuestions.has(result.questions[i]?.id ?? '') ? undefined : o,
        )
      : [];
  // Edited questions leave the summary altogether: the teacher wrote what is
  // there now, so it is neither proved nor unreviewed. An `undefined` that
  // stays in counts as "nobody reviewed this" — see `summarizeVerification`.
  const verification = summarizeVerification(
    outcomes && result
      ? outcomes.filter((_, i) => !editedQuestions.has(result.questions[i]?.id ?? ''))
      : [],
  );

  /** Marks the paper dirty and records which question was touched. */
  const markEdited = (id: string) => {
    setEditedQuestions(prev => new Set(prev).add(id));
    setSaveLabel('save');
  };

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setResult(prev => (prev ? applyQuestionEdit(prev, index, patch) : prev));
    const id = result?.questions[index]?.id;
    if (id) markEdited(id);
  };

  const updateOption = (index: number, optionIndex: number, next: string) => {
    setResult(prev => {
      if (!prev) return prev;
      const questions = prev.questions.map((q, i) =>
        i === index ? applyOptionEdit(q, optionIndex, next) : q,
      );
      return { ...prev, questions };
    });
    const id = result?.questions[index]?.id;
    if (id) markEdited(id);
  };

  const removeQuestion = async (index: number) => {
    const q = result?.questions[index];
    if (!q) return;
    const ok = await confirm({
      title: t('deleteQuestion'),
      message: q.text,
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    if (!result) return;
    const next = removeQuestionAt(result, index);
    setResult(next);
    // outcomes is index-aligned to result.questions. A finished check loses
    // the same slot, so the badges after it do not shift onto the wrong
    // question. A check still in flight is for the old list and would land
    // one slot off — it is dropped and run again for the new one.
    verifyRef.current.drop();
    if (outcomes) setOutcomes(outcomes.filter((_, i) => i !== index));
    else verifyKeys(next);
    setSaveLabel('save');
  };

  /**
   * Verification runs after the quiz is on screen, not before. It is a
   * per-question round trip to a service that may be asleep or absent, and
   * making the teacher wait on it would trade a working quiz for a slower
   * one. Its result is positional, so it may only land on the exact output it
   * was run for: after a regenerate it would badge the new paper, and after a
   * delete it would land one slot off and mark an unchecked question proved.
   */
  const verifyRef = useRef(createVerificationTracker<QuizOutput>());
  const verifyKeys = (out: QuizOutput) => {
    verifyRef.current.begin(out);
    setOutcomes(null);
    void (async () => {
      const { verifyQuizAnswers } = await import('@/services/quizVerification');
      const { verifyMathItem } = await import('@/services/ai/verifyMath');
      const checked = await verifyQuizAnswers(out, verifyMathItem);
      if (verifyRef.current.accepts(out)) setOutcomes(checked);
    })().catch(() => { if (verifyRef.current.accepts(out)) setOutcomes(null); });
  };

  /**
   * `regenerate` is the teacher asking for a replacement, not another copy.
   *
   * It used to be the same call: the button re-ran this function with an
   * identical body, and the same prompt came back as the same content
   * reworded. The flag lets the server answer from a variant it has already
   * paid for — free, and certain to be different — and steer a fresh
   * generation away from what is on screen when it cannot.
   */
  const generate = async (opts?: { regenerate?: boolean }) => {
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    setAttempt(n => n + 1);
    const previous = result;
    // Everything a failed or cancelled run must hand back: the paper, its
    // badges and edits, and the scope it was generated under. It used to be
    // cleared up front and never restored, so Cancel on a regenerate threw
    // away the unsaved quiz the teacher was looking at.
    const held = { result, outcomes, editedQuestions, showAnswers, generated, wideFrozen, coverageInfo };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // paper — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson only.
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wide = wideScope.isWide
      ? buildWideRequest(wideScope.scopeSel!, lang, NUM_Q_OPTIONS[effNumQIdx]!, wideScope.distribution, { offset: opts?.regenerate ? Math.floor(Math.random() * 1000) : 0 })
      : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setResult(null); setOutcomes(null); setEditedQuestions(new Set()); setShowAnswers(false); setSaveLabel('save');
    verifyRef.current.drop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    try {
      const lessonGrounding = wide
        ? null
        : resolveGeneratorGrounding(topic.trim(), lang, { scope: kbScope, lessonId: pickedLesson.lessonId });
      const grounding = lessonGrounding ?? WIDE_GROUNDING;
      // Every field from that one grounding — never the title again (`groundingRequestFields`).
      const lessonFields = lessonGrounding ? groundingRequestFields(lessonGrounding) : undefined;
      const out = await aiService.generateQuiz({
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        duration: DURATION_OPTIONS[durationIdx],
        totalMarks: MARKS_OPTIONS[marksIdx],
        questionTypes: Array.from(selectedTypes),
        numQuestions: NUM_Q_OPTIONS[effNumQIdx],
        difficulty: DIFFICULTY_MAP[DIFFICULTY_IDS[diffIdx]],
        additionalContext: lessonFields?.additionalContext,
        unitId: lessonFields?.unitId,
        lessonId: lessonFields?.lessonId,
        bookFigureCount: lessonFields?.bookFigureCount,
        // Curriculum-derived, so the artifact may be shared with any teacher
        // who asks the same question — see AIRequest.contextSource.
        contextSource: 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
        // Last: the wide scope's digest replaces the lesson-derived context, and
        // its explicit-undefined lessonId / unitId clear the single-lesson fields.
        ...(wide ? wide.fields : {}),
      }, { signal: controller.signal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Options are lettered by the renderer, once, in the display language.
      // Models routinely bake their own "أ)" into the option text as well, and
      // leaving it there prints "أ. أ) الوقت" on the paper — so it is dropped
      // on the way in, before this ever reaches the editor or the exporter.
      const normalized = { ...out, questions: out.questions.map(normalizeQuestionOptions) };
      setResult(normalized);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setWideFrozen(wide ? { sel: wideScope.scopeSel!, distribution: wideScope.distribution } : null);
      setCoverageInfo(wide ? { lessons: wide.lessons, modelReported: getLastGeneration()?.source === 'live' } : null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      verifyKeys(normalized);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of. The raw error text
      // is deliberately not shown: "HTTP 500" is not a sentence in a language
      // a teacher reads, and aiProvenance already records it for the badge.
      if (isAbortError(e)) setCancelled(true);
      else setError(aiErrorText(e, t));
      // Hand back what was on screen; a stop or a failure is not a reason to
      // lose it. The scope goes back with it so the badges and the grounding
      // notice describe the restored paper, not the one that never came.
      if (held.result) {
        setResult(held.result);
        setOutcomes(held.outcomes);
        setEditedQuestions(held.editedQuestions);
        setShowAnswers(held.showAnswers);
        setGenerated(held.generated);
        setWideFrozen(held.wideFrozen);
        setCoverageInfo(held.coverageInfo);
        if (held.outcomes) verifyRef.current.begin(held.result);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  /** Stop the in-flight request and hand the teacher their form back. */
  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  const handleSave = async () => {
    if (!result) return;
    const title = getExportTitle();
    const formState = {
      gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic,
      durationIdx, marksIdx, numQIdx: effNumQIdx, diffIdx, selectedTypes: JSON.stringify(Array.from(selectedTypes)),
      // From the frozen scope, not the live pickers (a teacher can move them after generating).
      ...scopeFormState(wideFrozen?.sel ?? null, wideFrozen?.distribution ?? 'balanced'),
    };
    // Built once: the two branches below used to each spell out the payload.
    const payload = {
      title, subject: subjects[scope.subjectIdx].name, grade: grades[scope.gradeIdx].name,
      // `repeated` describes a regenerate, not the paper: reopened later it would be stale.
      topic: scope.topic, language: outLang, content: JSON.stringify({ ...result, repeated: undefined }), formState,
    };
    // `updateItem` answers false when the material is no longer there — the
    // teacher deleted it from موادي while this screen still held its id. The
    // return value used to be dropped, so the button reported "تم التحديث"
    // over a material that no longer existed and the work was never saved
    // again. Folding the call into the condition makes a failed update fall
    // through to creating a fresh one, which is what pressing Save meant.
    if (savedId && (await updateItem(savedId, payload))) {
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({ type: 'quiz', ...payload });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  // An English material saved in Arabic (before 2026-10-04) is redone in
  // English as soon as it opens, and the English copy replaces it.
  useEnglishRefresh({
    savedId: params.savedId,
    current: result,
    generate: () => generate(),
    save: async () => { await handleSave(); showToast(t('englishMaterialRedone')); },
  });

  const topPad = insets.top + (insets.top === 0 ? 16 : 0);

  const getExportTitle = () => outLang === 'ar' ? `اختبار: ${scope.topic}` : `Quiz: ${scope.topic}`;
  // Localised, like the picker above it. Taking `.name` straight off the
  // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
  // material — the screen showed الرياضيات and the exported file disagreed.
  // Labels are per grade, so they are read against the generated grade.
  const getExportMeta = () => ({
    subject: subjectPickerLabels(grades[scope.gradeIdx].id, outLang)[scope.subjectIdx]!,
    grade: outLang === 'ar' ? grades[scope.gradeIdx].nameAr : grades[scope.gradeIdx].name,
  });

  const {
    getExportFigures,
    handleShareText,
    handleCopy,
    handlePDF,
    handleWord,
    handleSlides,
    loadingPDF,
    loadingWord,
    loadingSlides,
  } = useGeneratorExport({
    result,
    topic: scope.topic,
    lessonId: scope.lesson?.id,
    // A wide paper has no figures of its own; see `noFigures`.
    noFigures: wideFrozen !== null,
    lang: outLang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    // The paper follows the answers toggle, as the worksheet's does: hidden
    // (the default) prints the student copy, shown prints the teacher's.
    formatText: (quiz, title, meta, isAr) => formatQuizText(quiz, title, meta, isAr, showAnswers),
    buildHTML: (quiz, title, meta, isAr, figures) => buildQuizHTML(quiz, title, meta, isAr, figures, showAnswers, printStyle),
    buildSlidesHTML: (quiz, title, meta, isAr, figures) => buildQuizSlidesHTML(quiz, title, meta, isAr, figures, showAnswers),
    buildWord: (quiz, title, meta, isAr, docx) => buildQuizDocx(quiz, title, meta, isAr, showAnswers, docx),
    onError: key => showToast(t(key)),
    onCopied: key => showToast(t(key)),
  });

  const exportLabels = {
    title: t('exportTitle'),
    shareLabel: t('exportShare'), shareSub: t('exportShareSub'),
    copyLabel: t('exportCopy'), copySub: t('exportCopySub'),
    pdfLabel: t('exportPDF'), pdfSub: t('exportPDFSub'),
    wordLabel: t('exportWord'), wordSub: t('exportWordSub'),
    slidesLabel: t('exportSlides'), slidesSub: t('exportSlidesSub'),
    cancel: t('cancel'),
  };

  // What the button will make, said before it is pressed (docked bar on a phone, preview on desktop).
  const summary = summaryLine({
    questions: NUM_Q_OPTIONS[effNumQIdx],
    minutes: DURATION_OPTIONS[durationIdx],
    marks: MARKS_OPTIONS[marksIdx],
    kinds: selectedTypes.size,
  }, uiLang);
  // A grade/subject pair with no book: the note that says so lives in the lesson card's body,
  // so the card stays open for as long as it applies (the same test `StrandedSelectionNote` makes).
  const stranded = subjectHidden?.[subjectIdx] === true;
  // What GenerationStatus shows. Under the form it is out of sight of a docked button, so a
  // phone scrolls it into view when this leaves 'idle' (a refusal such as scopeNoCurriculum or
  // subjectTopicMismatch, a network error, the spinner and its Cancel).
  const statusPhase = loading ? 'loading' : cancelled ? 'cancelled' : (error && topic.trim()) ? 'error' : 'idle';
  const statusY = useRef(0);
  const reduceMotion = useReduceMotion();
  // Layout effect, not effect: the jump is made before the frame is painted, so there is no flash
  // of the form first. No animated scroll under reduced motion.
  useLayoutEffect(() => {
    if (isDesktop || statusPhase === 'idle') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, statusY.current - SPACE.lg), animated: !reduceMotion });
  }, [statusPhase, attempt]);
  // The result's own save bar takes the bottom of a phone while a fresh paper is unsaved.
  const saveBarVisible = !!result && !loading && !savedId && saveLabel === 'save';
  const typeOptions = QUIZ_TYPE_ORDER.map(type => ({ id: type, label: TYPE_LABEL[type] }));
  const ticked = QUIZ_TYPE_ORDER.filter(type => selectedTypes.has(type));
  const preview = previewRows(ticked, NUM_Q_OPTIONS[effNumQIdx]!, 6);

  const action = (docked: boolean) => (
    <DockedAction
      summary={summary}
      label={loading ? t('generatingQuiz') : t('generateQuizBtn')}
      onPress={() => generate()}
      loading={loading}
      disabled={!topic.trim()}
      // A greyed-out primary button with nothing next to it reads as a broken
      // product rather than an unmet precondition. It says which one.
      hint={t('genNeedLessonHint')}
      accent={ACCENT}
      docked={docked}
      hidden={docked && saveBarVisible}
    />
  );

  const form = (
    <>
      <ExamKindSwitch active="paper" accent={ACCENT} />

      <LessonCard
        gradeLabel={gradeNames[gradeIdx]!}
        subjectLabel={subjectNames[subjectIdx]!}
        subjectId={subjects[subjectIdx].id}
        topic={topic}
        grounded={!!pickedLesson.lessonId || wideScope.isWide}
        expanded={lessonOpen || stranded}
        locked={!topic.trim() || stranded}
        onToggle={() => setLessonOpen(open => !open)}
      >
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} hidden={teacherScope.gradeHidden} colors={colors} isRTL={isRTL} accent={accentInk} />
        <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t(teacherScope.strandedNoteKey(grades[gradeIdx].id, subjectIdx))} isRTL={isRTL} colors={colors} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={accentInk} hidden={subjectHidden} />

        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={text => { setTopic(text); setError(''); }}
          onSelectionDetail={pickedLesson.onSelectionDetail}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          lang={lang}
          isRTL={isRTL}
          colors={colors}
          accent={accentInk}
          hasError={!!error && !topic}
          t={t}
        />

        {/*
          The validation error (an empty topic) stays here, next to the field
          it is about. Generation failures moved down to GenerationStatus,
          beside the spinner they replace — they used to render above the form,
          out of sight of the button that had just been pressed.
        */}
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontSize: 15, lineHeight: 24, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
      </LessonCard>

      <SegmentedControl label={t('levelLabel')} options={diffLabels} index={diffIdx} onChange={setDiffIdx} accent={ACCENT} />

      <View style={{ gap: SPACE.sm }}>
        <Stepper label={t('numQuestionsLabel')} options={numQLabels.slice(0, visibleCountOptions(wideScope.isWide))} index={effNumQIdx} onChange={setNumQIdx} accent={ACCENT} />
        <Stepper label={t('quizDurationLabel')} options={durationLabels} index={durationIdx} onChange={setDurationIdx} accent={ACCENT} />
        <Stepper label={t('totalMarksLabel')} options={marksLabels} index={marksIdx} onChange={setMarksIdx} accent={ACCENT} />
      </View>

      <ChipGroup label={t('questionTypesLabel')} options={typeOptions} selected={selectedTypes} onToggle={toggleType} min={1} accent={ACCENT} />

      {wideScope.isWide && (
        <SegmentedControl
          label={t('distributionLabel')}
          options={[t('distributionBalanced'), t('distributionRandom')]}
          index={Math.max(0, DISTRIBUTIONS.indexOf(wideScope.distribution))}
          onChange={i => wideScope.setDistribution(DISTRIBUTIONS[i]!)}
          accent={ACCENT}
        />
      )}
    </>
  );

  const side = (
    <>
      <PaperPreview
        title={t('createQuizTitle')}
        subtitle={`${topic.trim() || t('selectLesson')} · ${gradeNames[gradeIdx]}`}
        rows={preview.rows.map(r => ({ n: r.n, tag: r.type ? TYPE_LABEL[r.type] : null }))}
        more={moreRowsLabel(preview.remainder, uiLang)}
        footer={[`${t('totalMarksLabel')} ${MARKS_OPTIONS[marksIdx]}`, durationLabels[durationIdx]!]}
        note={t('genPreviewQuizNote')}
        accent={ACCENT}
      />
      {action(false)}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: DOCKED_BAR_HEIGHT + SPACE.xxl + insets.bottom, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ToolHeader topPad={topPad} isRTL={isRTL} title={t('createQuizTitle')} concept="quiz" subtitle={t('quizSubtitle')} />

      {/* Form */}
      <View style={{ padding: isDesktop ? SPACE.xxl : SPACE.xl }}>
        <GeneratorLayout form={form} side={side} isDesktop={isDesktop} />
      </View>

      {/* Loading. The wrapper only records where this sits, for the scroll above. */}
      <View onLayout={e => { statusY.current = e.nativeEvent.layout.y; }}>
      <GenerationStatus
        phase={statusPhase}
        loadingLabel={t('generatingQuiz')}
        errorDetail={error}
        onCancel={cancelGenerate}
        onRetry={generate}
        colors={colors}
        isRTL={isRTL}
        lang={uiLang}
        accent={accentInk}
        t={t}
      />
      </View>

      {/* Result */}
      {/* What the material is anchored to. Shown both ways: a teacher needs to
          know it IS tied to the lesson as much as when it isn't. */}
      {result && curriculumGrounded !== null && (
        <View style={{ marginHorizontal: 20 }}>
          <GroundingNotice
            grounded={curriculumGrounded}
            lessonTitle={groundedLesson}
            sources={result.sources}
            isRTL={isRTL}
            colors={colors}
            labels={{
              grounded: (l: string) => t('groundedInCurriculum', l),
              generic: t('notGroundedTitle'),
              genericHint: t('notGroundedHint'),
            }}
          />
          {curriculumGrounded && (
            <BookFiguresPanel
              figures={getExportFigures()}
              isRTL={isRTL}
              colors={colors}
              labels={{ title: t('bookFiguresTitle'), note: t('bookFiguresNote') }}
            />
          )}
          {/* Whether anything actually checked the answer keys. Silent until
              the check resolves: saying nothing is honest, saying "not
              verified" while a request is still in flight is not. */}
          {outcomes && verification.total > 0 && (
            <VerificationSummaryRow summary={verification} />
          )}
        </View>
      )}

      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={[styles.quizHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40', borderRadius: colors.radius }]}>
            <Text style={[styles.quizTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: outRTL ? 'right' : 'left' }]}>{result.title}</Text>
            <View style={[styles.quizMeta, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
              <MetaPill icon="time-outline" text={`${result.duration} ${outT('min')}`} color={accentInk} />
              <MetaPill icon="star-outline" text={`${result.totalPoints} ${outT('pts')}`} color={accentInk} />
              <MetaPill icon="help-circle-outline" text={outT('questionCountPill', result.questions.length)} color={accentInk} />
            </View>
          </View>

          <ShortPaperNotice shortfall={result.shortfall} repeated={result.repeated} />
          {coverageInfo && (
            <CoverageNotice lessons={coverageInfo.lessons} questions={result.questions} modelReported={coverageInfo.modelReported} />
          )}

          {/* Class Mode: project this quiz as whole-class response slides.
              Phones are banned in class, so students answer from their seats
              with printed أ ب ج د cards and the teacher reveals on screen. */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPendingClassroomActivity(
                buildDeckFromQuiz(result, scope.topic, outRTL, {
                  // The lesson this quiz was generated for — not one re-derived
                  // from whatever the topic box says now.
                  lesson: scope.lesson,
                  // Was a blanket `verified: false`, which hid the keys the
                  // verifier had actually proved. Per question now, so the
                  // projector badges exactly what was checked.
                  outcomes: effectiveOutcomes,
                  figureUri: bookFigureUri,
                  ...getExportMeta(),
                }),
              );
              router.push('/ai-tools/classroom/presentation' as any);
            }}
            style={({ pressed }) => [
              styles.presentBtn,
              {
                backgroundColor: ACCENT,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="tv-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 14 }}>
              {t('presentOnScreen')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAnswers(v => !v)}
            style={[styles.toggleBtn, { borderColor: accentInk, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={showAnswers ? 'eye-off-outline' : 'eye-outline'} size={16} color={accentInk} />
            <Text style={[{ color: accentInk, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }]}>
              {showAnswers ? t('hideAnswers') : t('showAnswers')}
            </Text>
          </Pressable>

          {result.questions.map((q, i) => {
            const tc = TYPE_COLOR[q.type as QuizType] ?? accentInk;
            const o = effectiveOutcomes[i];
            return (
              <View key={q.id} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.qTop, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.qNumCircle, { backgroundColor: ACCENT }]}>
                    <Text style={[{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 12 }]}>{i + 1}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[{ color: tc, fontFamily: 'ReadexPro_500Medium', fontSize: 11 }]}>{OUT_TYPE_LABEL[q.type as QuizType] ?? q.type}</Text>
                  </View>
                  <View style={{ flexDirection: outRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginLeft: outRTL ? 0 : 'auto', marginRight: outRTL ? 'auto' : 0 }}>
                    <View style={{ minWidth: 54 }}>
                      <EditableText
                        value={`${q.points}`}
                        onChange={next => {
                          // Marks must stay a positive number; a zero-mark
                          // question takes a student's time and counts for
                          // nothing, and a non-number breaks the total.
                          const n = parsePoints(next);
                          if (n !== null) updateQuestion(i, { points: n });
                        }}
                        colors={colors}
                        isRTL={outRTL}
                        placeholder={outT('pts')}
                      />
                    </View>
                    <Pressable
                      onPress={() => { void removeQuestion(i); }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('deleteQuestion')}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
                {/* Symbolic only, per question: `bank` is also the verifier-down
                    fallback, so naming it per item would vouch for a key nothing
                    checked. The aggregate row above still covers the rest. */}
                {o?.verifiedBy === 'symbolic' ? (
                  <View style={[styles.verifyRow, { marginTop: 0, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="shield-checkmark" size={14} color="#067647" />
                    <Text style={[styles.verifyText, { color: palette.success, textAlign: isRTL ? 'right' : 'left' }]}>
                      {t('verifiedBySymbolic')}
                    </Text>
                  </View>
                ) : null}
                {showAnswers && o?.verifiedBy === 'symbolic' && o.computedAnswer ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                    {isolateForeignRuns(t('verifiedComputed', prettifySymPy(o.computedAnswer)))}
                  </Text>
                ) : null}
                <View style={styles.qText}>
                  <EditableText
                    value={q.text}
                    onChange={next => updateQuestion(i, { text: next })}
                    colors={colors}
                    isRTL={outRTL}
                    placeholder={t('editPlaceholder')}
                    edited={editedQuestions.has(q.id)}
                  />
                </View>

                {q.options?.map((opt, oi) => {
                  const marker = optionMarkerState(showAnswers, opt, q.correctAnswer);
                  const isCorrect = marker === 'selected';
                  return (
                    <View key={oi} style={[styles.optRow, { backgroundColor: isCorrect ? palette.success + '15' : colors.muted, borderRadius: 8, flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.optLabel, { color: isCorrect ? palette.success : colors.mutedForeground, fontFamily: isCorrect ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular' }]}>
                        {optionLetter(oi, outRTL)}.
                      </Text>
                      <View style={{ flex: 1 }}>
                        <EditableText
                          value={opt}
                          onChange={next => updateOption(i, oi, next)}
                          colors={colors}
                          isRTL={outRTL}
                          placeholder={t('editPlaceholder')}
                        />
                      </View>
                      {/* Choosing the right answer is a choice among the
                          options, so it is made by picking one rather than by
                          retyping it into a separate field. It disappears with
                          the rest of the key: it names the answer to a screen
                          reader as well as drawing it, so leaving it up while
                          "hide answers" is on shows the class the answer. */}
                      {marker !== 'hidden' && (
                        <Pressable
                          onPress={() => updateQuestion(i, { correctAnswer: opt })}
                          hitSlop={6}
                          accessibilityRole="button"
                          aria-selected={isCorrect}
                          accessibilityLabel={`${opt} — ${t('answer')}`}
                        >
                          <Ionicons
                            name={isCorrect ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={isCorrect ? palette.success : colors.mutedForeground}
                          />
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {showAnswers && q.type === 'true_false' && (
                  <View style={[styles.ansBox, { backgroundColor: palette.success + '15', borderRadius: 8, flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#067647" />
                    <Text style={[{ color: palette.success, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }]}>{outT('answer')}:</Text>
                    <View style={{ flex: 1 }}>
                      <EditableText
                        value={q.correctAnswer}
                        onChange={next => updateQuestion(i, { correctAnswer: next })}
                        colors={colors}
                        isRTL={outRTL}
                        placeholder={t('editPlaceholder')}
                      />
                    </View>
                  </View>
                )}

                {showAnswers && (q.type === 'short_answer' || q.type === 'fill_blank') && (
                  <View style={[styles.ansBox, { backgroundColor: palette.info + '12', borderRadius: 8 }]}>
                    <EditableText
                      value={q.correctAnswer}
                      onChange={next => updateQuestion(i, { correctAnswer: next })}
                      colors={colors}
                      isRTL={outRTL}
                      placeholder={t('editPlaceholder')}
                    />
                  </View>
                )}

                {showAnswers && (
                  <View style={[styles.expBox, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                    <EditableText
                      value={q.explanation}
                      onChange={next => updateQuestion(i, { explanation: next })}
                      colors={colors}
                      isRTL={outRTL}
                      placeholder={t('editPlaceholder')}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {result && !loading && (
        <GeneratorResultActions
          accent={accentInk}
          savedId={savedId}
          onToast={showToast}
          saveState={saveLabel}
          onSave={handleSave}
          favorite={{ favorited, onToggle: handleToggleFavorite }}
          onExport={() => setShowExport(true)}
          onRegenerate={() => generate({ regenerate: true })}
          variantId={pooledVariantId(result)}
          materialType="quiz"
          toolId="quiz"
          topic={scope.topic}
          // Its chips open other tools with this label as a bare topic they re-ground.
          hideRelated={wideFrozen !== null}
        />
      )}
    </ScrollView>
    {isDesktop ? null : action(true)}
    {result && !loading && (
      <GeneratorSaveBar accent={accentInk} savedId={savedId} saveState={saveLabel} onSave={handleSave} onExport={() => setShowExport(true)} />
    )}

    <ExportMenu
      visible={showExport}
      onClose={() => setShowExport(false)}
      onShare={handleShareText}
      onCopy={handleCopy}
      onPDF={handlePDF}
      onWord={handleWord}
      onSlides={handleSlides}
      note={t(showAnswers ? 'exportTeacherCopyNote' : 'exportStudentCopyNote')}
      printStyle={{ value: printStyle, onChange: setPrintStyle }}
      isRTL={isRTL}
      loadingPDF={loadingPDF}
      loadingWord={loadingWord}
      loadingSlides={loadingSlides}
      labels={exportLabels}
    />
    <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

function MetaPill({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: color + '18', borderRadius: 20 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/**
 * The shared dropdown wearing this screen's skin: a shorter list and an
 * amber-tinted selected row. (The open trigger's border tint used to be bound
 * here too, until every screen wanted it and it moved into the component.)
 * Binding them here rather than at each of the five call sites means a sixth
 * picker cannot be added half-styled — which is how the 45-line copy this
 * replaces drifted away from components/ui/PickerField in the first place.
 */
function PickerField(props: React.ComponentProps<typeof SharedPickerField>) {
  return <SharedPickerField maxHeight={180} selectedTint={ACCENT + '15'} {...props} />;
}

const styles = StyleSheet.create({
  verifyRow: { alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 },
  verifyText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 12, flex: 1 },
  quizHeader: { padding: 16, borderWidth: 1, marginBottom: 16 },
  quizTitle: { fontSize: 16, marginBottom: 12 },
  quizMeta: { gap: 8, flexWrap: 'wrap' },
  toggleBtn: { alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  presentBtn: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, marginBottom: 12 },
  qCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  qTop: { alignItems: 'center', gap: 12, marginBottom: 12 },
  qNumCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  qText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  optRow: { alignItems: 'center', gap: 12, padding: 12, marginBottom: 8 },
  optLabel: { fontSize: 13, width: 24 },
  ansBox: { alignItems: 'center', gap: 8, padding: 12, marginTop: 8 },
  expBox: { padding: 12, marginTop: 8 },
});
