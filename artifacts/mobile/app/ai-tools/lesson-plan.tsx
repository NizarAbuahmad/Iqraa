import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { getUnitPriorKnowledge, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId } from '@/services/ai/regeneration';
import { LessonPlanOutput } from '@/services/ai/AIService';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import { getLessonById, getLessonsForUnit, getUnitForLesson } from '@/services/knowledgeBase';
import { stagesFromLessonPlan } from '@/services/ministryPlan';
import { todayISO } from '@/services/planEntries';
import { useAuth } from '@/context/AuthContext';
import { groundedSubjectConflict, scopeWithoutCurriculum, scopeFromParams, subjectPickerLabels } from '@/services/lessonPrep';
import { useTeacherScope } from '@/hooks/useTeacherScope';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField } from '@/components/ui/PickerField';
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
import { readIndexParam } from '@/services/materialParams';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { GeneratorResultActions, GeneratorSaveBar } from '@/components/ui/GeneratorResultActions';
import { buildLessonPlanHTML, buildLessonPlanSlidesHTML, exportMinistryPlanWord, formatLessonPlanText } from '@/services/share';
import { ToolHeader } from '@/components/ui/ToolHeader';
import { palette } from '@/constants/colors';
import { useWarmGrounding } from '@/hooks/useWarmGrounding';
import { nextFrame } from '@/services/nextFrame';
import { buildLessonPlanRequest, groundLessonPlanTopic } from '@/services/generatorRequests';

const ACCENT = palette.primary;

