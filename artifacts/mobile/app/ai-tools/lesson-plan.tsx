import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
import { getUnitPriorKnowledge, resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId } from '@/services/ai/regeneration';
import { LessonPlanOutput } from '@/services/ai/AIService';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { getLessonById, getLessonsForUnit, getUnitForLesson } from '@/services/knowledgeBase';
import { stagesFromLessonPlan } from '@/services/ministryPlan';
import { todayISO } from '@/services/planEntries';
import { useAuth } from '@/context/AuthContext';
import { groundedSubjectConflict, scopeWithoutCurriculum, scopeFromParams, topicForScope, subjectPickerLabels } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { useFavorite } from '@/hooks/useFavorite';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { aiErrorText, isAbortError } from '@/services/ai/aiProvenance';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { captureGenerationScope, materialScope, reopenedGenerationScope, type GenerationScope } from '@/services/generationScope';
import { readIndexParam } from '@/services/materialParams';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { GeneratorResultActions, GeneratorSaveBar } from '@/components/ui/GeneratorResultActions';
import { ShortPaperNotice } from '@/components/ui/ShortPaperNotice';
import { buildLessonPlanHTML, buildLessonPlanSlidesHTML, exportMinistryPlanWord, formatLessonPlanText } from '@/services/share';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { usePickedLesson } from '@/hooks/usePickedLesson';
import { carriedLessonTopic } from '@/services/pickedLesson';
import { nextFrame } from '@/services/nextFrame';
import { buildLessonPlanRequest, groundLessonPlanTopic } from '@/services/generatorRequests';
import { useWideScope } from '@/hooks/useWideScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { lessonPlanExportTitle } from '@/services/exportTitles';
import { buildWideLessonPlanRequest, scopeFormState } from '@/services/wideScopeRequest';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { conceptOf, ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn, textOn, selectedRow } from '@/services/readableColor';
import { generationPhase } from '@/services/generationPhase';
import { lessonPlanSections, previewRows, summaryLine, type LessonPlanSection } from '@/services/generatorSummary';
import { SegmentedControl } from '@/components/generator/SegmentedControl';
import { LessonCard } from '@/components/generator/LessonCard';
import { DockedAction, DOCKED_BAR_HEIGHT } from '@/components/generator/DockedAction';
import { GeneratorLayout, useIsDesktopGenerator } from '@/components/generator/GeneratorLayout';
import { PaperPreview } from '@/components/generator/PaperPreview';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';

/**
 * The lesson plan's own colour, from the concept list the Tools tab and the prep
 * board read (`constants/icons.ts`). It carries white at 4.5:1, so it is the fill
 * for solid buttons and the tint behind a banner; as text, an icon or an outline
 * on a card the screen uses `accentInk` (`readableOn`), which stays readable on
 * the dark card.
 */
const ACCENT = conceptOf('lesson-plan').color;

/** The i18n title of each section the preview draws, as `LessonPlanView` titles it. */
const SECTION_LABEL_KEY = {
  objectives: 'sectionObjectives',
  materials: 'sectionMaterials',
  priorReview: 'sectionPriorReview',
  introduction: 'sectionIntroduction',
  mainActivity: 'sectionMainActivity',
  guidedPractice: 'sectionGuidedPractice',
  independentPractice: 'sectionIndependentPractice',
  closure: 'sectionClosure',
  assessment: 'sectionAssessment',
  differentiation: 'sectionDifferentiation',
  homework: 'sectionHomework',
} as const satisfies Record<LessonPlanSection, string>;

const DURATION_VALUES = [30, 45, 60, 90];
const STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;
/**
 * What a unit / semester / book plan is anchored to: the scope itself, never one
 * lesson its label happens to match. A full grounding because `captureGenerationScope`
 * freezes it; a null lesson means no lesson id, no figures, no Ministry unit.
 */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };

