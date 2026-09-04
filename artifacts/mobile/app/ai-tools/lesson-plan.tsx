import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { buildAdaptationsDirective, generatorFigureCount, generatorLessonId, generatorUnitId, getUnitPriorKnowledge, resolveGeneratorGrounding } from '@/services/kbContext';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { LessonPlanOutput } from '@/services/ai/AIService';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { groundedSubjectConflict, topicPickerParams } from '@/services/lessonPrep';
import { TopicSelector } from '@/components/ui/TopicSelector';
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
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { buildLessonPlanHTML, buildLessonPlanSlidesHTML, formatLessonPlanText } from '@/services/share';

const ACCENT = '#1B6B62';

const DURATION_VALUES = [30, 45, 60, 90];
const STYLE_IDS = ['direct', 'inquiry', 'collaborative'] as const;

export default function LessonPlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{
    topic?: string; savedId?: string;
    gradeIdx?: string; subjectIdx?: string; durationIdx?: string; styleIdx?: string; objectives?: string;
    adaptations?: string;
    priorTopicsNotes?: string;
    simplify?: string;
  }>();
  const isSimplify = params.simplify === '1';
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = subjects.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);
  const styleLabels = [t('teachingStyleDirect'), t('teachingStyleInquiry'), t('teachingStyleCollaborative')];

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
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(params.subjectIdx ?? inferredScope?.subjectIdx, subjects.length));
  const [topic, setTopic] = useState(params.topic ?? '');

  // Reset topic when grade or subject changes so stale KB selections are cleared
  const prevGradeRef = React.useRef(gradeIdx);
  const prevSubjectRef = React.useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);
  const [objectives, setObjectives] = useState(params.objectives ?? '');
  const [adaptations, setAdaptations] = useState(params.adaptations ?? '');
  const [priorTopicsNotes, setPriorTopicsNotes] = useState(params.priorTopicsNotes ?? '');
  const [includePriorReview, setIncludePriorReview] = useState(false);
  const [durationIdx, setDurationIdx] = useState(params.durationIdx ? parseInt(params.durationIdx, 10) : 1);
  const [styleIdx, setStyleIdx] = useState(params.styleIdx ? parseInt(params.styleIdx, 10) : 0);
  const [loading, setLoading] = useState(false);
  /**
   * Held across renders so Cancel can reach the in-flight request. A cancel
   * that only cleared the spinner would leave the call running and still
   * billing against AI_BUDGET_USD — the teacher would have stopped the
   * waiting, not the spending.
   */
  const abortRef = useRef<AbortController | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<LessonPlanOutput | null>(null);
  /** null until first generate; then whether the plan used a confident KB lesson. */
  const [curriculumGrounded, setCurriculumGrounded] = useState<boolean | null>(null);
  /** Title of the curriculum lesson the output was anchored to, when grounded. */
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  /**
   * Fields the teacher has changed. Kept so provenance stays honest — a plan
   * that has been edited is no longer purely machine-written, and the save
   * button needs to know there is something new to save.
   */
  const [editedFields, setEditedFields] = useState<ReadonlySet<string>>(new Set());
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
    if (result) setSaveLabel(savedId ? 'updated' : 'save');
  }, [result]);

  const applyEdit = <K extends keyof LessonPlanOutput>(field: K, value: LessonPlanOutput[K]) => {
    setResult(prev => (prev ? { ...prev, [field]: value } : prev));
    setEditedFields(prev => new Set(prev).add(field as string));
    // Something changed since the last save, so offer to save it again.
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
    // plan — the KB serves that lesson's own content while the header claims
    // the picked subject. Refuse and name the real subject instead.
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', lang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError('');
    setCancelled(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setResult(null);
    setCurriculumGrounded(null);
    setGroundedLesson(null);
    setEditedFields(new Set());
    setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en', {
        teacherObjectives: objectives.trim() || undefined,
      });
      const additionalContext = [
        isSimplify ? 'mode:simplify' : '',
        grounding.grounded ? grounding.context : grounding.ungroundedNote,
        buildAdaptationsDirective(adaptations, lang as 'ar' | 'en'),
      ].filter(Boolean).join('\n') || undefined;
      const unitPrior = grounding.lesson ? getUnitPriorKnowledge(grounding.lesson.id) : [];
      const usePrior = includePriorReview && unitPrior.length > 0;
      const out = await aiService.generateLessonPlan({
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        subject: subjects[subjectIdx].name,
        topic: isSimplify && !/تبسيط|simplify/i.test(topic)
          ? (lang === 'ar' ? `تبسيط الشرح: ${topic.trim()}` : `Simplify explanation: ${topic.trim()}`)
          : topic.trim(),
        duration: DURATION_VALUES[durationIdx],
        language: lang === 'ar' ? 'arabic' : 'english',
        teachingStyle: STYLE_IDS[styleIdx],
        objectives: isSimplify
          ? (objectives.trim() || (lang === 'ar' ? 'تبسيط الشرح' : 'Simplify explanation'))
          : (objectives.trim() || undefined),
        additionalContext,
        unitId: generatorUnitId(topic.trim(), lang as 'ar' | 'en'),
        lessonId: generatorLessonId(topic.trim(), lang as 'ar' | 'en'),
        bookFigureCount: generatorFigureCount(topic.trim(), lang as 'ar' | 'en'),
        // Objectives, adaptations and prior-topic notes are all free text the
        // teacher typed, and all three are carried into the plan verbatim. A
        // plan built from any of them is that teacher's and is never pooled;
        // a plan built from the lesson alone is everybody's.
        contextSource: (objectives.trim() || adaptations.trim() || priorTopicsNotes.trim())
          ? 'teacher' as const
          : 'curriculum' as const,
        ...regenerationFields(opts?.regenerate === true, previous),
        includePriorReview: usePrior || undefined,
        priorKnowledge: usePrior ? unitPrior : undefined,
        priorTopicsNotes: priorTopicsNotes.trim() || undefined,
      }, { signal: controller.signal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose or retry out of.
      if (isAbortError(e)) setCancelled(true);
      // Deliberately not the raw error: "HTTP 500" is not a sentence in any
      // language a teacher reads. The technical text is already recorded in
      // aiProvenance, where the badge carries it for support.
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
      ? `خطة درس: ${topic.trim()}`
      : `Lesson Plan: ${topic.trim()}`;
    const formState = {
      gradeIdx, subjectIdx, topic: topic.trim(), durationIdx, styleIdx, objectives, adaptations,
      priorTopicsNotes,
    };

    // `updateItem` answers false when the material is no longer there — the
    // teacher deleted it from موادي while this screen still held its id. The
    // return value used to be dropped, so the button reported "تم التحديث"
    // over a material that no longer existed and the work was never saved
    // again. Folding the call into the condition makes a failed update fall
    // through to creating a fresh one, which is what pressing Save meant.
    if (savedId && (await updateItem(savedId, {
        title,
        subject: subjects[subjectIdx].name,
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        topic: topic.trim(),
        language: lang,
        content: JSON.stringify(result),
        formState,
      }))) {
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({
        type: 'lesson',
        title,
        subject: subjects[subjectIdx].name,
        // Localised: this string is carried into generated content verbatim —
        // the Arabic worksheet header printed «الصف: Grade 10». `grade` is never
        // compared anywhere, only displayed and passed through, so translating it
        // is safe. `subject` is deliberately left in English: it feeds
        // isMathContext and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        topic: topic.trim(),
        language: lang,
        content: JSON.stringify(result),
        formState,
      });
      setSavedId(saved.id);
      setSaveLabel('saved');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };


  const getExportMeta = () => ({
    // Localised, like the picker above it. Taking `.name` straight off the
    // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
    // plan — the screen showed الرياضيات and the exported file disagreed.
    subject: subjectNames[subjectIdx]!,
    grade: gradeNames[gradeIdx]!,
    duration: DURATION_VALUES[durationIdx],
  });

  const getExportTitle = () => lang === 'ar' ? `خطة درس: ${topic.trim()}` : `Lesson Plan: ${topic.trim()}`;

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
    formatText: formatLessonPlanText,
    buildHTML: buildLessonPlanHTML,
    buildSlidesHTML: buildLessonPlanSlidesHTML,
    onError: key => showToast(t(key)),
    onCopied: key => showToast(t(key)),
  });

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

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
        <View style={[styles.headerBadge, { flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={[styles.headerBadgeText, { color: '#fff', fontFamily: 'Cairo_500Medium' }]}>{t('aiLessonPlanBadge')}</Text>
        </View>
        <AiSourceBadge onDark isRTL={isRTL} />
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {isSimplify ? t('simplifyExplanationTitle') : t('generateLessonPlanTitle')}
        </Text>
        {isSimplify ? (
          <Text style={[{ color: 'rgba(255,255,255,0.75)', fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('simplifyExplanationSubtitle')}
          </Text>
        ) : null}
      </View>

      {/* Form */}
      <View style={styles.form}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Topic / lesson selector */}
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

        {/* Objectives (optional) */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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

        {/* Prior topics to re-explain (optional).
            Separate from adaptations: this is content to revisit at the start
            of the lesson — earlier material some students haven't grasped —
            not an instruction about how to deliver today's new material. */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
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
              fontSize: 12,
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
        {error && !topic.trim() ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
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
        </View>
      )}

      {/* Result */}
      {result && (
        <LessonPlanResult
          plan={result}
          colors={colors}
          isRTL={isRTL}
          t={t}
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
          toolId={isSimplify ? 'simplify' : 'lesson-plan'}
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
        <Text style={[styles.resultHeaderText, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>
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
      <Text style={[{ color: disabled ? colors.mutedForeground : colors.foreground, fontFamily: checked ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
    </Pressable>
  );
}

function PickerField({ label, value, options, onChange, colors, isRTL, accent }: {
  label: string; value: string; options: string[]; onChange: (i: number) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map((o, i) => (
              <Pressable
                key={i}
                onPress={() => { onChange(i); setOpen(false); }}
                style={[styles.pickerOption, { borderBottomColor: colors.border, backgroundColor: o === value ? colors.secondary : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Text style={[{ color: o === value ? accent : colors.foreground, fontFamily: o === value ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{o}</Text>
                {o === value && <Ionicons name="checkmark" size={16} color={accent} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerBadge: { alignItems: 'center', gap: 6, marginBottom: 8 },
  headerBadgeText: { fontSize: 13 },
  headerTitle: { fontSize: 24 },
  form: { padding: 20, paddingBottom: 8 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  inputBox: { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  textInput: { fontSize: 15, padding: 0, minHeight: 44 },
  checkboxGroup: { borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  checkRow: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickerBtn: { alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pickerDropdown: { borderWidth: 1, marginTop: -8, marginBottom: 8, overflow: 'hidden' },
  pickerOption: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 20 },
  resultHeaderText: { fontSize: 14 },
  resultSectionHeader: { alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14 },
  resultSectionBody: { padding: 14, borderWidth: 1 },
  bulletRow: { gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  bodyText: { fontSize: 13, lineHeight: 20 },
});
