import { plainActivity } from '@/services/ai/activityText';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { resolveGeneratorGrounding, type GeneratorGrounding } from '@/services/kbContext';
import { isolateForeignRuns } from '@/services/mathRender';
import { pooledVariantId } from '@/services/ai/regeneration';
import { ActivityOutput, ActivityStep } from '@/services/ai/AIService';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, scopeFromParams, topicForScope, subjectPickerLabels } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField as SharedPickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import {
  ACTIVITY_TYPE_IDS,
  activityTypeLabel,
  type ActivityTypeId } from '@/constants/activityType';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { aiErrorText, isAbortError } from '@/services/ai/aiProvenance';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { useFavorite } from '@/hooks/useFavorite';
import { useAbortOnUnmount } from '@/hooks/useAbortOnUnmount';
import { captureGenerationScope, materialScope, reopenedGenerationScope, savedIdAfterGeneration, type GenerationScope } from '@/services/generationScope';
import { readIndexParam } from '@/services/materialParams';
import { buildActivityRequest, type ActivityForm } from '@/services/generatorRequests';
import { GeneratorResultActions, GeneratorSaveBar } from '@/components/ui/GeneratorResultActions';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { buildActivityHTML, buildActivitySlidesHTML, formatActivityText } from '@/services/share';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { usePickedLesson } from '@/hooks/usePickedLesson';
import { carriedLessonTopic } from '@/services/pickedLesson';
import { nextFrame } from '@/services/nextFrame';
import { useWideScope } from '@/hooks/useWideScope';
import { scopeLabel, type ScopeSelection } from '@/services/scopeSelection';
import { activityExportTitle } from '@/services/exportTitles';
import { buildScopeRequest, scopeFormState } from '@/services/wideScopeRequest';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { conceptOf } from '@/constants/icons';
import { SPACE, TYPE } from '@/constants/theme';
import { readableOn, textOn, tintOver, selectedRow } from '@/services/readableColor';
import { generationPhase } from '@/services/generationPhase';
import { activitySections, previewRows, summaryLine, type ActivitySection } from '@/services/generatorSummary';
import { SegmentedControl } from '@/components/generator/SegmentedControl';
import { ChipGroup } from '@/components/generator/ChipGroup';
import { LessonCard } from '@/components/generator/LessonCard';
import { DockedAction, DOCKED_BAR_HEIGHT } from '@/components/generator/DockedAction';
import { toastLift } from '@/services/dockedBar';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { GeneratorLayout, useIsDesktopGenerator } from '@/components/generator/GeneratorLayout';
import { PaperPreview } from '@/components/generator/PaperPreview';
import { useSurface } from '@/components/ui/Surface';

/** The i18n title of each section the preview draws, as `ActivityResult` titles it. */
const SECTION_LABEL_KEY = {
  objective: 'genSectionObjective',
  materials: 'sectionMaterials',
  steps: 'sectionActivitySteps',
  teacherTips: 'sectionTeacherTips',
  differentiation: 'sectionDifferentiation',
  assessment: 'sectionAssessment',
} as const satisfies Record<ActivitySection, string>;

/**
 * The activity's own colour, from the concept list the Tools tab and the prep board
 * read (`constants/icons.ts`). It carries white at 4.5:1, so it is the fill for solid
 * buttons and the step numbers (their label is `textOn(ACCENT)`) and the tint behind
 * a banner; as text, an icon or an outline on a card the screen uses `accentInk`
 * (`readableOn`), which stays readable on the dark card.
 */
