import React, { useEffect, useRef, useState } from 'react';
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
import { getUnitPriorKnowledge, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId } from '@/services/ai/regeneration';
import { WorksheetOutput } from '@/services/ai/AIService';
import { buildDeckFromWorksheet } from '@/services/classDeck';
import { ShortPaperNotice } from '@/components/ui/ShortPaperNotice';
import { bookFigureUri } from '@/services/bookFigureUri';
import { summarizeVerification, type VerifyOutcome } from '@/services/quizVerification';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, scopeFromParams, subjectPickerLabels } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { aiErrorMessageKey, isAbortError } from '@/services/ai/aiProvenance';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { captureGenerationScope, materialScope, reopenedGenerationScope, type GenerationScope } from '@/services/generationScope';
import { createVerificationTracker } from '@/services/verificationTracker';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { isolateForeignRuns, prettifySymPy } from '@/services/mathRender';
import { buildWorksheetHTML, buildWorksheetSlidesHTML, formatWorksheetText } from '@/services/share';
import { EditableText } from '@/components/ui/Editable';
import { MathParagraph } from '@/components/ui/MathParagraph';
import { optionLetter } from '@/services/optionLabels';
import { confirm } from '@/services/confirm';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { palette } from '@/constants/colors';
import {
  answerFor,
  applyWorksheetAnswerEdit,
  applyWorksheetOptionEdit,
  applyWorksheetQuestionEdit,
  flatIndexOf,
  parsePoints,
  removeWorksheetQuestionAt } from '@/services/worksheetEdits';
import { optionMarkerState } from '@/services/quizEdits';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { nextFrame } from '@/services/nextFrame';
import { buildWorksheetRequest } from '@/services/generatorRequests';
import { readHomeworkParam, readIndexParam } from '@/services/materialParams';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

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
type LevelEntry = {
  result: WorksheetOutput;
  outcomes: VerifyOutcome[] | null;
  savedId?: string;
  /** Flat question positions the teacher has hand-edited on this level's paper. */
  editedFlatIndexes: Set<number>;
};

