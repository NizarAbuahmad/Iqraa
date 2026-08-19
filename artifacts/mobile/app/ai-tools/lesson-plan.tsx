import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { resolveGeneratorGrounding } from '@/services/kbContext';
import { LessonPlanOutput } from '@/services/ai/AIService';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, toggleFavorite, updateItem } from '@/services/workspace';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { LessonPlanView } from '@/components/ui/LessonPlanView';
import { DemoModeBanner } from '@/components/ui/DemoModeBanner';
import { RelatedResourcesPanel } from '@/components/ui/RelatedResourcesPanel';
import { FeedbackWidget } from '@/components/ui/FeedbackWidget';
import {
  buildLessonPlanHTML,
  buildLessonPlanSlidesHTML,
  copyToClipboard,
  exportAsPDF,
  exportAsWord,
  formatLessonPlanText,
  shareAsText,
} from '@/services/share';

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

  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(params.gradeIdx, grades.length));
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(params.subjectIdx, subjects.length));
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
  const [durationIdx, setDurationIdx] = useState(params.durationIdx ? parseInt(params.durationIdx, 10) : 1);
  const [styleIdx, setStyleIdx] = useState(params.styleIdx ? parseInt(params.styleIdx, 10) : 0);
  const [loading, setLoading] = useState(false);
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
  const [favorited, setFavorited] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [loadingWord, setLoadingWord] = useState(false);
  const [loadingSlides, setLoadingSlides] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

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

  const generate = async () => {
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    setError('');
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
      ].filter(Boolean).join('\n') || undefined;
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
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      setError(t('generationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    const title = lang === 'ar'
      ? `خطة درس: ${topic.trim()}`
      : `Lesson Plan: ${topic.trim()}`;
    const formState = { gradeIdx, subjectIdx, topic: topic.trim(), durationIdx, styleIdx, objectives };

    if (savedId) {
      await updateItem(savedId, {
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

  const handleToggleFavorite = async () => {
    if (!savedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !favorited;
    setFavorited(next);
    try {
      await toggleFavorite(savedId);
    } catch {
      setFavorited(!next); // revert on failure
    }
    showToast(next ? (lang === 'ar' ? 'أضفتها إلى المفضلة ⭐' : 'Added to Favourites ⭐') : (lang === 'ar' ? 'أزلتها من المفضلة' : 'Removed from Favourites'));
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

  const handleShareText = async () => {
    if (!result) return;
    const text = formatLessonPlanText(result, getExportTitle(), getExportMeta(), lang === 'ar');
    await shareAsText(text, getExportTitle());
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = formatLessonPlanText(result, getExportTitle(), getExportMeta(), lang === 'ar');
    await copyToClipboard(text);
    showToast(t('copiedToClipboard'));
  };

  const handlePDF = async () => {
    if (!result) return;
    setLoadingPDF(true);
    try {
      const html = buildLessonPlanHTML(result, getExportTitle(), getExportMeta(), lang === 'ar');
      await exportAsPDF(html, getExportTitle().replace(/[^\w\s]/g, '').trim());
    } catch (e) {
      showToast(t('generationFailed'));
    } finally {
      setLoadingPDF(false);
    }
  };

  const handleWord = async () => {
    if (!result) return;
    setLoadingWord(true);
    try {
      const text = formatLessonPlanText(result, getExportTitle(), getExportMeta(), lang === 'ar');
      await exportAsWord(text, getExportTitle().replace(/[^\w\s]/g, '').trim(), lang === 'ar');
    } catch (e) {
      showToast(t('generationFailed'));
    } finally {
      setLoadingWord(false);
    }
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const saveBtnLabel =
    saveLabel === 'saved' ? t('savedSuccess')
      : saveLabel === 'updated' ? t('updatedSuccess')
        : savedId ? t('updateInWorkspace')
          : t('saveToWorkspace');

  const handleSlides = async () => {
    if (!result) return;
    setLoadingSlides(true);
    try {
      const html = buildLessonPlanSlidesHTML(result, getExportTitle(), getExportMeta(), lang === 'ar');
      await exportAsPDF(html, (getExportTitle() + '-slides').replace(/[^\w\s-]/g, '').trim());
    } catch (e) {
      showToast(t('generationFailed'));
    } finally {
      setLoadingSlides(false);
    }
  };

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
        <DemoModeBanner onDark isRTL={isRTL} />
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

        {/* Duration picker */}
        <PickerField label={t('durationLabel')} value={durationLabels[durationIdx]} options={durationLabels} onChange={setDurationIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Teaching style picker */}
        <PickerField label={t('teachingStyleLabel')} value={styleLabels[styleIdx]} options={styleLabels} onChange={setStyleIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {error ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button
          label={loading ? t('generatingLessonPlan') : t('generateLessonPlanBtn')}
          onPress={generate}
          loading={loading}
          fullWidth
        />
      </View>

      {/* Loading state */}
      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('craftingLessonPlan')}
          </Text>
        </View>
      )}

      {/* Grounding status — never present ungrounded output as curriculum-backed */}
      {/* What the material is anchored to. Shown both ways: a teacher needs
          to know it IS tied to the lesson as much as when it isn't. */}
      {result && curriculumGrounded !== null && (
        <View style={{ marginHorizontal: 20 }}>
          <GroundingNotice
            grounded={curriculumGrounded}
            lessonTitle={groundedLesson}
            isRTL={isRTL}
            colors={colors}
            labels={{
              grounded: (l: string) => t('groundedInCurriculum', l),
              generic: t('notGroundedTitle'),
              genericHint: t('notGroundedHint'),
            }}
          />
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
        <>
          <FeedbackWidget materialType="lesson" toolId={isSimplify ? 'simplify' : 'lesson-plan'} />
          <RelatedResourcesPanel
            toolId={isSimplify ? 'simplify' : 'lesson-plan'}
            topic={topic.trim()}
            isRTL={isRTL}
          />
        </>
      )}

      {/* Save + Regenerate */}
      {result && !loading && (
        <View style={{ marginHorizontal: 20, gap: 10, marginTop: 4, marginBottom: 20 }}>
          {/* Save button */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: (saveLabel === 'saved' || saveLabel === 'updated') ? ACCENT : 'transparent',
                borderColor: ACCENT,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons
              name={(saveLabel === 'saved' || saveLabel === 'updated') ? 'checkmark-circle' : 'bookmark-outline'}
              size={16}
              color={(saveLabel === 'saved' || saveLabel === 'updated') ? '#fff' : ACCENT}
            />
            <Text style={[
              styles.saveBtnText,
              { color: (saveLabel === 'saved' || saveLabel === 'updated') ? '#fff' : ACCENT, fontFamily: 'Cairo_600SemiBold' },
            ]}>
              {saveBtnLabel}
            </Text>
          </Pressable>
          {/* Favourite — only shown after saving */}
          {!!savedId && (
            <Pressable
              onPress={handleToggleFavorite}
              style={({ pressed }) => [
                styles.regenBtn,
                {
                  borderColor: favorited ? '#F59E0B' : colors.mutedForeground,
                  borderRadius: colors.radius,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  backgroundColor: favorited ? '#F59E0B18' : 'transparent',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons name={favorited ? 'star' : 'star-outline'} size={16} color={favorited ? '#F59E0B' : colors.mutedForeground} />
              <Text style={[styles.regenText, { color: favorited ? '#F59E0B' : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>
                {favorited ? (lang === 'ar' ? 'في المفضلة' : 'Favourited') : (lang === 'ar' ? 'أضف إلى المفضلة' : 'Add to Favourites')}
              </Text>
            </Pressable>
          )}
          {/* Export */}
          <Pressable
            onPress={() => setShowExport(true)}
            style={[styles.regenBtn, { borderColor: colors.mutedForeground, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="share-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.regenText, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>{t('exportBtn')}</Text>
          </Pressable>
          {/* Regenerate */}
          <Pressable
            onPress={generate}
            style={[styles.regenBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="refresh-outline" size={16} color={ACCENT} />
            <Text style={[styles.regenText, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>{t('regenerateBtn')}</Text>
          </Pressable>
        </View>
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
  pickerBtn: { alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pickerDropdown: { borderWidth: 1, marginTop: -8, marginBottom: 8, overflow: 'hidden' },
  pickerOption: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  loadingText: { fontSize: 14 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 20 },
  resultHeaderText: { fontSize: 14 },
  resultSectionHeader: { alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14 },
  resultSectionBody: { padding: 14, borderWidth: 1 },
  bulletRow: { gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  bodyText: { fontSize: 13, lineHeight: 20 },
  saveBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
  saveBtnText: { fontSize: 14 },
  regenBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
  regenText: { fontSize: 14 },
});