export default function LessonPlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    topic?: string; savedId?: string;
    gradeIdx?: string; subjectIdx?: string; durationIdx?: string; styleIdx?: string; objectives?: string;
    adaptations?: string;
    priorTopicsNotes?: string;
   includePriorReview?: string;
    scope?: string; distribution?: string;
    // The lesson itself (a lesson page, the lesson bar, a saved plan) — `usePickedLesson`.
    lessonId?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const accentInk = readableOn(ACCENT, colors.card);
  const isDesktop = useIsDesktopGenerator();
  const surface = useSurface();

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => uiLang === 'ar' ? g.nameAr : g.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);
  const styleLabels = [t('teachingStyleDirect'), t('teachingStyleInquiry'), t('teachingStyleCollaborative')];

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
  // The picked subject's material language — English is planned in English.
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
  // The teaching tools ignore `distribution`: a revision session has no question slots.
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /** The wide scope the plan on screen was generated under — what Save records, and what hides the Ministry form. */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(
    () => (wideScope.isWide ? wideScope.scopeSel! : null),
  );

  // Reset topic when grade or subject changes so stale KB selections are cleared
  const prevGradeRef = React.useRef(gradeIdx);
  const prevSubjectRef = React.useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      // A «subject mismatch» refusal is about the old pairing; it used to
      // stay on screen in red under the now-empty topic field.
      setError('');
      // …and a Cancel from the old pairing: «أُلغي» is about a run that no longer matters.
      setCancelled(false);
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);
  const [objectives, setObjectives] = useState(params.objectives ?? '');
  const [adaptations, setAdaptations] = useState(params.adaptations ?? '');
  const [priorTopicsNotes, setPriorTopicsNotes] = useState(params.priorTopicsNotes ?? '');
  // Persisted with the plan (it was not: a reopened plan silently dropped
  // «راجع المعرفة السابقة»), and the positions range-checked like the rest.
  const [includePriorReview, setIncludePriorReview] = useState(params.includePriorReview === '1');
  const [durationIdx, setDurationIdx] = useState(readIndexParam(params.durationIdx, DURATION_VALUES.length, 1));
  const [styleIdx, setStyleIdx] = useState(readIndexParam(params.styleIdx, STYLE_IDS.length, 0));
  const [loading, setLoading] = useState(false);
  // Counts presses of generate. The scrolls to the status and to the topic field depend on it as well as
  // on the phase: a refusal returns before `setError('')`, so pressing again with the same refusal leaves
  // everything else unchanged and, without this, would show the teacher nothing.
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
  const [result, setResult] = useState<LessonPlanOutput | null>(null);
  /**
   * The scope the plan on screen was generated under — pickers, topic and
   * the grounded lesson, frozen at generation time (or re-derived from the
   * saved form state on reopen, which is what gives a reopened plan its
   * grounding notice and the Ministry form its unit back). Save, export and
   * the Ministry form read this, never the live pickers: changing the
   * subject clears the topic but keeps the plan, and reading the form at
   * that point stored it under the new subject as «خطة درس: ».
   */
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => {
      if (!params.savedId) return null;
      // A restored wide plan is anchored to the scope, not to whichever lesson its
      // label («الفصل الأول كاملًا», a unit title) would ground to if looked up again.
      if (wideFrozen && topic.trim()) {
        return captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING);
      }
      return reopenedGenerationScope(initialScope, topic, lang, params.lessonId);
    },
  );
  const scope = materialScope(generated, { gradeIdx, subjectIdx, topic });
  // The plan on screen keeps the language it was generated in, even after the
  // pickers move on — like everything else read off `scope`.
  const outLang = contentLang(subjects[scope.subjectIdx].id, uiLang);
  const outT = getT(outLang);
  const curriculumGrounded: boolean | null = generated ? generated.grounded : null;
  // A wide plan has no single lesson: name its scope instead of leaving the notice's tail empty.
  const groundedLesson: string | null = wideFrozen
    ? scopeLabel(wideFrozen, outLang)
    : generated?.lesson
      ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
      : null;
  /** KB id of that lesson — the Ministry form needs its unit and period count. A wide plan has none. */
  const groundedLessonId: string | null = wideFrozen ? null : (generated?.lesson?.id ?? null);
  const [loadingMinistry, setLoadingMinistry] = useState(false);
  /**
   * Fields the teacher has changed. Kept so provenance stays honest — a plan
   * that has been edited is no longer purely machine-written, and the save
   * button needs to know there is something new to save.
   */
  const [editedFields, setEditedFields] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showMore, setShowMore] = useState(false);
  // The lesson card opens by itself while there is no lesson, and when the grade or
  // subject clears it; typing a title must not fold the field away mid-word, so only
  // the button (or an empty topic) changes it. Never unmounts the pickers below.
  const [lessonOpen, setLessonOpen] = useState(() => !topic.trim());
  useEffect(() => { if (!topic.trim()) setLessonOpen(true); }, [topic]);
  // The prior-topics field is hidden on a wide scope, so text left in it from before
  // the switch must not keep the section open around nothing the teacher can see.
  const moreOpen = showMore || !!(objectives.trim() || adaptations.trim() || (!wideScope.isWide && priorTopicsNotes.trim()));
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  // Prior-knowledge availability for the currently selected lesson (no fabrication)
  const priorKnowledge = (() => {
    // A wide scope has no single lesson, and its label must not be looked up as one:
    // the review option would light up for whichever lesson the label happens to match.
    if (!topic.trim() || wideScope.isWide) return [] as string[];
    const g = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en', { scope: kbScope, lessonId: pickedLesson.lessonId });
    if (!g.lesson) return [] as string[];
    return getUnitPriorKnowledge(g.lesson.id);
  })();
  const priorReviewAvailable = priorKnowledge.length > 0;

  // Not on a wide scope: there the box is hidden and the request drops the review
  // anyway, so a detour through a unit must not cost the teacher their tick.
  useEffect(() => {
    if (!wideScope.isWide && !priorReviewAvailable && includePriorReview) setIncludePriorReview(false);
  }, [wideScope.isWide, priorReviewAvailable, includePriorReview]);

  // If editing a saved item, load it and restore its result
  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try {
            const parsed = JSON.parse(item.content) as LessonPlanOutput;
            setResult(parsed);
          } catch { /* noop */ }
          setFavorited(item.isFavorite);
        }
      });
    }
  }, [params.savedId]);

  // Reset save label when result changes (new generation)
  useEffect(() => {
    if (result) setSaveLabel('save');
  }, [result]);

  const applyEdit = <K extends keyof LessonPlanOutput>(field: K, value: LessonPlanOutput[K]) => {
    setResult(prev => (prev ? { ...prev, [field]: value } : prev));
    setEditedFields(prev => new Set(prev).add(field as string));
    // Something changed since the last save, so offer to save it again.
    setSaveLabel('save');
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
    // Counted first, before any refusal below returns: the scroll effects depend on it.
    setAttempt(n => n + 1);
    // A Cancel leaves `cancelled` set, and it outranks an error in the status block: clear it before any
    // refusal below can return, or «أُلغي» would be shown over the refusal's own message.
    setCancelled(false);
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    const previous = result;
    // What a failed or cancelled run must hand back. It used to be cleared
    // up front and never restored, so Cancel on a regenerate threw away the
    // unsaved plan the teacher was looking at.
    const held = { result, editedFields, generated, wideFrozen };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // plan — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    const form = {
      gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
      subjectName: subjects[subjectIdx].name,
      topic,
      lang,
      durationMinutes: DURATION_VALUES[durationIdx],
      teachingStyle: STYLE_IDS[styleIdx],
      objectives, adaptations, priorTopicsNotes, includePriorReview,
      regenerate: opts?.regenerate === true,
      previous,
    };
    // A wide scope's topic is a label («الفصل الأول كاملًا»), not a lesson: the
    // subject-conflict check reads a lesson, so it applies to a single lesson only.
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wideSel = wideScope.isWide ? wideScope.scopeSel! : null;
    const wideReq = wideSel ? buildWideLessonPlanRequest(form, wideSel) : null;
    if (wideSel && !wideReq) { setError(t('wideScopeUngrounded')); return; }
    if (!wideReq) {
      const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setError('');
    setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setResult(null);
    setEditedFields(new Set());
    setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    try {
      // Wide: the topic is never grounded — it is the scope's label.
      const grounding = wideReq
        ? WIDE_GROUNDING
        : groundLessonPlanTopic(form, kbScope, pickedLesson.lessonId);
      const out = await aiService.generateLessonPlan(
        wideReq ?? buildLessonPlanRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setWideFrozen(wideReq ? wideSel : null);
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of.
      if (isAbortError(e)) setCancelled(true);
      // Deliberately not the raw error: "HTTP 500" is not a sentence in any
      // language a teacher reads. The technical text is already recorded in
      // aiProvenance, where the badge carries it for support.
      else setError(aiErrorText(e, t));
      // Hand back what was on screen; a stop or a failure is not a reason to
      // lose it.
      if (held.result) {
        setResult(held.result);
        setEditedFields(held.editedFields);
        setGenerated(held.generated);
        setWideFrozen(held.wideFrozen);
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
      durationIdx, styleIdx, objectives, adaptations,
      // A revision has no prior review: its field is hidden and was never sent, so
      // text typed before the switch to a wide scope is not saved with the plan.
      priorTopicsNotes: wideFrozen ? '' : priorTopicsNotes,
      includePriorReview: includePriorReview ? '1' : '0',
      // From the frozen scope, not the live picker (a teacher can move it after generating).
      // `distribution` is written by the shared helper and ignored by this tool.
      ...scopeFormState(wideFrozen, 'balanced'),
    };
    // Built once: the two branches below used to each spell out the payload
    // and its five-line comment.
    const payload = {
      title,
      subject: subjects[scope.subjectIdx].name,
      // Localised: this string is carried into generated content verbatim —
      // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
      // compared anywhere, only displayed and passed through, so translating it
      // is safe. `subject` is deliberately left in English: it feeds
      // isMathContext and ~30 other call sites.
      grade: outLang === 'ar' ? grades[scope.gradeIdx].nameAr : grades[scope.gradeIdx].name,
      topic: scope.topic,
      language: outLang,
      // `repeated` describes a regenerate, not the plan: reopened later it would be stale.
      content: JSON.stringify({ ...result, repeated: undefined }),
      formState,
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
      const saved = await saveItem({ type: 'lesson', ...payload });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  const getExportMeta = () => ({
    // Localised, like the picker above it. Taking `.name` straight off the
    // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
    // plan — the screen showed الرياضيات and the exported file disagreed.
    // Labels are per grade, so they are read against the generated grade.
    subject: subjectPickerLabels(grades[scope.gradeIdx].id, outLang)[scope.subjectIdx]!,
    grade: outLang === 'ar' ? grades[scope.gradeIdx].nameAr : grades[scope.gradeIdx].name,
    duration: DURATION_VALUES[durationIdx],
  });

  const getExportTitle = () => lessonPlanExportTitle(outLang, scope.topic, !!wideFrozen);

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
    // A wide plan has no figures of its own; see `noFigures`.
    noFigures: wideFrozen !== null,
    lang: outLang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    formatText: formatLessonPlanText,
    buildHTML: buildLessonPlanHTML,
    buildSlidesHTML: buildLessonPlanSlidesHTML,
    onError: key => showToast(t(key)),
    onCopied: key => showToast(t(key)),
  });

  /**
   * The plan on screen, on the Ministry's «خطة الدرس» form. The form is
   * Arabic-only, so names come from the Arabic fields whatever the UI
   * language. The roles come from the plan's own `ministryRoles`, asked for in
   * the same call so they match what the teacher read. Once the teacher has
   * edited a field those roles predate it, so the teacher column is then this
   * plan's phases folded into the four stages and only the learner column
   * stays the model's. A plan with no roles (offline, an older saved one) gets
   * the stock per-style lines in `ministryLearnerRoles` for the learner column.
   */
  const handleMinistry = async () => {
    // Hidden for a wide plan (the form needs one lesson's unit, periods and prior learning).
    if (!result || wideFrozen) return;
    setLoadingMinistry(true);
    try {
      const lesson = groundedLessonId ? getLessonById(groundedLessonId) : undefined;
      const siblings = lesson ? getLessonsForUnit(lesson.unitId) : [];
      const at = lesson ? siblings.findIndex(l => l.id === lesson.id) : -1;
      const page = {
        subject: subjects[scope.subjectIdx].nameAr,
        grade: grades[scope.gradeIdx].nameAr,
        unit: lesson ? (getUnitForLesson(lesson)?.titleAr ?? '') : '',
        lesson: lesson?.titleAr ?? scope.topic,
        periods: lesson?.periods ?? null,
        priorLearning: at > 0 ? siblings[at - 1].titleAr : '',
        outcomes: result.objectives,
        section: '',
        date: todayISO(),
        teacher: user?.name ?? '',
        stages: stagesFromLessonPlan(result, {
          teacherFromPhases: editedFields.size > 0,
          lang: outLang === 'ar' ? 'ar' : 'en',
          style: STYLE_IDS[styleIdx],
          topic: (outLang === 'ar' ? lesson?.titleAr : lesson?.titleEn) ?? scope.topic,
        }),
      };
      const title = getExportTitle();
      await exportMinistryPlanWord([page], title);
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setLoadingMinistry(false);
    }
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

  const exportLabels = {
    title: t('exportTitle'),
    shareLabel: t('exportShare'), shareSub: t('exportShareSub'),
    copyLabel: t('exportCopy'), copySub: t('exportCopySub'),
    pdfLabel: t('exportPDF'), pdfSub: t('exportPDFSub'),
    wordLabel: t('exportWord'), wordSub: t('exportWordSub'),
    slidesLabel: t('exportSlides'), slidesSub: t('exportSlidesSub'),
    ministryLabel: t('exportMinistry'), ministrySub: t('exportMinistrySub'),
    cancel: t('cancel'),
  };

  // What the button will make, said before it is pressed (docked bar on a phone, preview on desktop).
  // The prior-review section is in the plan only when the teacher asked for one, and never on a wide scope.
  const withPriorReview = !wideScope.isWide && ((includePriorReview && priorReviewAvailable) || priorTopicsNotes.trim().length > 0);
  const planSections = lessonPlanSections(withPriorReview);
  const summary = summaryLine({ minutes: DURATION_VALUES[durationIdx], sections: planSections.length, level: styleLabels[styleIdx] }, uiLang);
  const preview = previewRows(planSections, planSections.length, planSections.length);
  // The section titles are the plan's own headings, so they are in the language the plan will be written
  // in (the picked subject's, `lang`), not the interface's: an English plan is headed in English.
  const previewT = getT(lang);
  // A grade/subject pair with no book: the note that says so lives in the lesson card's body,
  // so the card stays open for as long as it applies (the same test `StrandedSelectionNote` makes).
  const stranded = subjectHidden?.[subjectIdx] === true;
  // What GenerationStatus shows. Under the form it is out of sight of a docked button, so a
  // phone scrolls it into view when this leaves 'idle' (a refusal such as scopeNoCurriculum or
  // subjectTopicMismatch, a network error, the spinner and its Cancel).
  const statusPhase = generationPhase({ loading, cancelled, failed: !!(error && topic.trim()) });
  const statusY = useRef(0);
  const reduceMotion = useReduceMotion();
  // Layout effect, not effect: the jump is made before the frame is painted, so there is no flash
  // of the form first. No animated scroll under reduced motion.
  // (No special case for a topic refusal: `generate` clears `cancelled` first, and a refusal with no topic
  // is not a generation failure, so the phase is 'idle' and this effect returns by itself.)
  const topicRefusal = !!error && !topic.trim();
  useLayoutEffect(() => {
    if (isDesktop || statusPhase === 'idle') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, statusY.current - SPACE.lg), animated: !reduceMotion });
  }, [statusPhase, attempt]);
  // This screen's button is NOT disabled on an empty topic: pressing it is what shows «اكتب عنوان الدرس»
  // beside the field. The button is docked away from that field on a phone, and beside the preview on
  // desktop, so on both the press brings the field into view. The target's place in the scroll content is
  // the difference of two window positions measured together (so the current scroll offset cancels out);
  // a second press scrolls again.
  const contentTopRef = useRef<View>(null);
  const topicErrorRef = useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  useLayoutEffect(() => {
    if (!topicRefusal) return;
    const top = contentTopRef.current;
    const target = topicErrorRef.current;
    if (!top || !target) return;
    top.measureInWindow((_x, topY) => {
      target.measureInWindow((_tx, targetY) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, targetY - topY - Math.round(windowHeight * 0.4)), animated: !reduceMotion });
      });
    });
  }, [topicRefusal, attempt]);
  // The result's own save bar takes the bottom of a phone while a fresh plan is unsaved.
  const saveBarVisible = !!result && !loading && !savedId && saveLabel === 'save';

  const action = (docked: boolean) => (
    <DockedAction
      summary={summary}
      label={loading ? t('generatingLessonPlan') : t('generateLessonPlanBtn')}
      onPress={() => generate()}
      loading={loading}
      accent={ACCENT}
      docked={docked}
      hidden={docked && saveBarVisible}
    />
  );

  const form = (
    <>
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

        {/* Topic / lesson selector */}
        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={text => { setTopic(text); setError(''); }}
          onSelectionDetail={pickedLesson.onSelectionDetail}
          lang={lang}
          isRTL={isRTL}
          colors={colors}
          accent={accentInk}
          hasError={!!error && !topic}
          allowedKinds={['lesson', 'unit', 'semester', 'book']}
          onScopeChange={wideScope.setScopeSel}
          offlineWideScope
          t={t}
        />

        {/*
          The validation error (an empty topic) still belongs here, next to the
          field it is about. Generation failures moved down to GenerationStatus,
          beside the spinner they replace — they used to render above the form,
          out of sight of the button that had just been pressed.
        */}
        {error && !topic.trim() ? (
          <View ref={topicErrorRef} collapsable={false}>
            <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text>
          </View>
        ) : null}
      </LessonCard>

      <SegmentedControl label={t('durationLabel')} options={durationLabels} index={durationIdx} onChange={setDurationIdx} accent={ACCENT} />
      <SegmentedControl label={t('teachingStyleLabel')} options={styleLabels} index={styleIdx} onChange={setStyleIdx} accent={ACCENT} />

      {/* The three optional boxes fold away: nine fields stood between a
          teacher and the button, and most plans need none of these. Any box
          that already holds text keeps the section open. */}
      <PressableScale
        onPress={() => setShowMore(v => !v)}
        accessibilityRole="button"
        aria-expanded={moreOpen}
        style={[styles.moreToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={ICON.md} color={accentInk} />
        <Text style={{ color: accentInk, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label }}>{t('moreOptionsOptional')}</Text>
      </PressableScale>
      {moreOpen ? (
        <View style={[surface, styles.moreCard]}>
          {/* Objectives (optional) */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('objectivesLabel')}
            </Text>
            <View style={[styles.inputBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: RADIUS.md }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
                placeholder={t('objectivesPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                value={objectives}
                onChangeText={setObjectives}
                multiline
              />
            </View>
          </View>

          {/* Adaptations / extra instructions (optional).
              Separate from objectives on purpose: "adapt this for a student with
              ADHD" is an instruction about how to write the plan, not something
              a student should be able to do by the end of it. Typed into the
              objectives box it came back as the lesson's stated objective. */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('adaptationsLabel')}
            </Text>
            <View style={[styles.inputBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: RADIUS.md }]}>
              <TextInput
                style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
                placeholder={t('adaptationsPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                value={adaptations}
                onChangeText={setAdaptations}
                multiline
              />
            </View>
            {/* «تبسيط الشرح» used to be its own card routing back to this screen
                with a `simplify=1` flag no prompt ever read. It is an adaptation —
                it belongs in the field whose text the prompt applies across every
                section of the plan. */}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <PressableScale
                onPress={() => {
                  const preset = t('adaptationSimplifyPreset');
                  if (adaptations.includes(preset)) return;
                  setAdaptations(a => (a.trim() ? `${a.trim()}\n${preset}` : preset));
                }}
                style={[styles.presetChip, { borderColor: accentInk, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name="bulb-outline" size={ICON.sm} color={accentInk} />
                <Text style={{ color: accentInk, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>
                  {t('adaptationSimplifyChip')}
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* Prior topics to re-explain (optional).
              Separate from adaptations: this is content to revisit at the start
              of the lesson — earlier material some students haven't grasped —
              not an instruction about how to deliver today's new material.
              Hidden on a wide scope: a revision session has no prior review. */}
          {wideScope.isWide ? null : (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('priorTopicsLabel')}
              </Text>
              <View style={[styles.inputBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: RADIUS.md }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
                  placeholder={t('priorTopicsPlaceholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={priorTopicsNotes}
                  onChangeText={setPriorTopicsNotes}
                  multiline
                />
              </View>
            </View>
          )}
        </View>
      ) : null}

      {/* After the fold on purpose: when the review is unavailable its note
          («priorReviewPlanUnavailableNote») points at the notes field "above". */}
      {wideScope.isWide ? null : (
        <View style={[surface, styles.priorCard]}>
          <CheckboxRow
            label={t('includePriorReviewPlanLabel')}
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
              fontSize: TYPE.caption, lineHeight: 21,
              textAlign: isRTL ? 'right' : 'left',
            }}>
              {t('priorReviewPlanUnavailableNote')}
            </Text>
          ) : null}
        </View>
      )}
    </>
  );

  const side = (
    <>
      <PaperPreview
        title={t('generateLessonPlanTitle')}
        subtitle={`${topic.trim() || t('selectLesson')} · ${gradeNames[gradeIdx]}`}
        rows={preview.rows.map(r => ({ n: r.n, tag: r.type ? previewT(SECTION_LABEL_KEY[r.type]) : null }))}
        more=""
        footer={[durationLabels[durationIdx]!, styleLabels[styleIdx]!]}
        note={t('genPreviewLessonPlanNote')}
        accent={ACCENT}
        nameLine={false}
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
      {/* Header. The wrapper only gives the topic scroll above its origin to measure from. */}
      <View ref={contentTopRef} collapsable={false}>
        <ToolHeader topPad={topPad} isRTL={isRTL} title={t('generateLessonPlanTitle')} concept="lesson-plan" eyebrow={{ icon: 'sparkles', label: t('aiLessonPlanBadge') }} />
      </View>

      {/* Form */}
      <View style={{ padding: isDesktop ? SPACE.xxl : SPACE.xl }}>
        <GeneratorLayout form={form} side={side} isDesktop={isDesktop} />
      </View>

      {/* Loading. The wrapper only records where this sits, for the scroll above. */}
      <View onLayout={e => { statusY.current = e.nativeEvent.layout.y; }}>
      <GenerationStatus
        phase={statusPhase}
        loadingLabel={t('craftingLessonPlan')}
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
        </View>
      )}

      {/* Result */}
      {result?.repeated && (
        <View style={{ marginHorizontal: 20 }}>
          <ShortPaperNotice repeated={result.repeated} repeatedUnit="sections" />
        </View>
      )}
      {result && (
        <LessonPlanResult
          plan={result}
          ink={accentInk}
          colors={colors}
          isRTL={outLang === 'ar'}
          t={outT}
          onEdit={applyEdit}
          editedFields={editedFields}
        />
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
          materialType="lesson"
          toolId="lesson-plan"
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
      // The Ministry form needs one lesson's unit, periods and prior learning (spec open item 1).
      onMinistry={wideFrozen ? undefined : handleMinistry}
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

function LessonPlanResult({ plan, ink, colors, isRTL, t, onEdit, editedFields }: {
  plan: LessonPlanOutput;
  /** The accent as text, an icon or an outline on a card (`readableOn`); `ACCENT` itself is for fills and tints. */
  ink: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
  /** Commits one field of the plan. The screen owns the plan; this just reports. */
  onEdit: <K extends keyof LessonPlanOutput>(field: K, value: LessonPlanOutput[K]) => void;
  editedFields: ReadonlySet<string>;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <View style={[styles.resultHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="checkmark-circle" size={20} color={ink} />
        <Text style={[styles.resultHeaderText, { color: ink, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {t('lessonPlanReady')}
        </Text>
      </View>

      <LessonPlanView
        plan={plan}
        colors={colors}
        isRTL={isRTL}
        t={t}
        accent={ink}
        onEdit={onEdit}
        editedFields={editedFields}
      />
    </View>
  );
}


/**
 * The one boolean on the form (a prior-knowledge review): a labelled checkbox,
 * 44 points tall, announced as a checkbox (`aria-checked`). The fill is the
 * tool's colour and the tick is `textOn` it. A disabled row dims itself.
 */
function CheckboxRow({ label, checked, onToggle, accent, colors, isRTL, disabled }: {
  label: string; checked: boolean; onToggle: () => void;
  accent: string; colors: ReturnType<typeof useColors>; isRTL: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      aria-checked={checked}
      aria-disabled={!!disabled}
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
      style={[styles.checkRow, { flexDirection: isRTL ? 'row-reverse' : 'row', opacity: disabled ? 0.6 : 1 }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? accent : colors.border, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={ICON.sm} color={textOn(accent)} />}
      </View>
      <Text style={[{ color: disabled ? colors.mutedForeground : colors.foreground, fontFamily: checked ? 'ReadexPro_500Medium' : 'Almarai_400Regular', fontSize: TYPE.label, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
    </PressableScale>
  );
}

/**
 * The shared dropdown, for the two long lists (grade, subject), with the selected
 * row tinted with the `accent` it is given (the tool's ink) so it is not the fixed
 * teal of the default.
 */
function PickerField(props: React.ComponentProps<typeof SharedPickerField>) {
  const row = selectedRow(props.accent, props.colors.card);
  return <SharedPickerField selectedTint={row.fill} {...props} accent={row.ink} />;
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: TYPE.caption, marginBottom: SPACE.xs },
  field: { gap: SPACE.sm },
  moreToggle: { alignItems: 'center', gap: SPACE.sm, minHeight: 44 },
  moreCard: { padding: SPACE.md, gap: SPACE.lg },
  inputBox: { borderWidth: 1, padding: SPACE.md },
  presetChip: { alignItems: 'center', gap: SPACE.xs, minHeight: 44, paddingHorizontal: SPACE.md, borderWidth: 1.5 },
  textInput: { fontSize: TYPE.body, padding: 0, minHeight: 44 },
  priorCard: { padding: SPACE.md, gap: SPACE.xs },
  checkRow: { alignItems: 'center', gap: SPACE.md, minHeight: 44 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 20 },
  resultHeaderText: { fontSize: 14 },
});