export default function WorksheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; gradeIdx?: string; subjectIdx?: string;
    topic?: string; diffIdx?: string; numQIdx?: string; selectedTypes?: string;
    isHomework?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => uiLang === 'ar' ? g.nameAr : g.name);
  const diffLabels = [t('difficultyNormal'), t('difficultyHigh'), t('difficultyDifficult')];
  const numQLabels = NUM_Q_OPTIONS.map(n => String(n));

  const parseTypes = (raw?: string): Set<QType> => {
    if (!raw) return new Set(['multiple_choice', 'short_answer']);
    try { return new Set(JSON.parse(raw) as QType[]); } catch { return new Set(['multiple_choice', 'short_answer']); }
  };

  // An index the picker list cannot honour is NOT index 0 — see
  // `scopeFromParams`. Grounding the topic is what recovers the right scope.
  // Only the grades/subjects this teacher picked on /setup-subjects are offered.
  const teacherScope = useTeacherScope();
  const [initialScope] = useState(() => scopeFromParams(params, uiLang, teacherScope.defaultScope));
  const [gradeIdx, setGradeIdx] = useState(initialScope.gradeIdx);
  // Index-aligned flags rather than a pre-filtered `subjects`: these positions
  // are persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = teacherScope.subjectHiddenFor(grades[gradeIdx].id);
  // Labels are per-grade too: Grade 6's creative-arts book has no music
  // in it, so it must not be offered under the combined name. Same
  // index alignment as the mask above.
  const subjectNames = subjectPickerLabels(grades[gradeIdx].id, uiLang);
  const [subjectIdx, setSubjectIdx] = useState(initialScope.subjectIdx);
  // The picked subject's material language — English papers are in English.
  const lang = contentLang(subjects[subjectIdx].id, uiLang);
  const [topic, setTopic] = useState(() => topicInLang(
    params.topic ?? '', uiLang, contentLang(subjects[initialScope.subjectIdx].id, uiLang),
    { gradeId: grades[initialScope.gradeIdx].id, subjectId: subjects[initialScope.subjectIdx].id },
  ));
  useWarmGrounding(topic, lang);
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
  const [numQIdx, setNumQIdx] = useState(readIndexParam(params.numQIdx, NUM_Q_OPTIONS.length, 2));
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
  useAbortOnUnmount(abortRef);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<WorksheetOutput | null>(null);
  /** null = not checked yet (or the check failed); [] onwards = per question. */
  const [outcomes, setOutcomes] = useState<VerifyOutcome[] | null>(null);
  /**
   * Whether the verifier proved the worked example's own answer. The example is
   * the one thing on the page students are told to study, so it earns a badge
   * only on a symbolic proof — never on the bank fallback, and never while the
   * check is still running.
   */
  const [exampleOutcome, setExampleOutcome] = useState<VerifyOutcome | null>(null);
  /**
   * Flat question positions (0-based, same indexing as `outcomes`) the
   * teacher has hand-edited. A verified badge is dropped for these — the
   * verifier proved the *generated* text, and an edit may have changed the
   * very thing it proved. Same rule as the quiz screen's `editedQuestions`,
   * keyed by position instead of a question id because `WorksheetQuestion`
   * has none.
   */
  const [editedFlatIndexes, setEditedFlatIndexes] = useState<Set<number>>(new Set());
  /**
   * Set only by «ثلاثة مستويات»: the same paper at each difficulty, keyed by
   * level. The active level lives in `result` / `outcomes` / `savedId` as
   * usual, so save, export, present and the verify summary need no changes;
   * this only holds the two the teacher is not looking at.
   */
  const [levels, setLevels] = useState<Partial<Record<Level, LevelEntry>> | null>(null);
  /**
   * The scope the paper on screen was generated under — pickers, topic and
   * the grounded lesson, frozen at generation time (or re-derived from the
   * saved form state on reopen). Save, export and present read this, never
   * the live pickers: changing the subject clears the topic but keeps the
   * paper, and reading the form at that point stored it under the new
   * subject as «ورقة عمل: » and re-grounded the deck from an empty topic.
   */
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => (params.savedId ? reopenedGenerationScope(initialScope, topic, lang) : null),
  );
  const scope = materialScope(generated, { gradeIdx, subjectIdx, topic });
  // The paper on screen keeps the language it was generated in, even after the
  // pickers move on — like everything else read off `scope`.
  const outLang = contentLang(subjects[scope.subjectIdx].id, uiLang);
  const outT = getT(outLang);
  const outRTL = outLang === 'ar';
  const curriculumGrounded: boolean | null = generated ? generated.grounded : null;
  const groundedLesson: string | null = generated?.lesson
    ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
    : null;
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  // Prior-knowledge availability for the currently selected lesson (no fabrication)
  const priorKnowledge = (() => {
    if (!topic.trim()) return [] as string[];
    const g = resolveGeneratorGrounding(topic.trim(), lang, { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
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
    if (result) setSaveLabel('save');
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

  const isHomework = readHomeworkParam(params.isHomework);

  /**
   * A hand-edit invalidates whatever the verifier proved about that question
   * — it checked the generated text, not whatever the teacher typed over it.
   * Same shield-dropping rule as the quiz screen, applied by flat position.
   */
  const effectiveOutcomes: (VerifyOutcome | undefined)[] =
    outcomes && result
      ? outcomes.map((o, i) => (editedFlatIndexes.has(i) ? undefined : o))
      : [];
  const verification = summarizeVerification(
    effectiveOutcomes.filter((o): o is VerifyOutcome => !!o),
  );

  /**
   * Same pattern as the quiz tool: verification runs after the worksheet is
   * on screen, against a service that may be asleep or absent. The summary
   * appears when it resolves; until then the screen makes no claim. The ref
   * drops a result that arrives after the teacher has switched to another
   * level — it would otherwise badge the wrong paper.
   */
  const verifyRef = useRef(createVerificationTracker<WorksheetOutput>());
  const verifyKeys = (out: WorksheetOutput) => {
    verifyRef.current.begin(out);
    setOutcomes(null);
    setExampleOutcome(null);
    void (async () => {
      const { verifyWorksheetAnswers } = await import('@/services/quizVerification');
      const { verifyMathItem } = await import('@/services/ai/verifyMath');
      const [checked, example] = await Promise.all([
        verifyWorksheetAnswers(out, verifyMathItem),
        out.workedExample ? verifyMathItem(out.workedExample.problem, out.workedExample.answer) : Promise.resolve(null),
      ]);
      if (verifyRef.current.accepts(out)) { setOutcomes(checked); setExampleOutcome(example); }
    })().catch(() => { if (verifyRef.current.accepts(out)) { setOutcomes(null); setExampleOutcome(null); } });
  };

  /** Swap the paper on screen; everything below reads `result` + `diffIdx`. */
  const showLevel = (i: number) => {
    if (!levels || !result || i === diffIdx) return;
    const cur = LEVELS[diffIdx]!;
    const next: Partial<Record<Level, LevelEntry>> = { ...levels, [cur]: { result, outcomes, savedId, editedFlatIndexes } };
    const entry = next[LEVELS[i]!];
    if (!entry) return;
    setLevels(next);
    setDiffIdx(i);
    setResult(entry.result);
    setSavedId(entry.savedId);
    setEditedFlatIndexes(entry.editedFlatIndexes);
    // null = never checked, or the check failed — ask again rather than show nothing.
    if (entry.outcomes) { verifyRef.current.begin(entry.result); setOutcomes(entry.outcomes); }
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
    // Everything a failed or cancelled run must hand back: the paper, its
    // badges, edits and levels, and the scope it was generated under. It
    // used to be cleared up front and never restored, so Cancel on a
    // regenerate threw away the unsaved paper the teacher was looking at.
    const held = { result, outcomes, editedFlatIndexes, levels, savedId, generated };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // paper — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    const conflict = groundedSubjectConflict(topic.trim(), lang, subjects[subjectIdx].id, grades[gradeIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setResult(null); setOutcomes(null);
    verifyRef.current.drop();
    setEditedFlatIndexes(new Set());
    // ponytail: Regenerate inside three-level mode regenerates the active
    // level only and drops back to a single paper. Regenerating all three at
    // once is a `levels: true` regenerate if teachers ask for it.
    setLevels(null);
    setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang, { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
      const baseReq = buildWorksheetRequest({
        gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
        subjectName: subjects[subjectIdx].name,
        topic,
        lang,
        difficulty: DIFFICULTY_MAP[DIFFICULTY_IDS[diffIdx]],
        numQuestions: NUM_Q_OPTIONS[numQIdx],
        questionTypes: Array.from(selectedTypes),
        includePriorReview,
        regenerate: opts?.regenerate === true,
        previous,
      }, grounding);
      // Homework uses a distinct generator — not a worksheet clone.
      const call = (req: typeof baseReq) => isHomework
        ? aiService.generateHomework(req, { signal: controller.signal })
        : aiService.generateWorksheet(req, { signal: controller.signal });
      let out: WorksheetOutput;
      if (opts?.levels) {
        // Difficulty is part of the server's strict cache key, so these are
        // three independent pool slots — fanned out, not queued. One abort
        // signal covers all three.
        // Settled, not `all`: one failed level used to throw away the two
        // that had already come back and been paid for. A cancel still
        // cancels the lot; a plain failure keeps whatever finished.
        const settled = await Promise.allSettled(LEVELS.map(d => call({ ...baseReq, difficulty: d })));
        const aborted = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected' && isAbortError(s.reason));
        if (aborted) throw aborted.reason;
        const entries: Partial<Record<Level, LevelEntry>> = {};
        settled.forEach((s, i) => {
          if (s.status === 'fulfilled') entries[LEVELS[i]!] = { result: s.value, outcomes: null, editedFlatIndexes: new Set<number>() };
        });
        const first = LEVELS.find(d => entries[d]);
        if (!first) throw (settled[0] as PromiseRejectedResult).reason;
        if (LEVELS.some(d => !entries[d])) showToast(t('levelsPartial'));
        setLevels(entries);
        setDiffIdx(LEVELS.indexOf(first));
        setSavedId(undefined);
        out = entries[first]!.result;
      } else {
        out = await call(baseReq);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      verifyKeys(out);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of. The raw error text
      // is deliberately not shown: "HTTP 500" is not a sentence in a language
      // a teacher reads, and aiProvenance already records it for the badge.
      if (isAbortError(e)) setCancelled(true);
      else setError(t(aiErrorMessageKey(e)));
      // Hand back what was on screen; a stop or a failure is not a reason to
      // lose it. The scope goes back with it so the badges and the grounding
      // notice describe the restored paper, not the one that never came.
      if (held.result) {
        setResult(held.result);
        setOutcomes(held.outcomes);
        setEditedFlatIndexes(held.editedFlatIndexes);
        setLevels(held.levels);
        setSavedId(held.savedId);
        setGenerated(held.generated);
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

  // Three papers on one topic need three titles in موادي and in the export.
  const levelSuffix = levels
    ? ` — ${[outT('difficultyNormal'), outT('difficultyHigh'), outT('difficultyDifficult')][diffIdx]}`
    : '';

  /**
   * One title for موادي and for every export. The export used to keep its
   * own copy, which never learnt about homework — a saved «واجب بيتي» left
   * the app as «ورقة عمل».
   */
  const materialTitle = () => (isHomework
    ? (outLang === 'ar' ? `واجب بيتي: ${scope.topic}` : `Homework: ${scope.topic}`)
    : (outLang === 'ar' ? `ورقة عمل: ${scope.topic}` : `Worksheet: ${scope.topic}`)) + levelSuffix;

  const handleSave = async () => {
    if (!result) return;
    const title = materialTitle();
    const formState = {
      gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic,
      diffIdx, numQIdx, selectedTypes: JSON.stringify(Array.from(selectedTypes)),
      materialKind: isHomework ? 'homework' : 'worksheet',
      isHomework,
    };
    // Built once: the two branches below used to each spell out the payload.
    const payload = {
      title, subject: subjects[scope.subjectIdx].name, grade: grades[scope.gradeIdx].name,
      topic: scope.topic, language: outLang, content: JSON.stringify(result), formState,
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
      const saved = await saveItem({ type: 'worksheet', ...payload });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  /** Marks the paper dirty and drops the verified badge at this position. */
  const markEdited = (flatIndex: number) => {
    if (flatIndex < 0) return;
    setEditedFlatIndexes(prev => new Set(prev).add(flatIndex));
    setSaveLabel('save');
  };

  const updateQuestionText = (sectionIndex: number, questionIndex: number, text: string) => {
    if (!result) return;
    markEdited(flatIndexOf(result, sectionIndex, questionIndex));
    setResult(prev => (prev ? applyWorksheetQuestionEdit(prev, sectionIndex, questionIndex, { text }) : prev));
  };

  const updateQuestionPoints = (sectionIndex: number, questionIndex: number, raw: string) => {
    if (!result) return;
    // Marks must stay a positive number — a zero-mark question takes a
    // student's time and counts for nothing.
    const points = parsePoints(raw);
    if (points === null) return;
    markEdited(flatIndexOf(result, sectionIndex, questionIndex));
    setResult(prev => (prev ? applyWorksheetQuestionEdit(prev, sectionIndex, questionIndex, { points }) : prev));
  };

  const updateOption = (sectionIndex: number, questionIndex: number, optionIndex: number, next: string) => {
    if (!result) return;
    markEdited(flatIndexOf(result, sectionIndex, questionIndex));
    setResult(prev => (prev ? applyWorksheetOptionEdit(prev, sectionIndex, questionIndex, optionIndex, next) : prev));
  };

  /** Free-text retype, or a tap marking a different option correct. */
  const updateAnswer = (sectionIndex: number, questionIndex: number, next: string) => {
    if (!result) return;
    markEdited(flatIndexOf(result, sectionIndex, questionIndex));
    setResult(prev => (prev ? applyWorksheetAnswerEdit(prev, sectionIndex, questionIndex, next) : prev));
  };

  const removeQuestion = async (sectionIndex: number, questionIndex: number) => {
    const q = result?.sections[sectionIndex]?.questions[questionIndex];
    if (!q || !result) return;
    const ok = await confirm({
      title: t('deleteQuestion'),
      message: q.text,
      confirmLabel: t('remove'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    const flatIndex = flatIndexOf(result, sectionIndex, questionIndex);
    const next = removeWorksheetQuestionAt(result, sectionIndex, questionIndex);
    setResult(next);
    // `outcomes` and `editedFlatIndexes` are positional against the old flat
    // list — a delete shifts every later position down by one, not just this
    // question's slot, or the badges after it would land on the wrong item.
    // A check still in flight is for the old list and would land one slot
    // off — it is dropped and run again for the new one.
    verifyRef.current.drop();
    if (outcomes) setOutcomes(outcomes.filter((_, i) => i !== flatIndex));
    else verifyKeys(next);
    setEditedFlatIndexes(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < flatIndex) next.add(i);
        else if (i > flatIndex) next.add(i - 1);
      });
      return next;
    });
    setSaveLabel('save');
  };

  const typeLabels: Record<QType, string> = {
    multiple_choice: t('typeMultipleChoice'),
    short_answer: t('typeShortAnswer'),
    fill_blank: t('typeFillBlank'),
    true_false: t('typeTrueFalse'),
    word_problem: t('typeWordProblem'),
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

  const getExportTitle = materialTitle;
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
    lang: outLang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    formatText: (ws, title, meta, isAr) => formatWorksheetText(ws, title, meta, isAr, showAnswers),
    buildHTML: (ws, title, meta, isAr, figures) => buildWorksheetHTML(ws, title, meta, isAr, figures, showAnswers),
    buildSlidesHTML: (ws, title, meta, isAr, figures) => buildWorksheetSlidesHTML(ws, title, meta, isAr, figures, showAnswers),
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
      contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ToolHeader topPad={topPad} isRTL={isRTL} title={isHomework ? t('createHomework') : t('createWorksheetTitle')} subtitle={isHomework ? t('homeworkSubtitle') : t('worksheetSubtitle')} />

      {/* Form */}
      <View style={{ padding: 20 }}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} hidden={teacherScope.gradeHidden} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} hidden={subjectHidden} />

        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={text => { setTopic(text); setError(''); }}
          lang={lang}
          isRTL={isRTL}
          colors={colors}
          accent={ACCENT}
          hasError={!!error && !topic}
          t={t}
        />

        {/* In three-level mode the difficulty IS the active tab, so the picker
            switches papers instead of relabelling the one on screen — which
            filed it under the wrong level on the next tab tap. */}
        <PickerField label={t('difficultyLabel')} value={diffLabels[diffIdx]} options={diffLabels} onChange={i => (levels ? showLevel(i) : setDiffIdx(i))} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('numQuestionsLabel')} value={numQLabels[numQIdx]} options={numQLabels} onChange={setNumQIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        {isHomework ? null : (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, marginTop: -8, marginBottom: 14, textAlign: isRTL ? 'right' : 'left' }}>
            {t('numQuestionsIncludesExample')}
          </Text>
        )}

        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }]}>{t('questionTypesLabel')}</Text>
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
              fontSize: 13, lineHeight: 21,
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
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontSize: 15, lineHeight: 24, fontFamily: 'Almarai_400Regular', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
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
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
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
        lang={uiLang}
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
                color={verification.anySymbolic ? '#067647' : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.verifyText,
                  {
                    color: verification.anySymbolic ? '#067647' : colors.mutedForeground,
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
                    aria-selected={active}
                    style={[styles.levelTab, { backgroundColor: active ? ACCENT : 'transparent', borderRadius: colors.radius }]}
                  >
                    <Text style={{ color: active ? palette.primaryForeground : ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={[styles.successBanner, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="document-text" size={18} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, flex: 1, textAlign: outRTL ? 'right' : 'left' }]}>{result.title}</Text>
          </View>

          <ShortPaperNotice shortfall={result.shortfall} />

          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 16, lineHeight: 20, textAlign: outRTL ? 'right' : 'left' }]}>
            {result.instructions}
          </Text>

          {/* Class Mode: project the same worksheet the class is holding.
              Students answer from their seats (hands raised / whiteboards);
              the teacher reveals each answer on screen. */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setPendingClassroomActivity(
                buildDeckFromWorksheet(result, scope.topic, outRTL, {
                  // The lesson this paper was generated for — not one re-derived
                  // from whatever the topic box says now.
                  lesson: scope.lesson,
                  // Was a blanket verified: false, which hid the keys the
                  // verifier had actually proved. Per question now, so the
                  // projector badges exactly what was checked — and not a
                  // key the teacher has since hand-edited on this screen.
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
                backgroundColor: ACCENT_FILL,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="tv-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 14 }}>
              {t('presentOnScreen')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowAnswers(v => !v)}
            style={[styles.toggleBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={showAnswers ? 'eye-off-outline' : 'eye-outline'} size={16} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }]}>
              {showAnswers ? t('hideAnswers') : t('showAnswers')}
            </Text>
          </Pressable>

          {result.workedExample ? (
            <View
              style={[styles.workedCard, { backgroundColor: ACCENT + '0F', borderColor: ACCENT + '40', borderRadius: colors.radius }]}
              accessible
              accessibilityLabel={outT('workedExampleTitle')}
            >
              <View style={[styles.akHeader, { flexDirection: outRTL ? 'row-reverse' : 'row', marginTop: 0 }]}>
                <Ionicons name="create-outline" size={15} color={ACCENT} />
                <Text style={[styles.akTitle, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', textAlign: outRTL ? 'right' : 'left' }]}>{outT('workedExampleTitle')}</Text>
              </View>
              <MathParagraph
                text={result.workedExample.problem}
                isRTL={outRTL}
                containerStyle={{ marginBottom: 8 }}
                style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 24, textAlign: outRTL ? 'right' : 'left' }}
              />
              {result.workedExample.steps.map((step, i) => (
                <View key={i} style={[styles.optionRow, { flexDirection: outRTL ? 'row-reverse' : 'row', alignItems: 'flex-start' }]}>
                  <Text style={[styles.optLabel, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>{i + 1}.</Text>
                  <MathParagraph
                    text={step}
                    isRTL={outRTL}
                    containerStyle={{ flex: 1 }}
                    style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 22, textAlign: outRTL ? 'right' : 'left' }}
                  />
                </View>
              ))}
              {exampleOutcome?.verifiedBy === 'symbolic' ? (
                <View style={[styles.verifyRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Ionicons name="shield-checkmark" size={12} color="#067647" />
                  <Text style={[styles.verifyText, { fontSize: 11, color: '#067647', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('verifiedBySymbolic')}
                  </Text>
                </View>
              ) : null}
              {result.workedExample.selfExplain ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: outRTL ? 'right' : 'left' }}>
                  {isolateForeignRuns(result.workedExample.selfExplain)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {result.sections.map((sec, si) => (
            <View key={sec.title} style={{ marginBottom: 20 }}>
              <Text style={[styles.secTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: outRTL ? 'right' : 'left' }]}>{sec.title}</Text>
              {sec.questions.map((q, i) => {
                const correctAnswer = answerFor(result, si, i);
                const flatIndex = flatIndexOf(result, si, i);
                return (
                <View key={i} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                  {/* Numbered straight through, as the answer key and both
                      exports are — per-section numbering made «٣» in the key
                      point at a different question on screen. */}
                  <Text style={[styles.qNum, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>{flatIndex + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <EditableText
                      value={q.text}
                      onChange={next => updateQuestionText(si, i, next)}
                      colors={colors}
                      isRTL={outRTL}
                      placeholder={t('editPlaceholder')}
                      edited={editedFlatIndexes.has(flatIndex)}
                    />
                    {q.options?.map((o, oi) => {
                      const marker = optionMarkerState(showAnswers, o, correctAnswer);
                      const isCorrect = marker === 'selected';
                      return (
                        <View key={oi} style={[styles.optionRow, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                          <Text style={[styles.optLabel, { color: isCorrect ? '#067647' : colors.mutedForeground, fontFamily: 'ReadexPro_500Medium' }]}>
                            {optionLetter(oi, outRTL)}.
                          </Text>
                          <View style={{ flex: 1 }}>
                            <EditableText
                              value={o}
                              onChange={next => updateOption(si, i, oi, next)}
                              colors={colors}
                              isRTL={outRTL}
                              placeholder={t('editPlaceholder')}
                            />
                          </View>
                          {/* Marking the answer is a choice among the options, so
                              it is made by picking one rather than retyping it
                              into the key below — that also removes the way a
                              retyped key could stop matching any option's text.
                              It disappears with the rest of the key: it names
                              the answer to a screen reader as well as drawing
                              it, so leaving it up while "hide answers" is on
                              shows the class the answer. */}
                          {marker !== 'hidden' && (
                            <Pressable
                              onPress={() => updateAnswer(si, i, o)}
                              hitSlop={6}
                              accessibilityRole="button"
                              aria-selected={isCorrect}
                              accessibilityLabel={`${o} — ${t('answer')}`}
                            >
                              <Ionicons
                                name={isCorrect ? 'checkmark-circle' : 'ellipse-outline'}
                                size={16}
                                color={isCorrect ? '#067647' : colors.mutedForeground}
                              />
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                    <View style={[styles.qFooter, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                      <View style={{ minWidth: 54 }}>
                        <EditableText
                          value={`${q.points}`}
                          onChange={next => updateQuestionPoints(si, i, next)}
                          colors={colors}
                          isRTL={outRTL}
                          placeholder={outT('pts')}
                        />
                      </View>
                      <Text style={[styles.pts, { color: ACCENT, fontFamily: 'ReadexPro_500Medium' }]}>{outT('pts')}</Text>
                      <Pressable
                        onPress={() => { void removeQuestion(si, i); }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('deleteQuestion')}
                        style={{ marginLeft: outRTL ? 0 : 'auto', marginRight: outRTL ? 'auto' : 0 }}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  </View>
                </View>
                );
              })}
            </View>
          ))}

          {showAnswers && result.answerKey.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={[styles.akHeader, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="key-outline" size={15} color={ACCENT} />
                <Text style={[styles.akTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: outRTL ? 'right' : 'left' }]}>{outT('answerKeyTitle')}</Text>
              </View>
              <View style={[styles.akBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {/* `item.num` is the same 1-based flat position as `sections[].questions[]`
                    in on-paper order — this is how an edit here finds its own question. */}
                {(() => {
                  const flatPositions = result.sections.flatMap((sec, si) => sec.questions.map((_, qi) => ({ si, qi })));
                  return result.answerKey.map(item => {
                  // Outcomes are flat and positional; `item.num` is the same
                  // flat position, 1-based. Symbolic only — `bank` is also the
                  // verifier-down fallback and must not read as a per-key claim.
                  // A hand-edit invalidates it — `effectiveOutcomes` drops it.
                  const o = effectiveOutcomes[item.num - 1];
                  const proved = o?.verifiedBy === 'symbolic';
                  const pos = flatPositions[item.num - 1];
                  return (
                  <View key={item.num} style={[styles.akRow, { flexDirection: outRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.akNum, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>{item.num}.</Text>
                    <View style={{ flex: 1 }}>
                      <EditableText
                        value={item.answer}
                        onChange={next => { if (pos) updateAnswer(pos.si, pos.qi, next); }}
                        colors={colors}
                        isRTL={outRTL}
                        placeholder={t('editPlaceholder')}
                      />
                      {item.solution?.length ? (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
                            {t('workedSolutionTitle')}
                          </Text>
                          {item.solution.map((line, li) => (
                            <MathParagraph
                              key={li}
                              text={`${li + 1}) ${line}`}
                              isRTL={isRTL}
                              style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}
                            />
                          ))}
                        </View>
                      ) : null}
                      {proved ? (
                        <View style={[styles.verifyRow, { marginTop: 2, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                          <Ionicons name="shield-checkmark" size={12} color="#067647" />
                          <Text style={[styles.verifyText, { fontSize: 11, color: '#067647', textAlign: isRTL ? 'right' : 'left' }]}>
                            {t('verifiedBySymbolic')}
                          </Text>
                        </View>
                      ) : null}
                      {proved && o?.computedAnswer ? (
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                          {isolateForeignRuns(t('verifiedComputed', prettifySymPy(o.computedAnswer)))}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  );
                  });
                })()}
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
          topic={scope.topic}
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
      <Text style={[{ color: disabled ? colors.mutedForeground : colors.foreground, fontFamily: checked ? 'ReadexPro_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
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
 * The open trigger's border tint was bound here for one commit, after this
 * screen turned out to be the only generator without it. It now lives in the
 * component, because the answer was that every screen wanted it.
 */
function PickerField(props: React.ComponentProps<typeof SharedPickerField>) {
  return <SharedPickerField maxHeight={180} selectedTint={ACCENT + '15'} {...props} />;
}

const styles = StyleSheet.create({
  toggleBtn: { alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  verifyRow: { alignItems: 'center', gap: 6, marginTop: 8 },
  verifyText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 12, flex: 1 },
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
  optLabel: { fontSize: 12, width: 16 },
  qFooter: { alignItems: 'center', gap: 6, marginTop: 8 },
  pts: { fontSize: 11 },
  akHeader: { alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  akTitle: { fontSize: 14 },
  akBody: { borderWidth: 1, padding: 14 },
  akRow: { gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  akNum: { fontSize: 13, width: 22 },
  workedCard: { borderWidth: 1, padding: 14, marginBottom: 16 },
});
