/**
 * «تبسيط الشرح» — a handout for the student who did not follow the lesson.
 *
 * This screen exists because the tool did not have one. It was
 * `/ai-tools/lesson-plan?simplify=1`: the same `LessonPlanOutput`, the same
 * endpoint, the same PDF, and a subtitle promising students a direct
 * explanation over an artifact full of the teacher's own objectives and
 * assessment. See `explainerBlueprint.ts` for what it produces now.
 *
 * The form is deliberately shorter than the lesson plan's. No duration, no
 * teaching style, no objectives, no prior-knowledge review: none of those are
 * things a student's handout has, and offering them was how the old screen
 * kept its second personality.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import {
  buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId,
  resolveGeneratorGrounding,
} from '@/services/kbContext';
import { isAbortError } from '@/services/ai/aiProvenance';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import type { SimplifiedExplanationOutput } from '@/services/ai/AIService';
import { getPickerGrades, getPickerSubjects, resolvePickerIndex } from '@/services/curriculumData';
import {
  groundedSubjectConflict, scopeWithoutCurriculum, stripExplainerPrefix,
  subjectsWithoutCurriculum, topicPickerParams,
} from '@/services/lessonPrep';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField } from '@/components/ui/PickerField';
import { StrandedSelectionNote } from '@/components/ui/StrandedSelectionNote';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { GenerationStatus } from '@/components/ui/GenerationStatus';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { SimplifiedExplanationView } from '@/components/ui/SimplifiedExplanationView';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { buildSimplifiedExplanationHTML, formatSimplifiedExplanationText } from '@/services/share';

const ACCENT = '#00A99D';

export default function SimplifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; topic?: string;
    gradeIdx?: string; subjectIdx?: string; struggle?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = subjects.map(s => lang === 'ar' ? s.nameAr : s.name);

  /**
   * Old links and the related-tools panel still carry «تبسيط الشرح: <lesson>».
   * Grounding runs on the bare lesson title or it grounds to nothing at all —
   * and an ungrounded handout is a generic one.
   */
  const incomingTopic = stripExplainerPrefix(params.topic);

  // A bare `topic` says which grade and subject it belongs to better than
  // picker index 0 does — ground it rather than opening a maths lesson under
  // whatever subject happens to sit first (see CLAUDE.md on `isMathContext`).
  const [inferredScope] = useState(() =>
    params.gradeIdx == null && params.subjectIdx == null
      ? topicPickerParams(incomingTopic, lang as 'ar' | 'en')
      : null,
  );
  const [gradeIdx, setGradeIdx] = useState(() =>
    resolvePickerIndex(params.gradeIdx ?? inferredScope?.gradeIdx, grades.length));
  // Index-aligned flags rather than a pre-filtered list: these positions are
  // persisted as subjectIdx, so entries are dropped at render time only.
  const subjectHidden = subjectsWithoutCurriculum(grades[gradeIdx].id);
  const [subjectIdx, setSubjectIdx] = useState(() =>
    resolvePickerIndex(params.subjectIdx ?? inferredScope?.subjectIdx, subjects.length));
  const [topic, setTopic] = useState(incomingTopic);
  const [struggle, setStruggle] = useState(params.struggle ?? '');
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<SimplifiedExplanationOutput | null>(null);
  const [curriculumGrounded, setCurriculumGrounded] = useState<boolean | null>(null);
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try { setResult(JSON.parse(item.content) as SimplifiedExplanationOutput); } catch { /* noop */ }
        }
      });
    }
  }, [params.savedId]);

  useEffect(() => {
    if (result) setSaveLabel(savedId ? 'updated' : 'save');
  }, [result]);

  const generate = async (opts?: { regenerate?: boolean }) => {
    const previous = result;
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, lang as 'ar' | 'en');
    if (scope) { setError(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // handout: the KB serves that lesson's content while the header claims the
    // picked subject.
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', lang === 'ar' ? conflict.nameAr : conflict.name)); return; }

    setError(''); setCancelled(false); setLoading(true); setResult(null); setSaveLabel('save');
    const controller = new AbortController();
    abortRef.current = controller;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      const struggleNote = struggle.trim();
      const additionalContext = [
        buildGeneratorContext(topic.trim(), lang as 'ar' | 'en'),
        struggleNote
          ? (lang === 'ar'
              ? `ما يتعثر فيه الطلاب تحديدًا: ${struggleNote}`
              : `What students specifically struggle with: ${struggleNote}`)
          : '',
      ].filter(Boolean).join('\n') || undefined;

      const out = await aiService.generateSimplifiedExplanation({
        // Localised: this string is carried into the generated content
        // verbatim and only ever displayed. `subject` stays English — it feeds
        // `isMathContext` and ~30 other call sites.
        grade: gradeNames[gradeIdx]!,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        additionalContext,
        unitId: generatorUnitId(topic.trim(), lang as 'ar' | 'en'),
        lessonId: generatorLessonId(topic.trim(), lang as 'ar' | 'en'),
        bookFigureCount: generatorFigureCount(topic.trim(), lang as 'ar' | 'en'),
        // The struggle note is the teacher's own words and is carried into the
        // handout verbatim, so that request is theirs alone and never enters
        // the shared pool. Picking a lesson and generating does.
        contextSource: struggleNote ? 'teacher' as const : 'curriculum' as const,
        ...regenerationFields(opts?.regenerate === true, previous),
      }, { signal: controller.signal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      // A cancel is the teacher's own doing, so it is reported as a stop, not
      // as a failure they need to diagnose.
      if (isAbortError(e)) setCancelled(true);
      else setError(t('generationFailed'));
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  /** Stop the in-flight request and hand the teacher their form back. */
  const cancelGenerate = () => { abortRef.current?.abort(); };

  const getExportTitle = () => lang === 'ar'
    ? `تبسيط الشرح: ${topic.trim()}`
    : `Simplified explanation: ${topic.trim()}`;

  const getExportMeta = () => ({
    subject: subjectNames[subjectIdx]!,
    grade: gradeNames[gradeIdx]!,
  });

  const handleSave = async () => {
    if (!result) return;
    const title = getExportTitle();
    const formState = { gradeIdx, subjectIdx, topic: topic.trim(), struggle };
    const payload = {
      title,
      subject: subjects[subjectIdx].name,
      grade: grades[gradeIdx].name,
      topic: topic.trim(),
      language: lang,
      content: JSON.stringify(result),
      formState,
    };
    // A failed update means the teacher deleted the material from موادي while
    // this screen still held its id — fall through and create a fresh one
    // rather than reporting «تم التحديث» over something that is gone.
    if (savedId && (await updateItem(savedId, payload))) {
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({ type: 'explainer', ...payload });
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
    loadingPDF,
    loadingWord,
  } = useGeneratorExport({
    result,
    topic,
    lang,
    getTitle: getExportTitle,
    getMeta: getExportMeta,
    formatText: formatSimplifiedExplanationText,
    buildHTML: buildSimplifiedExplanationHTML,
    // No deck: this is a printed handout, and ExportMenu hides the row.
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
        <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: topPad + 12 }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={[styles.headerBadge, { flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name="bulb" size={14} color="#fff" />
            <Text style={[styles.headerBadgeText, { color: '#fff', fontFamily: 'Cairo_500Medium' }]}>{t('explainerBadge')}</Text>
          </View>
          <AiSourceBadge onDark isRTL={isRTL} />
          <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('createExplainerTitle')}
          </Text>
        </View>

        <View style={styles.form}>
          <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
          <StrandedSelectionNote hidden={subjectHidden} index={subjectIdx} message={t('scopeNoCurriculumHint')} isRTL={isRTL} colors={colors} />
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

          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('explainerStruggleLabel')}
          </Text>
          <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
              placeholder={t('explainerStrugglePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={struggle}
              onChangeText={setStruggle}
              multiline
            />
          </View>

          <Button
            label={loading ? t('generatingExplainer') : t('generateExplainerBtn')}
            onPress={() => generate()}
            loading={loading}
            disabled={!topic.trim()}
            fullWidth
          />
          {/* A greyed-out primary button with nothing beside it reads as a
              broken product rather than an unmet precondition. */}
          {!topic.trim() ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
              {t('needTopicHint')}
            </Text>
          ) : null}
        </View>

        <GenerationStatus
          phase={loading ? 'loading' : cancelled ? 'cancelled' : (error && topic.trim()) ? 'error' : 'idle'}
          loadingLabel={t('craftingExplainer')}
          errorDetail={error}
          onCancel={cancelGenerate}
          onRetry={generate}
          colors={colors}
          isRTL={isRTL}
          lang={lang as 'ar' | 'en'}
          accent={ACCENT}
          t={t}
        />

        {/* What the handout is anchored to. Shown both ways: a teacher needs to
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

        {result && (
          <View style={{ marginHorizontal: 20, marginTop: 12 }}>
            <SimplifiedExplanationView
              explainer={result}
              colors={colors}
              isRTL={isRTL}
              t={t}
              accent={ACCENT}
            />
          </View>
        )}

        {result && !loading && (
          <GeneratorResultActions
            accent={ACCENT}
            savedId={savedId}
            onToast={showToast}
            saveState={saveLabel}
            onSave={handleSave}
            onExport={() => setShowExport(true)}
            onRegenerate={() => generate({ regenerate: true })}
            variantId={pooledVariantId(result)}
            materialType="explainer"
            toolId="simplify"
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
        isRTL={isRTL}
        loadingPDF={loadingPDF}
        loadingWord={loadingWord}
        labels={exportLabels}
      />
      <Toast visible={toastVisible} message={toastMsg} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 8 },
  backBtn: { padding: 4, marginBottom: 4 },
  headerBadge: { alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  headerBadgeText: { fontSize: 11 },
  headerTitle: { fontSize: 21 },
  form: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, marginTop: 8, marginBottom: 6 },
  inputBox: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  textInput: { fontSize: 14, paddingVertical: 8 },
});
