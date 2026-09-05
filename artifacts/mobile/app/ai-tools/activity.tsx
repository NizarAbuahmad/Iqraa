import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding } from '@/services/kbContext';
import { isolateForeignRuns } from '@/services/mathRender';
import { pooledVariantId, regenerationFields } from '@/services/ai/regeneration';
import { ActivityOutput, ActivityStep } from '@/services/ai/AIService';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { groundedSubjectConflict, scopeWithoutCurriculum, subjectsWithoutCurriculum, topicPickerParams } from '@/services/lessonPrep';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PickerField } from '@/components/ui/PickerField';
import { GroundingNotice } from '@/components/ui/GroundingNotice';
import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import {
  ACTIVITY_TYPE_IDS,
  activityTypeLabel,
  type ActivityTypeId,
} from '@/constants/activityType';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Toast } from '@/components/ui/Toast';
import { AiSourceBadge } from '@/components/ui/AiSourceBadge';
import { GeneratorResultActions } from '@/components/ui/GeneratorResultActions';
import { useGeneratorExport } from '@/hooks/useGeneratorExport';
import { buildActivityHTML, buildActivitySlidesHTML, formatActivityText } from '@/services/share';

const ACCENT = '#E67E22';
const DURATION_VALUES = [20, 30, 45, 60];
type AType = ActivityTypeId;

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{
    savedId?: string; topic?: string;
    gradeIdx?: string; subjectIdx?: string; activityTypeIdx?: string; durationIdx?: string; objective?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();
  const gradeNames = grades.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = subjects.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);
  const activityTypeLabels = ACTIVITY_TYPE_IDS.map(id => activityTypeLabel(id, t));

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
  // Index-aligned with `subjects`. Subjects with no book for the picked grade
  // stay in the list — their positions are persisted — but are not pickable.
  const subjectDisabled = subjectsWithoutCurriculum(grades[gradeIdx].id);
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(params.subjectIdx ?? inferredScope?.subjectIdx, subjects.length));
  const [topic, setTopic] = useState(params.topic ?? '');
  const [activityTypeIdx, setActivityTypeIdx] = useState(params.activityTypeIdx ? parseInt(params.activityTypeIdx, 10) : 1);
  const [durationIdx, setDurationIdx] = useState(params.durationIdx ? parseInt(params.durationIdx, 10) : 1);
  const [objective, setObjective] = useState(params.objective ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActivityOutput | null>(null);
  /** Whether the output was anchored to a curriculum lesson, and which one. */
  const [curriculumGrounded, setCurriculumGrounded] = useState<boolean | null>(null);
  const [groundedLesson, setGroundedLesson] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [showExport, setShowExport] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

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

  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try { setResult(JSON.parse(item.content) as ActivityOutput); } catch { /* noop */ }
        }
      });
    }
  }, [params.savedId]);

  useEffect(() => {
    if (result) setSaveLabel(savedId ? 'updated' : 'save');
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
    // Read before any setState clears it — this is what the teacher is
    // looking at, and what a regeneration must not hand back.
    const previous = result;
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // activity — the KB serves that lesson's own content while the header
    // claims the picked subject. Refuse and name the real subject instead.
    const scope = scopeWithoutCurriculum(grades[gradeIdx].id, subjects[subjectIdx].id, lang as 'ar' | 'en');
    if (scope) { setError(t('scopeNoCurriculum', scope.grade, scope.subject)); return; }
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', lang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError(''); setLoading(true); setResult(null); setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const grounding = resolveGeneratorGrounding(topic.trim(), lang as 'ar' | 'en');
      setCurriculumGrounded(grounding.grounded);
      setGroundedLesson(
        grounding.lesson ? (lang === 'ar' ? grounding.lesson.titleAr : grounding.lesson.titleEn) : null,
      );
      const additionalContext = buildGeneratorContext(topic.trim(), lang as 'ar' | 'en');
      const unitId = generatorUnitId(topic.trim(), lang as 'ar' | 'en');
      const out = await aiService.generateActivity({
        grade: grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        activityType: ACTIVITY_TYPE_IDS[activityTypeIdx],
        duration: DURATION_VALUES[durationIdx],
        objectives: objective.trim() || undefined,
        additionalContext,
        unitId,
        lessonId: generatorLessonId(topic.trim(), lang as 'ar' | 'en'),
        bookFigureCount: generatorFigureCount(topic.trim(), lang as 'ar' | 'en'),
        // A typed objective is the teacher's own words, and they end up inside
        // the generated activity — so that request is theirs alone and never
        // enters the shared pool. Picking a lesson and generating does.
        contextSource: objective.trim() ? 'teacher' : 'curriculum',
        ...regenerationFields(opts?.regenerate === true, previous),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(out);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      setError(t('generationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getExportTitle = () => lang === 'ar'
    ? `نشاط: ${topic.trim()}`
    : `Activity: ${topic.trim()}`;

  const getExportMeta = () => ({
    // Localised, like the picker above it. Taking `.name` straight off the
    // catalog put "Mathematics | Grade 10" at the top of an otherwise Arabic
    // plan — the screen showed الرياضيات and the exported file disagreed.
    subject: subjectNames[subjectIdx]!,
    grade: gradeNames[gradeIdx]!,
  });

  const handleSave = async () => {
    if (!result) return;
    const title = getExportTitle();
    const formState = { gradeIdx, subjectIdx, topic: topic.trim(), activityTypeIdx, durationIdx, objective };

    // `updateItem` answers false when the material is no longer there — the
    // teacher deleted it from موادي while this screen still held its id. The
    // return value used to be dropped, so the button reported "تم التحديث"
    // over a material that no longer existed and the work was never saved
    // again. Folding the call into the condition makes a failed update fall
    // through to creating a fresh one, which is what pressing Save meant.
    if (savedId && (await updateItem(savedId, {
        title,
        subject: subjects[subjectIdx].name,
        grade: grades[gradeIdx].name,
        topic: topic.trim(),
        language: lang,
        content: JSON.stringify(result),
        formState,
      }))) {
      setSaveLabel('updated');
    } else {
      const saved = await saveItem({
        // Its own type, not 'lesson'. That substitution existed only because
        // the workspace viewer had no activity branch and fell through to the
        // quiz renderer; it has one now (see app/workspace/view.tsx), so the
        // material can say what it is. Activities already saved as 'lesson'
        // are rescued there by shape — nothing needs migrating.
        type: 'activity',
        title,
        subject: subjects[subjectIdx].name,
        grade: grades[gradeIdx].name,
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
    formatText: formatActivityText,
    buildHTML: buildActivityHTML,
    buildSlidesHTML: buildActivitySlidesHTML,
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
          <Ionicons name="flash" size={14} color="#fff" />
          <Text style={[styles.headerBadgeText, { color: '#fff', fontFamily: 'Cairo_500Medium' }]}>{t('activityBadge')}</Text>
        </View>
        <AiSourceBadge onDark isRTL={isRTL} />
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('createActivityTitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} disabled={subjectDisabled} disabledNote={t('noCurriculumOption')} />

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

        <PickerField label={t('activityTypeLabel')} value={activityTypeLabels[activityTypeIdx]} options={activityTypeLabels} onChange={setActivityTypeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('durationLabel')} value={durationLabels[durationIdx]} options={durationLabels} onChange={setDurationIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('activityObjectiveLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
            placeholder={t('activityObjectivePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={objective}
            onChangeText={setObjective}
            multiline
          />
        </View>

        {error ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button
          label={loading ? t('generatingActivity') : t('generateActivityBtn')}
          onPress={() => generate()}
          loading={loading}
          disabled={!topic.trim()}
          fullWidth
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
      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('craftingActivity')}
          </Text>
        </View>
      )}

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

      {result && <ActivityResult activity={result} colors={colors} isRTL={isRTL} t={t} lang={lang} />}

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
          materialType="activity"
          toolId="activity"
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

function ActivityResult({ activity, colors, isRTL, t, lang }: {
  activity: ActivityOutput;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
  lang: string;
}) {
  const ACCENT_LOCAL = '#E67E22';
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      {/* Success banner */}
      <View style={[styles.resultHeader, { backgroundColor: ACCENT_LOCAL + '15', borderColor: ACCENT_LOCAL + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="checkmark-circle" size={20} color={ACCENT_LOCAL} />
        <Text style={[styles.resultHeaderText, { color: ACCENT_LOCAL, fontFamily: 'Cairo_600SemiBold' }]}>
          {t('activityReady')}
        </Text>
      </View>

      {/* Meta row */}
      <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
        <MetaPill icon="people-outline" label={activity.groupSize} color={ACCENT_LOCAL} />
        <MetaPill icon="time-outline" label={`${activity.totalDuration} ${t('min')}`} color={ACCENT_LOCAL} />
        <MetaPill icon="flash-outline" label={activityTypeLabel(activity.activityType, t)} color={ACCENT_LOCAL} />
      </View>

      {/* Objective */}
      <View style={[styles.objectiveBox, { backgroundColor: ACCENT_LOCAL + '10', borderColor: ACCENT_LOCAL + '30', borderRadius: colors.radius }]}>
        <Text style={[{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 11, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }]}>
          {lang === 'ar' ? 'الهدف' : 'Objective'}
        </Text>
        <Text style={[{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }]}>
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
          <Ionicons name="list-outline" size={15} color={ACCENT_LOCAL} />
          <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
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
      <Ionicons name={icon} size={13} color={color} />
      <Text style={{ fontSize: 12, color, fontFamily: 'Cairo_500Medium' }}>{label}</Text>
    </View>
  );
}

function StepCard({ step, colors, isRTL, t }: {
  step: ActivityStep; colors: ReturnType<typeof useColors>; isRTL: boolean; t: (k: any) => string;
}) {
  const ACCENT_LOCAL = '#E67E22';
  return (
    <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[styles.stepHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.stepNum, { backgroundColor: ACCENT_LOCAL }]}>
          <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Cairo_700Bold' }}>{step.stepNumber}</Text>
        </View>
        <Text
          style={[
            styles.stepTitle,
            {
              color: colors.foreground,
              fontFamily: 'Cairo_600SemiBold',
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
  const ACCENT_LOCAL = '#E67E22';
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.resultSectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={15} color={ACCENT_LOCAL} />
        <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
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
      <View style={[styles.bulletDot, { backgroundColor: ACCENT }]} />
      <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{isolateForeignRuns(text)}</Text>
    </View>
  );
}

function BodyText({ text, colors, isRTL }: { text: string; colors: ReturnType<typeof useColors>; isRTL: boolean }) {
  return <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>{isolateForeignRuns(text)}</Text>;
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
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  loadingText: { fontSize: 14 },
  resultHeader: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 16 },
  resultHeaderText: { fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginBottom: 16, borderRadius: 10, overflow: 'hidden' },
  objectiveBox: { padding: 14, borderWidth: 1, marginBottom: 16 },
  resultSectionHeader: { alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14 },
  resultSectionBody: { padding: 14, borderWidth: 1 },
  bulletRow: { gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  bodyText: { fontSize: 13, lineHeight: 20 },
  stepCard: { borderWidth: 1, padding: 14, marginBottom: 10 },
  stepHeader: { alignItems: 'center', gap: 10, marginBottom: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle: { fontSize: 13 },
  stepDur: { fontSize: 11 },
  stepDesc: { fontSize: 13, lineHeight: 20 },
});
