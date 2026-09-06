import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { QuizOutput, QuizQuestion } from '@/services/ai/AIService';
import { buildDeckFromQuiz } from '@/services/classDeck';
import { bookFigureUri } from '@/services/bookFigureUri';
import { summarizeVerification, type VerifyOutcome } from '@/services/quizVerification';
import { normalizeQuestionOptions, optionLetter } from '@/services/optionLabels';
import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectsWithoutCurriculum, topicPickerParams } from '@/services/lessonPrep';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { isAbortError } from '@/services/ai/aiProvenance';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { EditableText } from '@/components/ui/Editable';
import { confirm } from '@/services/confirm';
import {
  applyOptionEdit,
  applyQuestionEdit,
  optionMarkerState,
  parsePoints,
  removeQuestionAt,
} from '@/services/quizEdits';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { buildQuizHTML, buildQuizSlidesHTML, formatQuizText } from '@/services/share';

const ACCENT = '#F59E0B';

type QType = 'multiple_choice' | 'true_false' | 'short_answer';
type Difficulty = 'easy' | 'medium' | 'hard';
type DifficultyLevel = 'normal' | 'high' | 'difficult';

const DURATION_OPTIONS = [10, 15, 20, 25, 30, 45];
const MARKS_OPTIONS = [10, 20, 25, 30, 40, 50, 100];
const ALL_Q_TYPES: QType[] = ['multiple_choice', 'true_false', 'short_answer'];
const DIFFICULTY_IDS: DifficultyLevel[] = ['normal', 'high', 'difficult'];
const DIFFICULTY_MAP: Record<DifficultyLevel, Difficulty> = {
  normal: 'easy',
  high: 'medium',
  difficult: 'hard',
};

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; gradeIdx?: string; subjectIdx?: string;
    topic?: string; durationIdx?: string; marksIdx?: string; selectedTypes?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = subjects.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_OPTIONS.map(d => `${d} ${t('min')}`);
  const marksLabels = MARKS_OPTIONS.map(m => String(m));
  const diffLabels = [t('difficultyNormal'), t('difficultyHigh'), t('difficultyDifficult')];

  const parseTypes = (raw?: string): Set<QType> => {
    if (!raw) return new Set(['multiple_choice', 'true_false', 'short_answer']);
    try { return new Set(JSON.parse(raw) as QType[]); } catch { return new Set(['multiple_choice', 'true_false', 'short_answer']); }
  };

  // A bare `topic` param (old bookmarks, callers without picker params) says
  // which grade and subject it belongs to better than picker index 0 does —
  // ground it instead of opening a math lesson under whatever subject sits
  // first in the list.
  const [inferredScope] = useState(() =>
    params.gradeIdx == null && params.subjectIdx == null
      ? topicPickerParams(params.topic, lang as 'ar' | 'en')
      : null,
  );
  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(params.gradeIdx ?? inferredScope?.gradeIdx, grades.length));
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = subjectsWithoutCurriculum(grades[gradeIdx].id);
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(params.subjectIdx ?? inferredScope?.subjectIdx, subjects.length));
  const [topic, setTopic] = useState(params.topic ?? '');
  const [diffIdx, setDiffIdx] = useState(0);

  // Reset topic when grade or subject changes
  const prevGradeRef = React.useRef(gradeIdx);
  const prevSubjectRef = React.useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  const [durationIdx, setDurationIdx] = useState(params.durationIdx ? parseInt(params.durationIdx, 10) : 2);
  const [marksIdx, setMarksIdx] = useState(params.marksIdx ? parseInt(params.marksIdx, 10) : 1);
  const [selectedTypes, setSelectedTypes] = useState<Set<QType>>(parseTypes(params.selectedTypes));
  const [loading, setLoading] = useState(false);
  /**
   * Held across renders so Cancel can reach the in-flight request. A cancel
   * that only cleared the spinner would leave the call running and still
   * billing against AI_BUDGET_USD — the teacher would have stopped the
   * waiting, not the spending.
   */
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<QuizOutput | null>(null);
  /** null = not checked yet (or the check failed); [] onwards = per question. */
  const [outcomes, setOutcomes] = useState<VerifyOutcome[] | null>(null);
  /** Whether the output was anchored to a curriculum lesson, and which one. */
  const [curriculumGrounded, setCurriculumGrounded] = useState<boolean | null>(null);
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  /** Ids of questions the teacher has changed, so provenance stays honest. */
  const [editedQuestions, setEditedQuestions] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
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
    if (result) setSaveLabel(savedId ? 'updated' : 'save');
  }, [result]);

  const toggleType = (type: QType) => {
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

  const TYPE_LABEL: Record<QType, string> = {
    multiple_choice: t('typeMultipleChoice'),
    true_false: t('typeTrueFalse'),
    short_answer: t('typeShortAnswer'),
  };
  const TYPE_COLOR: Record<QType, string> = {
    multiple_choice: '#F59E0B',
    true_false: '#3B82F6',
    short_answer: '#10B981',
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
  const verification = summarizeVerification(
    effectiveOutcomes.filter((o): o is VerifyOutcome => !!o),
  );

  /** Marks the paper dirty and records which question was touched. */
  const markEdited = (id: string) => {
    setEditedQuestions(prev => new Set(prev).add(id));
    setSaveLabel(savedId ? 'updated' : 'save');
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
    setResult(prev => (prev ? removeQuestionAt(prev, index) : prev));
    // outcomes is index-aligned to result.questions — drop the same slot so
    // verification badges don't shift onto the wrong question after a delete.
    setOutcomes(prev => (prev ? prev.filter((_, i) => i !== index) : prev));
    setSaveLabel(savedId ? 'updated' : 'save');
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
    const previous = result;
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // paper — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, lang as 'ar' | 'en');
    if (scope) { setError(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', lang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setResult(null); setOutcomes(null); setEditedQuestions(new Set()); setShowAnswers(false); setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      const additionalContext = buildGeneratorContext(topic.trim(), lang as 'ar' | 'en');
      const unitId = generatorUnitId(topic.trim(), lang as 'ar' | 'en');
      const out = await aiService.generateQuiz({
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        duration: DURATION_OPTIONS[durationIdx],
        totalMarks: MARKS_OPTIONS[marksIdx],
        questionTypes: Array.from(selectedTypes),
        // Two questions per selected type — the same rule MockAIService uses,
        // so live and mock papers agree on size. Without this the server
        // prompt fell back to a flat 10, whatever was picked here.
        numQuestions: selectedTypes.size * 2,
        difficulty: DIFFICULTY_MAP[DIFFICULTY_IDS[diffIdx]],
        additionalContext,
        unitId,
        lessonId: generatorLessonId(topic.trim(), lang as 'ar' | 'en'),
        bookFigureCount: generatorFigureCount(topic.trim(), lang as 'ar' | 'en'),
        // Curriculum-derived, so the artifact may be shared with any teacher
        // who asks the same question — see AIRequest.contextSource.
        contextSource: 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
      }, { signal: controller.signal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Options are lettered by the renderer, once, in the display language.
      // Models routinely bake their own "أ)" into the option text as well, and
      // leaving it there prints "أ. أ) الوقت" on the paper — so it is dropped
      // on the way in, before this ever reaches the editor or the exporter.
      setResult({ ...out, questions: out.questions.map(normalizeQuestionOptions) });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

      /*
        Verification runs after the quiz is on screen, not before. It is a
        per-question round trip to a service that may be asleep or absent, and
        making the teacher wait on it would trade a working quiz for a slower
        one. The summary appears when it resolves; until then the screen simply
        makes no claim.
      */
      setOutcomes(null);
      void (async () => {
        const { verifyQuizAnswers } = await import('@/services/quizVerification');
        const { verifyMathItem } = await import('@/services/ai/verifyMath');
        setOutcomes(await verifyQuizAnswers(out, verifyMathItem));
      })().catch(() => setOutcomes(null));
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of. The raw error text
      // is deliberately not shown: "HTTP 500" is not a sentence in a language
      // a teacher reads, and aiProvenance already records it for the badge.
      if (isAbortError(e)) setCancelled(true);
      else setError(t('generationFailed'));
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
    const title = lang === 'ar'
      ? `اختبار: ${topic.trim()}`
      : `Quiz: ${topic.trim()}`;
    const formState = {
      gradeIdx, subjectIdx, topic: topic.trim(),
      durationIdx, marksIdx, selectedTypes: JSON.stringify(Array.from(selectedTypes)),
    };
    // `updateItem` answers false when the material is no longer there — the
    // teacher deleted it from موادي while this screen still held its id. The
    // return value used to be dropped, so the button reported "تم التحديث"
    // over a material that no longer existed and the work was never saved
    // again. Folding the call into the condition makes a failed update fall
    // through to creating a fresh one, which is what pressing Save meant.
    if (savedId && (await updateItem(savedId, {
        title, subject: subjects[subjectIdx].name, grade: grades[gradeIdx].name,
        topic: topic.trim(), language: lang, content: JSON.stringify(result), formState,
      }))) {
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({
        type: 'quiz', title,
        subject: subjects[subjectIdx].name, grade: grades[gradeIdx].name,
        topic: topic.trim(), language: lang, content: JSON.stringify(result), formState,
      });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const getExportTitle = () => lang === 'ar' ? `اختبار: ${topic.trim()}` : `Quiz: ${topic.trim()}`;
  // Localised, like the picker above it. Taking `.name` straight off the
  // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
  // material — the screen showed الرياضيات and the exported file disagreed.
  const getExportMeta = () => ({ subject: subjectNames[subjectIdx]!, grade: gradeNames[gradeIdx]! });

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
    topic,
    lang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    formatText: formatQuizText,
    buildHTML: buildQuizHTML,
    buildSlidesHTML: buildQuizSlidesHTML,
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

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <AiSourceBadge onDark isRTL={isRTL} />
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('createQuizTitle')}
        </Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quizSubtitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={{ padding: 20 }}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} hidden={subjectHidden} />
        <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />

        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={text => { setTopic(text); setError(''); }}
          lang={lang as 'ar' | 'en'}
          isRTL={isRTL}
          colors={colors}
          accent={ACCENT}
          hasError={!!error && !topic}
          t={t}
        />

        <PickerField label={t('levelLabel')} value={diffLabels[diffIdx]} options={diffLabels} onChange={setDiffIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('quizDurationLabel')} value={durationLabels[durationIdx]} options={durationLabels} onChange={setDurationIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('totalMarksLabel')} value={marksLabels[marksIdx]} options={marksLabels} onChange={setMarksIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }]}>{t('questionTypesLabel')}</Text>
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {ALL_Q_TYPES.map(type => (
            <CheckboxRow key={type} label={TYPE_LABEL[type]} checked={selectedTypes.has(type)} onToggle={() => toggleType(type)} accent={ACCENT} colors={colors} isRTL={isRTL} />
          ))}
        </View>

        {/*
          The validation error (an empty topic) stays here, next to the field
          it is about. Generation failures moved down to GenerationStatus,
          beside the spinner they replace — they used to render above the form,
          out of sight of the button that had just been pressed.
        */}
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Almarai_400Regular', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button label={loading ? t('generatingQuiz') : t('generateQuizBtn')} onPress={() => generate()} loading={loading} disabled={!topic.trim()} fullWidth style={{ backgroundColor: ACCENT }} />
        {/*
          A greyed-out primary button with nothing next to it reads as a broken
          product rather than an unmet precondition. It says which one.
        */}
        {!topic.trim() ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
            {t('needTopicHint')}
          </Text>
        ) : null}
      </View>

      {/* Loading */}
      <GenerationStatus
        phase={loading ? 'loading' : cancelled ? 'cancelled' : (error && topic.trim()) ? 'error' : 'idle'}
        loadingLabel={t('generatingQuiz')}
        errorDetail={error}
        onCancel={cancelGenerate}
        onRetry={generate}
        colors={colors}
        isRTL={isRTL}
        lang={lang as 'ar' | 'en'}
        accent={ACCENT}
        t={t}
      />

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
            <View
              style={[styles.verifyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons
                name={verification.anySymbolic ? 'shield-checkmark' : 'library-outline'}
                size={14}
                color={verification.anySymbolic ? '#10B981' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.verifyText,
                  {
                    color: verification.anySymbolic ? '#10B981' : colors.mutedForeground,
                    textAlign: isRTL ? 'right' : 'left',
                  },
                ]}
              >
                {verification.anySymbolic
                  ? t('quizVerifiedCount', verification.symbolic, verification.total)
                  : t('quizVerifiedNone')}
              </Text>
            </View>
          )}
        </View>
      )}

      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={[styles.quizHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40', borderRadius: colors.radius }]}>
            <Text style={[styles.quizTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>{result.title}</Text>
            <View style={[styles.quizMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MetaPill icon="time-outline" text={`${result.duration} ${t('min')}`} color={ACCENT} />
              <MetaPill icon="star-outline" text={`${result.totalPoints} ${t('pts')}`} color={ACCENT} />
              <MetaPill icon="help-circle-outline" text={`${result.questions.length} Q`} color={ACCENT} />
            </View>
          </View>

          {/* Class Mode: project this quiz as whole-class response slides.
              Phones are banned in class, so students answer from their seats
              with printed أ ب ج د cards and the teacher reveals on screen. */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
              setPendingClassroomActivity(
                buildDeckFromQuiz(result, topic.trim(), lang === 'ar', {
                  lesson: grounding.lesson,
                  // Was a blanket `verified: false`, which hid the keys the
                  // verifier had actually proved. Per question now, so the
                  // projector badges exactly what was checked.
                  outcomes: effectiveOutcomes,
                  figureUri: bookFigureUri,
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
            <Ionicons name="tv-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 14 }}>
              {t('presentOnScreen')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAnswers(v => !v)}
            style={[styles.toggleBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={showAnswers ? 'eye-off-outline' : 'eye-outline'} size={16} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>
              {showAnswers ? t('hideAnswers') : t('showAnswers')}
            </Text>
          </Pressable>

          {result.questions.map((q, i) => {
            const tc = TYPE_COLOR[q.type as QType] ?? ACCENT;
            const o = effectiveOutcomes[i];
            return (
              <View key={q.id} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.qTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.qNumCircle, { backgroundColor: ACCENT }]}>
                    <Text style={[{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 12 }]}>{i + 1}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[{ color: tc, fontFamily: 'Cairo_500Medium', fontSize: 11 }]}>{TYPE_LABEL[q.type as QType] ?? q.type}</Text>
                  </View>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
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
                        isRTL={isRTL}
                        placeholder={t('pts')}
                      />
                    </View>
                    <Pressable
                      onPress={() => { void removeQuestion(i); }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('deleteQuestion')}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
                {/* Symbolic only, per question: `bank` is also the verifier-down
                    fallback, so naming it per item would vouch for a key nothing
                    checked. The aggregate row above still covers the rest. */}
                {o?.verifiedBy === 'symbolic' ? (
                  <View style={[styles.verifyRow, { marginTop: 0, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                    <Text style={[styles.verifyText, { color: '#10B981', textAlign: isRTL ? 'right' : 'left' }]}>
                      {t('verifiedBySymbolic')}
                    </Text>
                  </View>
                ) : null}
                {showAnswers && o?.verifiedBy === 'symbolic' && o.computedAnswer ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                    {isolateForeignRuns(t('verifiedComputed', prettifySymPy(o.computedAnswer)))}
                  </Text>
                ) : null}
                <View style={styles.qText}>
                  <EditableText
                    value={q.text}
                    onChange={next => updateQuestion(i, { text: next })}
                    colors={colors}
                    isRTL={isRTL}
                    placeholder={t('editPlaceholder')}
                    edited={editedQuestions.has(q.id)}
                  />
                </View>

                {q.options?.map((opt, oi) => {
                  const marker = optionMarkerState(showAnswers, opt, q.correctAnswer);
                  const isCorrect = marker === 'selected';
                  return (
                    <View key={oi} style={[styles.optRow, { backgroundColor: isCorrect ? '#10B981' + '15' : colors.muted, borderRadius: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.optLabel, { color: isCorrect ? '#10B981' : colors.mutedForeground, fontFamily: isCorrect ? 'Cairo_600SemiBold' : 'Almarai_400Regular' }]}>
                        {optionLetter(oi, lang === 'ar')}.
                      </Text>
                      <View style={{ flex: 1 }}>
                        <EditableText
                          value={opt}
                          onChange={next => updateOption(i, oi, next)}
                          colors={colors}
                          isRTL={isRTL}
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
                          accessibilityState={{ selected: isCorrect }}
                          accessibilityLabel={`${opt} — ${t('answer')}`}
                        >
                          <Ionicons
                            name={isCorrect ? 'checkmark-circle' : 'ellipse-outline'}
                            size={17}
                            color={isCorrect ? '#10B981' : colors.mutedForeground}
                          />
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {showAnswers && q.type === 'true_false' && (
                  <View style={[styles.ansBox, { backgroundColor: '#10B981' + '15', borderRadius: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[{ color: '#10B981', fontFamily: 'Cairo_500Medium', fontSize: 13 }]}>{t('answer')}:</Text>
                    <View style={{ flex: 1 }}>
                      <EditableText
                        value={q.correctAnswer}
                        onChange={next => updateQuestion(i, { correctAnswer: next })}
                        colors={colors}
                        isRTL={isRTL}
                        placeholder={t('editPlaceholder')}
                      />
                    </View>
                  </View>
                )}

                {showAnswers && q.type === 'short_answer' && (
                  <View style={[styles.ansBox, { backgroundColor: '#3B82F6' + '12', borderRadius: 8 }]}>
                    <EditableText
                      value={q.correctAnswer}
                      onChange={next => updateQuestion(i, { correctAnswer: next })}
                      colors={colors}
                      isRTL={isRTL}
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
                      isRTL={isRTL}
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
          accent={ACCENT}
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
          topic={topic.trim()}
        />
      )}
    </ScrollView>

    <ExportMenu
      visible={showExport}
      onClose={() => setShowExport(false)}
      onShare={handleShareText}
      onCopy={handleCopy}
      onPDF={handlePDF}
      onWord={handleWord}
      onSlides={handleSlides}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color + '18', borderRadius: 20 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function CheckboxRow({ label, checked, onToggle, accent, colors, isRTL }: {
  label: string; checked: boolean; onToggle: () => void;
  accent: string; colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.checkRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.checkbox, { borderColor: checked ? accent : colors.border, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text style={[{ color: colors.foreground, fontFamily: checked ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
    </Pressable>
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
  verifyRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontFamily: 'Cairo_600SemiBold', fontSize: 12, flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerTitle: { fontSize: 26 },
  headerSub: { fontSize: 13, marginTop: 4 },
  label: { fontSize: 13, marginBottom: 6 },
  checkboxGroup: { borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  checkRow: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  quizHeader: { padding: 16, borderWidth: 1, marginBottom: 16 },
  quizTitle: { fontSize: 16, marginBottom: 10 },
  quizMeta: { gap: 8, flexWrap: 'wrap' },
  toggleBtn: { alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  presentBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 12 },
  qCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  qTop: { alignItems: 'center', gap: 8, marginBottom: 10 },
  qNumCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  qText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  optRow: { alignItems: 'center', gap: 8, padding: 10, marginBottom: 6 },
  optLabel: { fontSize: 13, width: 20 },
  ansBox: { alignItems: 'center', gap: 6, padding: 10, marginTop: 8 },
  expBox: { padding: 10, marginTop: 8 },
});
