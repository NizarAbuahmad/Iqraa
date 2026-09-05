import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { generatorFigureCount, generatorLessonId, generatorUnitId, getUnitPriorKnowledge, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { WorksheetOutput } from '@/services/ai/AIService';
import { buildDeckFromWorksheet } from '@/services/classDeck';
import { bookFigureUri } from '@/services/bookFigureUri';
import { summarizeVerification, type VerifyOutcome } from '@/services/quizVerification';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectsWithoutCurriculum, topicPickerParams } from '@/services/lessonPrep';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { isAbortError } from '@/services/ai/aiProvenance';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { MathParagraph } from '@/components/ui/MathParagraph';
import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';
import { buildWorksheetHTML, buildWorksheetSlidesHTML, formatWorksheetText } from '@/services/share';

const ACCENT = '#8B5CF6';

type DifficultyLevel = 'normal' | 'high' | 'difficult';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
type QType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem';

const DIFFICULTY_IDS: DifficultyLevel[] = ['normal', 'high', 'difficult'];
const DIFFICULTY_MAP: Record<DifficultyLevel, Difficulty> = {
  normal: 'easy',
  high: 'medium',
  difficult: 'hard',
};
const NUM_Q_OPTIONS = [5, 8, 10, 12, 15, 20];
const ALL_Q_TYPES: QType[] = ['multiple_choice', 'short_answer', 'fill_blank', 'true_false', 'word_problem'];

type Level = 'easy' | 'medium' | 'hard';
/** Index-aligned with DIFFICULTY_IDS, so `diffIdx` doubles as the active level tab. */
const LEVELS: Level[] = ['easy', 'medium', 'hard'];
type LevelEntry = { result: WorksheetOutput; outcomes: VerifyOutcome[] | null; savedId?: string };