const DURATION_VALUES = [30, 45, 60, 90];
const STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;

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
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => uiLang === 'ar' ? g.nameAr : g.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);
  const styleLabels = [t('teachingStyleDirect'), t('teachingStyleInquiry'), t('teachingStyleCollaborative')];

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
  // The picked subject's material language — English is planned in English.
  const lang = contentLang(subjects[subjectIdx].id, uiLang);
  const [topic, setTopic] = useState(() => topicInLang(
    params.topic ?? '', uiLang, contentLang(subjects[initialScope.subjectIdx].id, uiLang),
    { gradeId: grades[initialScope.gradeIdx].id, subjectId: subjects[initialScope.subjectIdx].id },
  ));
  useWarmGrounding(topic, lang);

  // Reset topic when grade or subject changes so stale KB selections are cleared
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
  const [objectives, setObjectives] = useState(params.objectives ?? '');
  const [adaptations, setAdaptations] = useState(params.adaptations ?? '');
  const [priorTopicsNotes, setPriorTopicsNotes] = useState(params.priorTopicsNotes ?? '');
  // Persisted with the plan (it was not: a reopened plan silently dropped
  // «راجع المعرفة السابقة»), and the positions range-checked like the rest.
  const [includePriorReview, setIncludePriorReview] = useState(params.includePriorReview === '1');
  const [durationIdx, setDurationIdx] = useState(readIndexParam(params.durationIdx, DURATION_VALUES.length, 1));
  const [styleIdx, setStyleIdx] = useState(readIndexParam(params.styleIdx, STYLE_IDS.length, 0));
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
    () => (params.savedId ? reopenedGenerationScope(initialScope, topic, lang) : null),
  );
  const scope = materialScope(generated, { gradeIdx, subjectIdx, topic });
  // The plan on screen keeps the language it was generated in, even after the
  // pickers move on — like everything else read off `scope`.
  const outLang = contentLang(subjects[scope.subjectIdx].id, uiLang);
  const outT = getT(outLang);
  const curriculumGrounded: boolean | null = generated ? generated.grounded : null;
  const groundedLesson: string | null = generated?.lesson
    ? (outLang === 'ar' ? generated.lesson.titleAr : generated.lesson.titleEn)
    : null;
  /** KB id of that lesson — the Ministry form needs its unit and period count. */
  const groundedLessonId: string | null = generated?.lesson?.id ?? null;
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
  const moreOpen = showMore || !!(objectives.trim() || adaptations.trim() || priorTopicsNotes.trim());
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };
  const { favorited, setFavorited, toggle: handleToggleFavorite } =
    useFavorite(savedId, key => showToast(t(key)));

  // Prior-knowledge availability for the currently selected lesson (no fabrication)
  const priorKnowledge = (() => {
    if (!topic.trim()) return [] as string[];
    const g = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en', { scope: { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id } });
    if (!g.lesson) return [] as string[];
    return getUnitPriorKnowledge(g.lesson.id);
  })();
  const priorReviewAvailable = priorKnowledge.length > 0;

  useEffect(() => {
    if (!priorReviewAvailable && includePriorReview) setIncludePriorReview(false);
  }, [priorReviewAvailable, includePriorReview]);

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
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    const previous = result;
    // What a failed or cancelled run must hand back. It used to be cleared
    // up front and never restored, so Cancel on a regenerate threw away the
    // unsaved plan the teacher was looking at.
    const held = { result, editedFields, generated };
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // plan — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const missing = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, uiLang);
    if (missing) { setError(t('scopeNoCurriculum', missing.grade, missing.subject)); return; }
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id, grades[gradeIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', uiLang === 'ar' ? conflict.nameAr : conflict.name)); return; }
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
      const grounding = groundLessonPlanTopic(form, { gradeId: grades[gradeIdx].id, subjectId: subjects[subjectIdx].id });
      const out = await aiService.generateLessonPlan(
        buildLessonPlanRequest(form, grounding),
        { signal: controller.signal },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGenerated(captureGenerationScope({ gradeIdx, subjectIdx, topic }, grounding));
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of.
      if (isAbortError(e)) setCancelled(true);
      // Deliberately not the raw error: "HTTP 500" is not a sentence in any
      // language a teacher reads. The technical text is already recorded in
      // aiProvenance, where the badge carries it for support.
      else setError(t(aiErrorMessageKey(e)));
      // Hand back what was on screen; a stop or a failure is not a reason to
      // lose it.
      if (held.result) {
        setResult(held.result);
        setEditedFields(held.editedFields);
        setGenerated(held.generated);
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
      durationIdx, styleIdx, objectives, adaptations, priorTopicsNotes,
      includePriorReview: includePriorReview ? '1' : '0',
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

  const getExportTitle = () => outLang === 'ar' ? `خطة درس: ${scope.topic}` : `Lesson Plan: ${scope.topic}`;

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
    formatText: formatLessonPlanText,
    buildHTML: buildLessonPlanHTML,
    buildSlidesHTML: buildLessonPlanSlidesHTML,
    onError: key => showToast(t(key)),
    onCopied: key => showToast(t(key)),
  });

  /**
   * The plan on screen, on the Ministry's «خطة الدرس» form. The form is
   * Arabic-only, so names come from the Arabic fields whatever the UI
   * language. Teacher-role text is this plan's own phases folded into the four
   * stages; the learner column is left for the teacher — the plan on screen
   * has no learner half, and a second generation would no longer match what
   * the teacher has read and edited.
   */
  const handleMinistry = async () => {
    if (!result) return;
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
        stages: stagesFromLessonPlan(result),
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

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 140, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ToolHeader topPad={topPad} isRTL={isRTL} title={t('generateLessonPlanTitle')} eyebrow={{ icon: 'sparkles', label: t('aiLessonPlanBadge') }} />

      {/* Form */}
      <View style={styles.form}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} hidden={teacherScope.gradeHidden} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} hidden={subjectHidden} />

        {/* Topic / lesson selector */}
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

        {/* The three optional boxes fold away: nine fields stood between a
            teacher and the button, and most plans need none of these. Any box
            that already holds text keeps the section open. */}
        <Pressable
          onPress={() => setShowMore(v => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingVertical: 10, marginBottom: 6 }}
        >
          <Ionicons name={moreOpen ? 'chevron-up' : 'chevron-down'} size={16} color={ACCENT} />
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>{t('moreOptionsOptional')}</Text>
        </Pressable>
        {moreOpen ? (
          <>
        {/* Objectives (optional) */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('objectivesLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
            placeholder={t('objectivesPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={objectives}
            onChangeText={setObjectives}
            multiline
          />
        </View>

        {/* Adaptations / extra instructions (optional).
            Separate from objectives on purpose: "adapt this for a student with
            ADHD" is an instruction about how to write the plan, not something
            a student should be able to do by the end of it. Typed into the
            objectives box it came back as the lesson's stated objective. */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('adaptationsLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
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
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: -8, marginBottom: 16 }}>
          <Pressable
            onPress={() => {
              const preset = t('adaptationSimplifyPreset');
              if (adaptations.includes(preset)) return;
              setAdaptations(a => (a.trim() ? `${a.trim()}\n${preset}` : preset));
            }}
            style={[styles.presetChip, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="bulb-outline" size={14} color={ACCENT} />
            <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
              {t('adaptationSimplifyChip')}
            </Text>
          </Pressable>
        </View>

        {/* Prior topics to re-explain (optional).
            Separate from adaptations: this is content to revisit at the start
            of the lesson — earlier material some students haven't grasped —
            not an instruction about how to deliver today's new material. */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('priorTopicsLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
            placeholder={t('priorTopicsPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={priorTopicsNotes}
            onChangeText={setPriorTopicsNotes}
            multiline
          />
        </View>

          </>
        ) : null}

        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: priorReviewAvailable ? 1 : 0.55 }]}>
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
              fontSize: 13, lineHeight: 21,
              marginTop: 2,
              textAlign: isRTL ? 'right' : 'left',
            }}>
              {t('priorReviewPlanUnavailableNote')}
            </Text>
          ) : null}
        </View>

        {/* Duration picker */}
        <PickerField label={t('durationLabel')} value={durationLabels[durationIdx]} options={durationLabels} onChange={setDurationIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Teaching style picker */}
        <PickerField label={t('teachingStyleLabel')} value={styleLabels[styleIdx]} options={styleLabels} onChange={setStyleIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/*
          The validation error (an empty topic) still belongs here, next to the
          field it is about. Generation failures moved down to GenerationStatus,
          beside the spinner they replace — they used to render above the form,
          out of sight of the button that had just been pressed.
        */}
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button
          label={loading ? t('generatingLessonPlan') : t('generateLessonPlanBtn')}
          onPress={() => generate()}
          loading={loading}
          fullWidth
        />
      </View>

      <GenerationStatus
        phase={loading ? 'loading' : cancelled ? 'cancelled' : (error && topic.trim()) ? 'error' : 'idle'}
        loadingLabel={t('craftingLessonPlan')}
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
        </View>
      )}

      {/* Result */}
      {result && (
        <LessonPlanResult
          plan={result}
          colors={colors}
          isRTL={outLang === 'ar'}
          t={outT}
          onEdit={applyEdit}
          editedFields={editedFields}
        />
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
          materialType="lesson"
          toolId="lesson-plan"
          topic={scope.topic}
        />
      )}
    </ScrollView>
    {result && !loading && (
      <GeneratorSaveBar accent={ACCENT} savedId={savedId} saveState={saveLabel} onSave={handleSave} onExport={() => setShowExport(true)} />
    )}

    <ExportMenu
      visible={showExport}
      onClose={() => setShowExport(false)}
      onShare={handleShareText}
      onCopy={handleCopy}
      onPDF={handlePDF}
      onWord={handleWord}
      onSlides={handleSlides}
      onMinistry={handleMinistry}
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

function LessonPlanResult({ plan, colors, isRTL, t, onEdit, editedFields }: {
  plan: LessonPlanOutput;
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
        <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
        <Text style={[styles.resultHeaderText, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {t('lessonPlanReady')}
        </Text>
      </View>

      <LessonPlanView
        plan={plan}
        colors={colors}
        isRTL={isRTL}
        t={t}
        accent={ACCENT}
        onEdit={onEdit}
        editedFields={editedFields}
      />
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

const styles = StyleSheet.create({
  form: { padding: 20, paddingBottom: 8 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  inputBox: { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5 },
  textInput: { fontSize: 15, padding: 0, minHeight: 44 },
  checkboxGroup: { borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  checkRow: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 20 },
  resultHeaderText: { fontSize: 14 },
});