const ACCENT = conceptOf('activity').color;
const DURATION_VALUES = [20, 30, 45, 60];
/** What a unit / semester / book activity is anchored to: the scope itself, never one lesson its label happens to match. */
const WIDE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
type AType = ActivityTypeId;

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang: uiLang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; topic?: string;
    gradeIdx?: string; subjectIdx?: string; activityTypeIdx?: string; durationIdx?: string; objective?: string;
    scope?: string; distribution?: string;
    // The lesson itself (a lesson page, the lesson bar, a saved activity) — `usePickedLesson`.
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
  const activityTypeLabels = ACTIVITY_TYPE_IDS.map(id => activityTypeLabel(id, t));

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
  // The picked subject's material language — English is taught in English.
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
  // The structured scope the topic picker reports, seeded from a reopened
  // material's saved form. The pickers are passed so a scope saved for another
  // grade or subject reads as not wide (piece 2: stale restored scope).
  const wideScope = useWideScope(params, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
  /** The wide scope the activity on screen was generated under — what Save records and the notice names. */
  const [wideFrozen, setWideFrozen] = useState<ScopeSelection | null>(() => (wideScope.isWide ? wideScope.scopeSel : null));
  const [activityTypeIdx, setActivityTypeIdx] = useState(readIndexParam(params.activityTypeIdx, ACTIVITY_TYPE_IDS.length, 1));
  const [durationIdx, setDurationIdx] = useState(readIndexParam(params.durationIdx, DURATION_VALUES.length, 1));
  const [objective, setObjective] = useState(params.objective ?? '');
  const [loading, setLoading] = useState(false);
  // Counts presses of generate. The scroll to the status block depends on it as well as on the phase: a
  // refusal returns before `setError('')`, so pressing again with the same refusal leaves the phase at
  // 'error' and, without this, would show the teacher nothing.
  const [attempt, setAttempt] = useState(0);
  // The lesson card opens by itself while there is no lesson, and when the grade or
  // subject clears it; typing a title must not fold the field away mid-word, so only
  // the button (or an empty topic) changes it. Never unmounts the pickers below.
  const [lessonOpen, setLessonOpen] = useState(() => !topic.trim());
  useEffect(() => { if (!topic.trim()) setLessonOpen(true); }, [topic]);
  /**
   * Held across renders so Cancel can reach the in-flight request. A cancel
   * that only cleared the spinner would leave the call running and still
   * billing against AI_BUDGET_USD — the teacher would have stopped the
   * waiting, not the spending. This screen had no Cancel at all.
   */
  const abortRef = useRef<AbortController | null>(null);
  useAbortOnUnmount(abortRef);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<ActivityOutput | null>(null);
  /**
   * The scope the activity on screen was generated under — pickers, topic
   * and the grounded lesson, frozen at generation time (or re-derived from
   * the saved form state on reopen). Save and export read this, never the
   * live pickers: changing the subject clears the topic but keeps the
   * activity, and reading the form at that point stored it under the new
   * subject as «نشاط: ».
   */
  const [generated, setGenerated] = useState<GenerationScope | null>(
    () => {
      if (!params.savedId) return null;
      // A restored wide activity is anchored to the scope, not to whichever
      // lesson its label («الفصل الأول كاملًا», a unit title) would ground to if
      // looked up again.
      if (wideFrozen && topic.trim()) {
        return captureGenerationScope({ gradeIdx: initialScope.gradeIdx, subjectIdx: initialScope.subjectIdx, topic }, WIDE_GROUNDING);
      }
      return reopenedGenerationScope(initialScope, topic, lang, params.lessonId);
    },
  );
  const scope = materialScope(generated, { gradeIdx, subjectIdx, topic });
  // The activity on screen keeps the language it was generated in, even after
  // the pickers move on — like everything else read off `scope`.
  const outLang = contentLang(subjects[scope.subjectIdx].id, uiLang);
  const curriculumGrounded: boolean | null = generated ? generated.grounded : null;
  // A wide activity has no single lesson: name its scope instead of leaving the notice's tail empty.
  const groundedLesson: string | null = wideFrozen
    ? scopeLabel(wideFrozen, outLang)
    : generated?.lesson
      ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
      : null;
  /**
   * The type, length and objective the activity on screen was built with —
   * frozen like `generated`, because the pickers stay editable afterwards.
   * Save used to read them live: switch the type picker to «فردي» after
   * generating a game, press Save, and the game was stored with a form that
   * reopens as an individual activity — Regenerate then built a different
   * kind of activity than the one saved. A reopened activity starts from the
   * form it was saved with.
   */
  const [builtWith, setBuiltWith] = useState<{ activityTypeIdx: number; durationIdx: number; objective: string } | null>(
    () => (params.savedId ? {
      activityTypeIdx: readIndexParam(params.activityTypeIdx, ACTIVITY_TYPE_IDS.length, 1),
      durationIdx: readIndexParam(params.durationIdx, DURATION_VALUES.length, 1),
      objective: params.objective ?? '',
    } : null),
  );
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  // Reset topic when grade or subject changes
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

  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try { setResult(plainActivity(JSON.parse(item.content) as ActivityOutput)); } catch { /* noop */ }
          setFavorited(item.isFavorite);
        }
      });
    }
  }, [params.savedId]);

  useEffect(() => {
    if (result) setSaveLabel('save');
  }, [result]);

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
    // Counted first, before any refusal below returns: the status scroll depends on it.
    setAttempt(n => n + 1);
    // A Cancel leaves `cancelled` set, and it outranks an error in the status block: clear it before any
    // refusal below can return, or «أُلغي» would be shown over the refusal's own message.
    setCancelled(false);
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    const previous = result;
    // What a failed or cancelled run must hand back. It used to be cleared
    // up front and never restored, so a failed regenerate threw away the
    // unsaved activity the teacher was looking at. The frozen scope goes back
    // with it, so Save and the notice describe the restored activity.
    const held = { result, generated, builtWith, wideFrozen };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    // The body comes from generatorRequests, like the worksheet's and the
    // plan's, so the pregenerate script and this screen hash the same
    // artifact. It also carries the localised grade name — this screen
    // sent "Grade 10" into an Arabic activity.
    const form: ActivityForm = {
      gradeName: lang === 'ar' ? grades[gradeIdx].nameAr : grades[gradeIdx].name,
      subjectName: subjects[subjectIdx].name,
      topic,
      lang,
      activityType: ACTIVITY_TYPE_IDS[activityTypeIdx],
      durationMinutes: DURATION_VALUES[durationIdx],
      objective,
      regenerate: opts?.regenerate === true,
      previous,
    };
    // A unit, a semester or the whole book is a revision session. Its topic is
    // a label («الفصل الأول كاملًا»), not a lesson, so it is never grounded: the
    // request is built against the inert WIDE_GROUNDING, and the scope's fields
    // (digest, lesson table, explicit-undefined lesson ids) merge over it last.
    // `own` carries what this screen decided: a typed objective keeps the
    // request the teacher's (`contextSource: 'teacher'`, never pooled).
    // A wide scope that cannot be grounded is refused here, never generated mislabeled.
    const wideOwn = wideScope.isWide ? buildActivityRequest(form, WIDE_GROUNDING) : null;
    const wide = wideOwn
      ? buildScopeRequest(wideScope.scopeSel!, lang as 'ar' | 'en', {
          additionalContext: wideOwn.additionalContext,
          contextSource: wideOwn.contextSource,
        })
      : null;
    if (wideScope.isWide && !wide) { setError(t('wideScopeUngrounded')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // activity — the KB serves that lesson's own content while the header
    // claims the picked subject. Refuse and name the real subject instead.
    // The check reads a lesson, so it applies to a single lesson only.
    if (!wide) {
      const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
      if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    }
    setError(''); setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setResult(null); setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await nextFrame();
    try {
      const grounding = wide
        ? WIDE_GROUNDING
        : resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en', { scope: kbScope, lessonId: pickedLesson.lessonId });
      const out = await aiService.generateActivity(
        // Last: the scope's fields replace the single-lesson ones.
        wide && wideOwn ? { ...wideOwn, ...wide.fields } : buildActivityRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setWideFrozen(wide ? wideScope.scopeSel : null);
      setBuiltWith({ activityTypeIdx, durationIdx, objective });
      setResult(out);
      // A regenerated activity is a new copy: leave the saved one alone, and
      // let «حفظ» create it. The star belonged to the saved material.
      if (opts?.regenerate === true && savedId) setFavorited(false);
      setSavedId(prev => savedIdAfterGeneration(prev, opts));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of.
      if (isAbortError(e)) setCancelled(true);
      else setError(aiErrorText(e, t));
      if (held.result) {
        setResult(held.result);
        setGenerated(held.generated);
        setBuiltWith(held.builtWith);
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

  // A unit, semester or book activity is a revision, and says so — like the
  // plan's («خطة حصة مراجعة: …»). From the frozen scope, not the live picker.
  const getExportTitle = () => activityExportTitle(outLang, scope.topic, wideFrozen !== null);

  const getExportMeta = () => ({
    // Localised, like the picker above it. Taking `.name` straight off the
    // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
    // plan — the screen showed الرياضيات and the exported file disagreed.
    // Labels are per grade, so they are read against the generated grade.
    subject: subjectPickerLabels(grades[scope.gradeIdx].id, outLang)[scope.subjectIdx]!,
    grade: outLang === 'ar' ? grades[scope.gradeIdx].nameAr : grades[scope.gradeIdx].name,
  });

  const handleSave = async () => {
    if (!result) return;
    const title = getExportTitle();
    const formState = {
      gradeIdx: scope.gradeIdx, subjectIdx: scope.subjectIdx, topic: scope.topic,
      ...(builtWith ?? { activityTypeIdx, durationIdx, objective }),
      // From the frozen scope, not the live picker (a teacher can move it after
      // generating). A lesson activity adds nothing — its form is unchanged —
      // and `withLessonId` declines to stamp a lesson id on a wide one.
      ...scopeFormState(wideFrozen, 'balanced'),
    };
    // Built once: the two branches below used to each spell out the payload.
    // The grade is the localised name, as the lesson plan stores it.
    const payload = {
      title,
      subject: subjects[scope.subjectIdx].name,
      grade: outLang === 'ar' ? grades[scope.gradeIdx].nameAr : grades[scope.gradeIdx].name,
      topic: scope.topic,
      language: outLang,
      content: JSON.stringify(result),
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
      // Its own type, not 'lesson'. That substitution existed only because
      // the workspace viewer had no activity branch and fell through to the
      // quiz renderer; it has one now (see app/workspace/view.tsx), so the
      // material can say what it is. Activities already saved as 'lesson'
      // are rescued there by shape — nothing needs migrating.
      const saved = await saveItem({ type: 'activity', ...payload });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


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
    // A wide activity has no figures of its own; without this an absent lesson
    // id falls back to grounding the label (see `noFigures`).
    noFigures: wideFrozen !== null,
    lang: outLang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    formatText: formatActivityText,
    buildHTML: buildActivityHTML,
    buildSlidesHTML: buildActivitySlidesHTML,
    onError: key => showToast(t(key)),
    onCopied: key => showToast(t(key)),
  });

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
    cancel: t('cancel'),
  };

  // What the button will make, said before it is pressed (docked bar on a phone, preview on desktop).
  const typeLabel = activityTypeLabels[activityTypeIdx]!;
  const summary = summaryLine({ minutes: DURATION_VALUES[durationIdx], level: typeLabel }, uiLang);
  const sections = activitySections();
  const preview = previewRows(sections, sections.length, sections.length);
  // The section titles are the activity's own headings, so they are in the language it will be written
  // in (the picked subject's, `lang`), not the interface's: an English activity is headed in English.
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
  useLayoutEffect(() => {
    if (isDesktop || statusPhase === 'idle') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, statusY.current - SPACE.lg), animated: !reduceMotion });
  }, [statusPhase, attempt]);
  // The result's own save bar takes the bottom of a phone while a fresh activity is unsaved.
  const saveBarVisible = !!result && !loading && !savedId && saveLabel === 'save';
  // The toast sits above the docked bar while the bar is really on screen (a phone, not yielded to the screen's own bar, keyboard closed).
  const keyboardOpen = useKeyboardVisible();
  const toastBottom = toastLift({ isDesktop, barHidden: saveBarVisible, keyboardOpen });

  const action = (docked: boolean) => (
    <DockedAction
      summary={summary}
      label={loading ? t('generatingActivity') : t('generateActivityBtn')}
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
          it is about. Generation failures render below in GenerationStatus,
          beside the spinner they replace, with Cancel and Retry — the same
          arrangement as the other generators; this screen still showed them
          above the button with neither.
        */}
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
      </LessonCard>

      {/* Five labels are too many for a segmented control: a single choice among chips, over the same ids in the same order. */}
      <ChipGroup
        single
        label={t('activityTypeLabel')}
        options={ACTIVITY_TYPE_IDS.map((id, i) => ({ id, label: activityTypeLabels[i]! }))}
        selected={new Set<AType>([ACTIVITY_TYPE_IDS[activityTypeIdx]!])}
        onToggle={id => setActivityTypeIdx(ACTIVITY_TYPE_IDS.indexOf(id))}
        accent={ACCENT}
      />
      <SegmentedControl label={t('durationLabel')} options={durationLabels} index={durationIdx} onChange={setDurationIdx} accent={ACCENT} />

      <View style={[surface, styles.objectiveCard]}>
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('activityObjectiveLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
            placeholder={t('activityObjectivePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={objective}
            onChangeText={setObjective}
            multiline
          />
        </View>
      </View>
    </>
  );

  const side = (
    <>
      <PaperPreview
        title={t('createActivityTitle')}
        subtitle={`${topic.trim() || t('selectLesson')} · ${gradeNames[gradeIdx]}`}
        rows={preview.rows.map(r => ({ n: r.n, tag: r.type ? previewT(SECTION_LABEL_KEY[r.type]) : null }))}
        more=""
        footer={[durationLabels[durationIdx]!, typeLabel]}
        note={t('genPreviewActivityNote')}
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
      {/* Header */}
      <ToolHeader topPad={topPad} isRTL={isRTL} title={t('createActivityTitle')} concept="activity" eyebrow={{ icon: 'flash', label: t('activityBadge') }} />

      {/* Form */}
      <View style={{ padding: isDesktop ? SPACE.xxl : SPACE.xl }}>
        <GeneratorLayout form={form} side={side} isDesktop={isDesktop} />
      </View>

      {/* Loading. The wrapper only records where this sits, for the scroll above. */}
      <View onLayout={e => { statusY.current = e.nativeEvent.layout.y; }}>
      <GenerationStatus
        phase={statusPhase}
        loadingLabel={t('craftingActivity')}
        errorDetail={error}
        onCancel={cancelGenerate}
        onRetry={() => generate()}
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
        </View>
      )}

      {result && <ActivityResult activity={result} colors={colors} isRTL={outLang === 'ar'} t={getT(outLang)} />}

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
          materialType="activity"
          toolId="activity"
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
      isRTL={isRTL}
      loadingPDF={loadingPDF}
      loadingWord={loadingWord}
      loadingSlides={loadingSlides}
      labels={exportLabels}
    />
    <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} bottomOffset={toastBottom} />
    </View>
  );
}