export default function WorksheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; gradeIdx?: string; subjectIdx?: string;
    topic?: string; diffIdx?: string; numQIdx?: string; selectedTypes?: string;
    isHomework?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = subjects.map(s => lang === 'ar' ? s.nameAr : s.name);
  const diffLabels = [t('difficultyNormal'), t('difficultyHigh'), t('difficultyDifficult')];
  const numQLabels = NUM_Q_OPTIONS.map(n => String(n));

  const parseTypes = (raw?: string): Set<QType> => {
    if (!raw) return new Set(['multiple_choice', 'short_answer']);
    try { return new Set(JSON.parse(raw) as QType[]); } catch { return new Set(['multiple_choice', 'short_answer']); }
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
  const [diffIdx, setDiffIdx] = useState(params.diffIdx ? parseInt(params.diffIdx, 10) : 0);

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
  const [numQIdx, setNumQIdx] = useState(params.numQIdx ? parseInt(params.numQIdx, 10) : 2);
  const [selectedTypes, setSelectedTypes] = useState<Set<QType>>(parseTypes(params.selectedTypes));
  const [includePriorReview, setIncludePriorReview] = useState(false);
  const [loading, setLoading] = useState(false);
  /**
   * Held across renders so Cancel can reach the in-flight request. A cancel
   * that only cleared the spinner would leave the call running and still
   * billing against AI_BUDGET_USD — the teacher would have stopped the
   * waiting, not the spending.
   */
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<WorksheetOutput | null>(null);
  /** null = not checked yet (or the check failed); [] onwards = per question. */
  const [outcomes, setOutcomes] = useState<VerifyOutcome[] | null>(null);
  /**
   * Set only by «ثلاثة مستويات»: the same paper at each difficulty, keyed by
   * level. The active level lives in `result` / `outcomes` / `savedId` as
   * usual, so save, export, present and the verify summary need no changes;
   * this only holds the two the teacher is not looking at.
   */
  const [levels, setLevels] = useState<Partial<Record<Level, LevelEntry>> | null>(null);
  /** null until first generate; then whether the worksheet used a confident KB lesson. */
  const [curriculumGrounded, setCurriculumGrounded] = useState<boolean | null>(null);
  /** Title of the curriculum lesson the output was anchored to, when grounded. */
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  // Prior-knowledge availability for the currently selected lesson (no fabrication)
  const priorKnowledge = (() => {
    if (!topic.trim()) return [] as string[];
    const g = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
    if (!g.lesson) return [] as string[];
    return getUnitPriorKnowledge(g.lesson.id);
  })();
  const priorReviewAvailable = priorKnowledge.length > 0;

  useEffect(() => {
    if (!priorReviewAvailable && includePriorReview) setIncludePriorReview(false);
  }, [priorReviewAvailable, includePriorReview]);

  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try { setResult(JSON.parse(item.content) as WorksheetOutput); } catch { /* noop */ }
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

  const isHomework = params.isHomework === '1';

  const verification = summarizeVerification(outcomes ?? []);

  /**
   * Same pattern as the quiz tool: verification runs after the worksheet is
   * on screen, against a service that may be asleep or absent. The summary
   * appears when it resolves; until then the screen makes no claim. The ref
   * drops a result that arrives after the teacher has switched to another
   * level — it would otherwise badge the wrong paper.
   */
  const verifyForRef = useRef<WorksheetOutput | null>(null);
  const verifyKeys = (out: WorksheetOutput) => {
    verifyForRef.current = out;
    setOutcomes(null);
    void (async () => {
      const { verifyWorksheetAnswers } = await import('@/services/quizVerification');
      const { verifyMathItem } = await import('@/services/ai/verifyMath');
      const checked = await verifyWorksheetAnswers(out, verifyMathItem);
      if (verifyForRef.current === out) setOutcomes(checked);
    })().catch(() => { if (verifyForRef.current === out) setOutcomes(null); });
  };

  /** Swap the paper on screen; everything below reads `result` + `diffIdx`. */
  const showLevel = (i: number) => {
    if (!levels || !result || i === diffIdx) return;
    const cur = LEVELS[diffIdx]!;
    const next: Partial<Record<Level, LevelEntry>> = { ...levels, [cur]: { result, outcomes, savedId } };
    const entry = next[LEVELS[i]!];
    if (!entry) return;
    setLevels(next);
    setDiffIdx(i);
    setResult(entry.result);
    setSavedId(entry.savedId);
    // null = never checked, or the check failed — ask again rather than show nothing.
    if (entry.outcomes) { verifyForRef.current = entry.result; setOutcomes(entry.outcomes); }
    else verifyKeys(entry.result);
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
  const generate = async (opts?: { regenerate?: boolean; levels?: boolean }) => {
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
    setLoading(true); setResult(null); setOutcomes(null); setCurriculumGrounded(null); setGroundedLesson(null);
    // ponytail: Regenerate inside three-level mode regenerates the active
    // level only and drops back to a single paper. Regenerating all three at
    // once is a `levels: true` regenerate if teachers ask for it.
    setLevels(null);
    setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
      const unitPrior = grounding.lesson ? getUnitPriorKnowledge(grounding.lesson.id) : [];
      const usePrior = includePriorReview && unitPrior.length > 0;
      const additionalContext = (
        grounding.grounded ? grounding.context : grounding.ungroundedNote
      ) || undefined;
      const baseReq = {
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        language: (lang === 'ar' ? 'arabic' : 'english') as 'arabic' | 'english',
        difficulty: DIFFICULTY_MAP[DIFFICULTY_IDS[diffIdx]],
        numQuestions: NUM_Q_OPTIONS[numQIdx],
        questionTypes: Array.from(selectedTypes),
        additionalContext,
        unitId: generatorUnitId(topic.trim(), lang as 'ar' | 'en'),
        lessonId: generatorLessonId(topic.trim(), lang as 'ar' | 'en'),
        bookFigureCount: generatorFigureCount(topic.trim(), lang as 'ar' | 'en'),
        contextSource: 'curriculum' as const,
        ...regenerationFields(opts?.regenerate === true, previous),
        includePriorReview: usePrior,
        priorKnowledge: usePrior ? unitPrior : undefined,
      };
      // Homework uses a distinct generator — not a worksheet clone.
      const call = (req: typeof baseReq) => isHomework
        ? aiService.generateHomework(req, { signal: controller.signal })
        : aiService.generateWorksheet(req, { signal: controller.signal });
      let out: WorksheetOutput;
      if (opts?.levels) {
        // Difficulty is part of the server's strict cache key, so these are
        // three independent pool slots — fanned out, not queued. One abort
        // signal covers all three.
        const outs = await Promise.all(LEVELS.map(d => call({ ...baseReq, difficulty: d })));
        const entries = Object.fromEntries(
          LEVELS.map((d, i) => [d, { result: outs[i]!, outcomes: null }]),
        ) as Record<Level, LevelEntry>;
        setLevels(entries);
        setDiffIdx(0);
        setSavedId(undefined);
        out = entries.easy.result;
      } else {
        out = await call(baseReq);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      verifyKeys(out);
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

  // Three papers on one topic need three titles in موادي and in the export.
  const levelSuffix = levels ? ` — ${diffLabels[diffIdx]}` : '';

  const handleSave = async () => {
    if (!result) return;
    const title = (isHomework
      ? (lang === 'ar' ? `واجب منزلي: ${topic.trim()}` : `Homework: ${topic.trim()}`)
      : (lang === 'ar' ? `ورقة عمل: ${topic.trim()}` : `Worksheet: ${topic.trim()}`)) + levelSuffix;
    const formState = {
      gradeIdx, subjectIdx, topic: topic.trim(),
      diffIdx, numQIdx, selectedTypes: JSON.stringify(Array.from(selectedTypes)),
      materialKind: isHomework ? 'homework' : 'worksheet',
      isHomework,
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
        type: 'worksheet', title,
        subject: subjects[subjectIdx].name, grade: grades[gradeIdx].name,
        topic: topic.trim(), language: lang, content: JSON.stringify(result), formState,
      });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  const typeLabels: Record<QType, string> = {
    multiple_choice: t('typeMultipleChoice'),
    short_answer: t('typeShortAnswer'),
    fill_blank: t('typeFillBlank'),
    true_false: t('typeTrueFalse'),
    word_problem: t('typeWordProblem'),
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const getExportTitle = () => (lang === 'ar' ? `ورقة عمل: ${topic.trim()}` : `Worksheet: ${topic.trim()}`) + levelSuffix;
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
    formatText: formatWorksheetText,
    buildHTML: buildWorksheetHTML,
    buildSlidesHTML: buildWorksheetSlidesHTML,
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
          {isHomework ? t('createHomework') : t('createWorksheetTitle')}
        </Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {isHomework ? t('homeworkSubtitle') : t('worksheetSubtitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={{ padding: 20 }}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} hidden={subjectHidden} />

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

        <PickerField label={t('difficultyLabel')} value={diffLabels[diffIdx]} options={diffLabels} onChange={setDiffIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('numQuestionsLabel')} value={numQLabels[numQIdx]} options={numQLabels} onChange={setNumQIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }]}>{t('questionTypesLabel')}</Text>
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {ALL_Q_TYPES.map(type => (
            <CheckboxRow key={type} label={typeLabels[type]} checked={selectedTypes.has(type)} onToggle={() => toggleType(type)} accent={ACCENT} colors={colors} isRTL={isRTL} />
          ))}
        </View>

        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: priorReviewAvailable ? 1 : 0.55 }]}>
          <CheckboxRow
            label={t('includePriorReviewLabel')}
            checked={includePriorReview && priorReviewAvailable}
            onToggle={() => { if (priorReviewAvailable) setIncludePriorReview(v => !v); }}
            accent={ACCENT}
            colors={colors}
            isRTL={isRTL}
            disabled={!priorReviewAvailable}
          />
          {!priorReviewAvailable ? (
            <Text style={{
              color: colors.mutedForeground,
              fontFamily: 'Almarai_400Regular',
              fontSize: 12,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}>
              {t('priorReviewUnavailableNote')}
            </Text>
          ) : null}
        </View>

        {/*
          The validation error (an empty topic) stays here, next to the field
          it is about. Generation failures moved down to GenerationStatus,
          beside the spinner they replace — they used to render above the form,
          out of sight of the button that had just been pressed.
        */}
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Almarai_400Regular', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button label={loading ? t('generating') : t('createWorksheetBtn')} onPress={() => generate()} loading={loading} disabled={!topic.trim()} fullWidth />
        {/* The same paper at every difficulty, for a class that is not one
            level. Costs three generations the first time a lesson is asked
            for; every teacher after that is served from the pools. */}
        <Button
          label={loading ? t('generating') : t('worksheetThreeLevelsBtn')}
          onPress={() => generate({ levels: true })}
          loading={loading}
          disabled={!topic.trim()}
          variant="secondary"
          fullWidth
          style={{ marginTop: 8 }}
        />
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
        loadingLabel={t('buildingWorksheet')}
        errorDetail={error}
        onCancel={cancelGenerate}
        onRetry={generate}
        colors={colors}
        isRTL={isRTL}
        lang={lang as 'ar' | 'en'}
        accent={ACCENT}
        t={t}
      />

      {/* Grounding status — never present ungrounded output as curriculum-backed */}
      {/* What the material is anchored to. Shown both ways: a teacher needs
          to know it IS tied to the lesson as much as when it isn't. */}
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

      {/* Result */}
      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          {levels ? (
            <View style={[styles.levelTabs, { borderColor: ACCENT + '40', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {diffLabels.map((label, i) => {
                const active = i === diffIdx;
                return (
                  <Pressable
                    key={label}
                    onPress={() => showLevel(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.levelTab, { backgroundColor: active ? ACCENT : 'transparent', borderRadius: colors.radius }]}
                  >
                    <Text style={{ color: active ? '#fff' : ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.successBanner, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="document-text" size={18} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{result.title}</Text>
          </View>

          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginBottom: 16, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }]}>
            {result.instructions}
          </Text>

          {/* Class Mode: project the same worksheet the class is holding.
              Students answer from their seats (hands raised / whiteboards);
              the teacher reveals each answer on screen. */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
              setPendingClassroomActivity(
                buildDeckFromWorksheet(result, topic.trim(), lang === 'ar', {
                  lesson: grounding.lesson,
                  // Was a blanket verified: false, which hid the keys the
                  // verifier had actually proved. Per question now, so the
                  // projector badges exactly what was checked.
                  outcomes: outcomes ?? undefined,
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

          {result.sections.map(sec => (
            <View key={sec.title} style={{ marginBottom: 20 }}>
              <Text style={[styles.secTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{sec.title}</Text>
              {sec.questions.map((q, i) => (
                <View key={i} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.qNum, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <MathParagraph
                      text={q.text}
                      style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}
                      isRTL={isRTL}
                    />
                    {q.options?.map(o => (
                      <View key={o} style={[styles.optionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={[styles.optionDot, { borderColor: colors.border }]} />
                        <MathParagraph
                          text={o}
                          style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}
                          containerStyle={{ flex: 1 }}
                          isRTL={isRTL}
                        />
                      </View>
                    ))}
                    <Text style={[styles.pts, { color: ACCENT, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{q.points} {t('pts')}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {result.answerKey.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={[styles.akHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="key-outline" size={15} color={ACCENT} />
                <Text style={[styles.akTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{t('answerKeyTitle')}</Text>
              </View>
              <View style={[styles.akBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {result.answerKey.map(item => {
                  // Outcomes are flat and positional; `item.num` is the same
                  // flat position, 1-based. Symbolic only — `bank` is also the
                  // verifier-down fallback and must not read as a per-key claim.
                  const o = outcomes?.[item.num - 1];
                  const proved = o?.verifiedBy === 'symbolic';
                  return (
                  <View key={item.num} style={[styles.akRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.akNum, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>{item.num}.</Text>
                    <View style={{ flex: 1 }}>
                      <MathParagraph
                        text={item.answer}
                        style={{ fontSize: styles.akAnswer.fontSize, lineHeight: styles.akAnswer.lineHeight, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }}
                        isRTL={isRTL}
                      />
                      {proved ? (
                        <View style={[styles.verifyRow, { marginTop: 2, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                          <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                          <Text style={[styles.verifyText, { fontSize: 11, color: '#10B981', textAlign: isRTL ? 'right' : 'left' }]}>
                            {t('verifiedBySymbolic')}
                          </Text>
                        </View>
                      ) : null}
                      {proved && o?.computedAnswer ? (
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                          {isolateForeignRuns(t('verifiedComputed', prettifySymPy(o.computedAnswer)))}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  );
                })}
              </View>
            </View>
          )}
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
          materialType="worksheet"
          toolId={isHomework ? 'homework' : 'worksheet'}
          topic={topic.trim()}
          marginTop={8}
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

function CheckboxRow({ label, checked, onToggle, accent, colors, isRTL, disabled }: {
  label: string; checked: boolean; onToggle: () => void;
  accent: string; colors: ReturnType<typeof useColors>; isRTL: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      style={[styles.checkRow, { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: disabled ? 0.6 : 1 }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? accent : colors.border, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text style={[{ color: disabled ? colors.mutedForeground : colors.foreground, fontFamily: checked ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The shared dropdown wearing this screen's skin: a shorter list and a
 * violet-tinted selected row. Binding them here rather than at each of the
 * four call sites means a fifth picker cannot be added half-styled — which is
 * how the 45-line copy this replaces drifted away from
 * components/ui/PickerField in the first place.
 *
 * quiz's copy also tinted the trigger border while open and this one did not,
 * which is drift rather than intent; left as-is here so this commit changes
 * nothing visually.
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
  successBanner: { alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, marginBottom: 12 },
  levelTabs: { borderWidth: 1, padding: 4, gap: 4, marginBottom: 12 },
  levelTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  secTitle: { fontSize: 14, marginBottom: 10 },
  presentBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 16 },
  qCard: { padding: 14, borderWidth: 1, gap: 10, marginBottom: 8 },
  qNum: { fontSize: 14, width: 20 },
  optionRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  optionDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, flexShrink: 0 },
  pts: { fontSize: 11, marginTop: 8 },
  akHeader: { alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  akTitle: { fontSize: 14 },
  akBody: { borderWidth: 1, padding: 14 },
  akRow: { gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  akNum: { fontSize: 13, width: 22 },
  akAnswer: { flex: 1, fontSize: 13, lineHeight: 19 },
});