function ActivityResult({ activity, colors, isRTL, t }: {
  activity: ActivityOutput;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
}) {
  // Text, icons and outlines on a card are the ink; the tints behind them are the concept colour itself.
  const ink = readableOn(ACCENT, colors.card);
  // The ready banner is not on a card: it is the accent at 8% over the page, so its text is judged against that.
  const bannerInk = readableOn(ink, tintOver(ACCENT, 0x15 / 255, colors.background));
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      {/* Success banner */}
      <View style={[styles.resultHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="checkmark-circle" size={20} color={bannerInk} />
        <Text style={[styles.resultHeaderText, { color: bannerInk, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {t('activityReady')}
        </Text>
      </View>

      {/* Meta row */}
      <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
        <MetaPill icon="people-outline" label={activity.groupSize} color={ink} />
        <MetaPill icon="time-outline" label={`${activity.totalDuration} ${t('min')}`} color={ink} />
        <MetaPill icon="flash-outline" label={activityTypeLabel(activity.activityType, t)} color={ink} />
      </View>

      {/* Objective */}
      <View style={[styles.objectiveBox, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30', borderRadius: colors.radius }]}>
        <Text style={[{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 11, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('genSectionObjective')}
        </Text>
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 23, textAlign: isRTL ? 'right' : 'left' }]}>
          {activity.objective}
        </Text>
      </View>

      {/* Materials */}
      <ResultSection title={t('sectionMaterials')} icon="bag-outline" isRTL={isRTL}>
        {activity.materials.map((m, i) => <BulletItem key={i} text={m} colors={colors} isRTL={isRTL} />)}
      </ResultSection>

      {/* Steps */}
      <View style={{ marginBottom: 16 }}>
        <View style={[styles.resultSectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="list-outline" size={16} color={ink} />
          <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('sectionActivitySteps')}
          </Text>
        </View>
        {activity.steps.map(step => (
          <StepCard key={step.stepNumber} step={step} colors={colors} isRTL={isRTL} t={t} />
        ))}
      </View>

      {/* Teacher Tips */}
      <ResultSection title={t('sectionTeacherTips')} icon="bulb-outline" isRTL={isRTL}>
        {activity.teacherTips.map((tip, i) => <BulletItem key={i} text={tip} colors={colors} isRTL={isRTL} />)}
      </ResultSection>

      {/* Differentiation */}
      <ResultSection title={t('sectionDifferentiation')} icon="layers-outline" isRTL={isRTL}>
        <BodyText text={activity.differentiation} colors={colors} isRTL={isRTL} />
      </ResultSection>

      {/* Assessment */}
      <ResultSection title={t('sectionAssessment')} icon="checkmark-done-outline" isRTL={isRTL}>
        <BodyText text={activity.assessment} colors={colors} isRTL={isRTL} />
      </ResultSection>
    </View>
  );
}

function MetaPill({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontSize: 12, color, fontFamily: 'ReadexPro_500Medium' }}>{label}</Text>
    </View>
  );
}

function StepCard({ step, colors, isRTL, t }: {
  step: ActivityStep; colors: ReturnType<typeof useColors>; isRTL: boolean; t: (k: any) => string;
}) {
  return (
    <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.stepNum, { backgroundColor: ACCENT }]}>
          <Text style={{ color: textOn(ACCENT), fontSize: 12, fontFamily: 'ReadexPro_700Bold' }}>{step.stepNumber}</Text>
        </View>
        <Text
          style={[
            styles.stepTitle,
            {
              color: colors.foreground,
              fontFamily: 'ReadexPro_600SemiBold',
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        >
          {isolateForeignRuns(step.title)}
        </Text>
        <Text style={[styles.stepDur, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {step.durationMin} {t('activityMin')}
        </Text>
      </View>
      <Text
        style={[
          styles.stepDesc,
          {
            color: colors.foreground,
            fontFamily: 'Almarai_400Regular',
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        {isolateForeignRuns(step.description)}
      </Text>
    </View>
  );
}

function ResultSection({ title, icon, isRTL, children }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; isRTL: boolean; children: React.ReactNode;
}) {
  const colors = useColors();
  const ink = readableOn(ACCENT, colors.card);
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.resultSectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={16} color={ink} />
        <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      </View>
      <View style={[styles.resultSectionBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        {children}
      </View>
    </View>
  );
}

function BulletItem({ text, colors, isRTL }: { text: string; colors: ReturnType<typeof useColors>; isRTL: boolean }) {
  return (
    <View style={[styles.bulletRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.bulletDot, { backgroundColor: readableOn(ACCENT, colors.card) }]} />
      <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{isolateForeignRuns(text)}</Text>
    </View>
  );
}

function BodyText({ text, colors, isRTL }: { text: string; colors: ReturnType<typeof useColors>; isRTL: boolean }) {
  return <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{isolateForeignRuns(text)}</Text>;
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
  objectiveCard: { padding: SPACE.md, gap: SPACE.sm },
  fieldLabel: { fontSize: TYPE.caption },
  inputBox: { borderWidth: 1, padding: SPACE.md },
  textInput: { fontSize: TYPE.body, padding: 0, minHeight: 44 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 16 },
  resultHeaderText: { fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginBottom: 16, borderRadius: 10, overflow: 'hidden' },
  objectiveBox: { padding: 14, borderWidth: 1, marginBottom: 16 },
  resultSectionHeader: { alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14 },
  resultSectionBody: { padding: 14, borderWidth: 1 },
  bulletRow: { gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 23 },
  bodyText: { fontSize: 15, lineHeight: 23 },
  stepCard: { borderWidth: 1, padding: 14, marginBottom: 10 },
  stepHeader: { alignItems: 'center', gap: 10, marginBottom: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle: { fontSize: 13 },
  stepDur: { fontSize: 11, lineHeight: 18 },
  stepDesc: { fontSize: 15, lineHeight: 23 },
});
