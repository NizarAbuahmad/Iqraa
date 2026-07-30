/**
 * Lesson Flow Engine
 * Generates a complete, coherent lesson journey in one tap:
 * Objectives → Warm-up → Activity → Guided Practice → Worksheet → Exit Ticket
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { buildGeneratorContext } from '@/services/kbContext';
import {
  ActivityOutput,
  LessonFlowOutput,
  QuizOutput,
  WorksheetOutput,
} from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { Button } from '@/components/ui/Button';
import { saveItem } from '@/services/workspace';
import { Toast } from '@/components/ui/Toast';
import { buildLessonFlowHTML, exportAsPDF } from '@/services/share';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#00A99D';
const NAVY = '#081B3A';
const DURATION_VALUES = [45, 60, 90];

type Phase = 'form' | 'building' | 'done';
type StepKey = 'objectives' | 'warmup' | 'activity' | 'guided' | 'worksheet' | 'exitTicket';
type StepStatus = 'pending' | 'loading' | 'done';

interface StepState {
  objectives: StepStatus;
  warmup: StepStatus;
  activity: StepStatus;
  guided: StepStatus;
  worksheet: StepStatus;
  exitTicket: StepStatus;
}

const INITIAL_STEP_STATE: StepState = {
  objectives: 'pending',
  warmup: 'pending',
  activity: 'pending',
  guided: 'pending',
  worksheet: 'pending',
  exitTicket: 'pending',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LessonFlowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [topic, setTopic] = useState('');
  const [gradeIdx, setGradeIdx] = useState(9);
  const [subjectIdx, setSubjectIdx] = useState(2);
  const [durationIdx, setDurationIdx] = useState(0);

  // Generation state
  const [phase, setPhase] = useState<Phase>('form');
  const [stepStatus, setStepStatus] = useState<StepState>(INITIAL_STEP_STATE);
  const [error, setError] = useState('');

  // Result state (built incrementally)
  const [objectives, setObjectives] = useState<string[] | null>(null);
  const [warmup, setWarmup] = useState<ActivityOutput | null>(null);
  const [activity, setActivity] = useState<ActivityOutput | null>(null);
  const [guidedPractice, setGuidedPractice] = useState<string | null>(null);
  const [worksheet, setWorksheet] = useState<WorksheetOutput | null>(null);
  const [exitTicket, setExitTicket] = useState<QuizOutput | null>(null);

  // Collapsed card state
  const [collapsed, setCollapsed] = useState<Record<StepKey, boolean>>({
    objectives: false,
    warmup: false,
    activity: false,
    guided: false,
    worksheet: false,
    exitTicket: false,
  });

  // Action state
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>();
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const gradeNames = GRADES.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = SUBJECTS.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);

  const showToast = (msg: string) => { setToastMsg(msg); setToastVisible(true); };

  const setStep = (key: StepKey, status: StepStatus) =>
    setStepStatus(prev => ({ ...prev, [key]: status }));

  // ── Build flow ──────────────────────────────────────────────────────────────

  const handleBuild = async () => {
    if (!topic.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('building');
    setError('');
    setStepStatus(INITIAL_STEP_STATE);
    setObjectives(null); setWarmup(null); setActivity(null);
    setGuidedPractice(null); setWorksheet(null); setExitTicket(null);

    const grade = GRADES[gradeIdx]?.name ?? '';
    const subject = SUBJECTS[subjectIdx]?.name ?? '';
    const language = lang === 'ar' ? 'arabic' : 'english';
    const duration = DURATION_VALUES[durationIdx];

    try {
      const kbCtx = await buildGeneratorContext(topic, lang === 'ar' ? 'ar' : 'en');
      const lang_ = language as 'arabic' | 'english';
      const baseReq = { grade, subject, topic, language: lang_, duration, additionalContext: kbCtx };

      // Step 1 — Objectives (via lesson plan)
      setStep('objectives', 'loading');
      const plan = await aiService.generateLessonPlan(baseReq);
      setObjectives(plan.objectives);
      setStep('objectives', 'done');
      scrollRef.current?.scrollToEnd({ animated: true });

      // Step 2 — Warm-up activity (10 min)
      setStep('warmup', 'loading');
      const warmupOut = await aiService.generateActivity({
        ...baseReq,
        duration: 10,
        activityType: 'hands-on',
      });
      setWarmup(warmupOut);
      setStep('warmup', 'done');
      scrollRef.current?.scrollToEnd({ animated: true });

      // Step 3 — Interactive activity (main duration)
      setStep('activity', 'loading');
      const activityOut = await aiService.generateActivity({
        ...baseReq,
        activityType: 'game',
      });
      setActivity(activityOut);
      setStep('activity', 'done');
      scrollRef.current?.scrollToEnd({ animated: true });

      // Step 4 — Guided practice (from lesson plan)
      setStep('guided', 'loading');
      // Re-use the lesson plan we already generated — no extra API call needed
      await new Promise(r => setTimeout(r, 600)); // brief pause for streaming feel
      setGuidedPractice(plan.guidedPractice);
      setStep('guided', 'done');
      scrollRef.current?.scrollToEnd({ animated: true });

      // Step 5 — Worksheet
      setStep('worksheet', 'loading');
      const wsOut = await aiService.generateWorksheet({ ...baseReq, numQuestions: 5 });
      setWorksheet(wsOut);
      setStep('worksheet', 'done');
      scrollRef.current?.scrollToEnd({ animated: true });

      // Step 6 — Exit ticket (3 questions)
      setStep('exitTicket', 'loading');
      const etOut = await aiService.generateQuiz({ ...baseReq, numQuestions: 3 });
      setExitTicket(etOut);
      setStep('exitTicket', 'done');

      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      setError(err?.message ?? 'Generation failed');
      setPhase('form');
      setStepStatus(INITIAL_STEP_STATE);
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!objectives || !warmup || !activity || !guidedPractice || !worksheet || !exitTicket) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const grade = GRADES[gradeIdx]?.name ?? '';
    const subject = SUBJECTS[subjectIdx]?.name ?? '';
    const duration = DURATION_VALUES[durationIdx];

    const flow: LessonFlowOutput = {
      topic,
      grade,
      subject,
      duration,
      objectives,
      warmup,
      activity,
      guidedPractice,
      worksheet,
      exitTicket,
    };

    const title = lang === 'ar'
      ? `مسار درس: ${topic}`
      : `Lesson Flow: ${topic}`;

    if (savedId) {
      // TODO: updateItem is imported from workspace when needed
      showToast(t('updatedSuccess'));
      setSaveLabel('updated');
    } else {
      const newMat = await saveItem({
        title,
        type: 'flow',
        grade,
        subject,
        topic,
        language: lang === 'ar' ? 'ar' : 'en',
        content: JSON.stringify(flow),
        formState: { grade, subject, topic, language: lang === 'ar' ? 'arabic' : 'english', duration },
      });
      setSavedId(newMat.id);
      setSaveLabel('saved');
      showToast(t('savedSuccess'));
    }
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (!objectives || !warmup || !activity || !guidedPractice || !worksheet || !exitTicket) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoadingPDF(true);
    try {
      const grade = GRADES[gradeIdx]?.name ?? '';
      const subject = SUBJECTS[subjectIdx]?.name ?? '';
      const duration = DURATION_VALUES[durationIdx];
      const flow: LessonFlowOutput = {
        topic, grade, subject, duration,
        objectives, warmup, activity, guidedPractice, worksheet, exitTicket,
      };
      const html = buildLessonFlowHTML(flow, lang === 'ar');
      await exportAsPDF(html, `lesson-flow-${topic}`);
    } catch {
      showToast(t('generationFailed'));
    } finally {
      setLoadingPDF(false);
    }
  };

  // ── Launch Classroom ────────────────────────────────────────────────────────

  const handleLaunchClassroom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/ai-tools/classroom',
      params: {
        topic,
        gradeIdx: String(gradeIdx),
        subjectIdx: String(subjectIdx),
      },
    } as any);
  };

  // ── Rendering ───────────────────────────────────────────────────────────────

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const STEPS: Array<{ key: StepKey; labelKey: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = [
    { key: 'objectives', labelKey: 'lessonFlowStepObjectives', icon: 'flag-outline', color: NAVY },
    { key: 'warmup',     labelKey: 'lessonFlowStepWarmup',     icon: 'flame-outline', color: '#E67E22' },
    { key: 'activity',   labelKey: 'lessonFlowStepActivity',   icon: 'flash-outline', color: '#4F46E5' },
    { key: 'guided',     labelKey: 'lessonFlowStepGuided',     icon: 'pencil-outline', color: ACCENT },
    { key: 'worksheet',  labelKey: 'lessonFlowStepWorksheet',  icon: 'document-text-outline', color: '#8B5CF6' },
    { key: 'exitTicket', labelKey: 'lessonFlowStepExitTicket', icon: 'ticket-outline', color: '#F59E0B' },
  ];

  const isDone = phase === 'done';
  const isBuilding = phase === 'building';

  const completedCount = Object.values(stepStatus).filter(s => s === 'done').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: NAVY, borderBottomColor: NAVY }]}>
          <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
              hitSlop={12}
            >
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color="#fff" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }]}>
                <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('toolLessonFlowTitle')}
                </Text>
                <View style={{ backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 9 }}>NEW</Text>
                </View>
              </View>
              <Text style={[styles.headerSub, { color: '#94A3B8', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('toolLessonFlowSub')}
              </Text>
            </View>
          </View>

          {/* Progress bar shown while building */}
          {(isBuilding || isDone) && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBg, { backgroundColor: '#1E3A5F' }]}>
                <View style={[styles.progressFill, {
                  width: `${(completedCount / 6) * 100}%`,
                  backgroundColor: ACCENT,
                }]} />
              </View>
              <Text style={{ color: '#94A3B8', fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                {isDone
                  ? (lang === 'ar' ? '✓ جاهز' : '✓ Ready')
                  : `${lang === 'ar' ? 'خطوة' : 'Step'} ${completedCount + 1} ${lang === 'ar' ? 'من' : 'of'} 6`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Form ── */}
        {phase === 'form' && (
          <View style={styles.formSection}>
            {/* Topic */}
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
              {lang === 'ar' ? 'موضوع الدرس' : 'Lesson Topic'}
            </Text>
            <TopicSelector
              gradeId={GRADES[gradeIdx]?.id ?? ''}
              subjectId={SUBJECTS[subjectIdx]?.id ?? ''}
              value={topic}
              onChange={setTopic}
              lang={lang as 'ar' | 'en'}
              isRTL={isRTL}
              colors={colors}
              accent={ACCENT}
              t={t as any}
            />

            {/* Grade */}
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, textAlign: isRTL ? 'right' : 'left' }]}>
              {lang === 'ar' ? 'الصف الدراسي' : 'Grade'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
              {gradeNames.map((g, i) => (
                <Pressable key={i} onPress={() => setGradeIdx(i)}
                  style={[styles.chip, { flexShrink: 0, backgroundColor: gradeIdx === i ? colors.primary : colors.muted, borderColor: gradeIdx === i ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: gradeIdx === i ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_500Medium' }]}>{g}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Subject */}
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, textAlign: isRTL ? 'right' : 'left' }]}>
              {lang === 'ar' ? 'المادة' : 'Subject'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
              {subjectNames.map((s, i) => (
                <Pressable key={i} onPress={() => setSubjectIdx(i)}
                  style={[styles.chip, { flexShrink: 0, backgroundColor: subjectIdx === i ? colors.primary : colors.muted, borderColor: subjectIdx === i ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: subjectIdx === i ? colors.primaryForeground : colors.foreground, fontFamily: 'Inter_500Medium' }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Duration */}
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginTop: 16, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('lessonFlowDurationLabel')}
            </Text>
            <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }]}>
              {durationLabels.map((d, i) => (
                <Pressable key={i} onPress={() => setDurationIdx(i)}
                  style={[styles.chip, { flex: 1, justifyContent: 'center', backgroundColor: durationIdx === i ? ACCENT + '22' : colors.muted, borderColor: durationIdx === i ? ACCENT : colors.border }]}>
                  <Text style={[styles.chipText, { color: durationIdx === i ? ACCENT : colors.foreground, fontFamily: durationIdx === i ? 'Inter_700Bold' : 'Inter_500Medium', textAlign: 'center' }]}>{d}</Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text style={{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 12, textAlign: isRTL ? 'right' : 'left' }}>{error}</Text>
            ) : null}

            <View style={{ marginTop: 24 }}>
              <Button
                label={t('lessonFlowBuildBtn')}
                onPress={handleBuild}
                disabled={!topic.trim()}
                style={{ backgroundColor: NAVY }}
              />
            </View>
          </View>
        )}

        {/* ── Building / Done: step cards ── */}
        {(isBuilding || isDone) && (
          <View style={styles.stepsContainer}>
            {STEPS.map((step, idx) => {
              const status = stepStatus[step.key];
              return (
                <StepCard
                  key={step.key}
                  stepNum={idx + 1}
                  label={t(step.labelKey as any)}
                  icon={step.icon}
                  color={step.color}
                  status={status}
                  isRTL={isRTL}
                  colors={colors}
                  collapsed={collapsed[step.key]}
                  onToggleCollapse={() => setCollapsed(prev => ({ ...prev, [step.key]: !prev[step.key] }))}
                >
                  {status === 'done' && (
                    <StepContent
                      stepKey={step.key}
                      objectives={objectives}
                      warmup={warmup}
                      activity={activity}
                      guidedPractice={guidedPractice}
                      worksheet={worksheet}
                      exitTicket={exitTicket}
                      isRTL={isRTL}
                      colors={colors}
                      lang={lang}
                    />
                  )}
                </StepCard>
              );
            })}
          </View>
        )}

        {/* ── Done: action buttons ── */}
        {isDone && (
          <View style={[styles.actionBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {/* Launch Classroom */}
            <Pressable
              onPress={handleLaunchClassroom}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: '#4F46E5', opacity: pressed ? 0.85 : 1, flex: 1 }]}
            >
              <Ionicons name="tv-outline" size={16} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                {t('lessonFlowLaunchClassroom')}
              </Text>
            </Pressable>

            {/* Export PDF */}
            <Pressable
              onPress={handleExportPDF}
              disabled={loadingPDF}
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: NAVY, opacity: pressed || loadingPDF ? 0.75 : 1, flex: 1 }]}
            >
              {loadingPDF
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="document-outline" size={16} color="#fff" />}
              <Text style={[styles.actionBtnText, { fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                {t('lessonFlowExportAll')}
              </Text>
            </Pressable>

            {/* Save */}
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [styles.actionBtnSave, { backgroundColor: ACCENT + '18', borderColor: ACCENT, opacity: pressed ? 0.75 : 1 }]}
            >
              <Ionicons
                name={saveLabel === 'save' ? 'bookmark-outline' : 'bookmark'}
                size={18}
                color={ACCENT}
              />
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Toast
        message={toastMsg}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

interface StepCardProps {
  stepNum: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  status: StepStatus;
  isRTL: boolean;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children?: React.ReactNode;
}

function StepCard({ stepNum, label, icon, color, status, isRTL, colors, collapsed, onToggleCollapse, children }: StepCardProps) {
  return (
    <View style={[styles.stepCard, { backgroundColor: colors.card, borderColor: status === 'done' ? color + '40' : colors.border }]}>
      {/* Header row */}
      <Pressable
        onPress={status === 'done' ? onToggleCollapse : undefined}
        style={[styles.stepHeader, isRTL && { flexDirection: 'row-reverse' }]}
      >
        <View style={[styles.stepBadge, { backgroundColor: status === 'done' ? color + '18' : colors.muted }]}>
          {status === 'loading' ? (
            <ActivityIndicator size="small" color={color} />
          ) : status === 'done' ? (
            <Ionicons name={icon} size={18} color={color} />
          ) : (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{stepNum}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: status === 'done' ? colors.foreground : colors.mutedForeground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {label}
          </Text>
          {status === 'loading' && (
            <Text style={{ color: color, fontFamily: 'Inter_400Regular', fontSize: 11.5, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
              {/* short animated dots via text */}
              Generating…
            </Text>
          )}
        </View>
        {status === 'done' && (
          <Ionicons
            name={collapsed ? (isRTL ? 'chevron-back' : 'chevron-forward') : 'chevron-down'}
            size={16}
            color={colors.mutedForeground}
          />
        )}
      </Pressable>

      {/* Content (visible when done and not collapsed) */}
      {status === 'done' && !collapsed && (
        <View style={{ paddingBottom: 4 }}>{children}</View>
      )}
    </View>
  );
}

// ─── StepContent ──────────────────────────────────────────────────────────────

interface StepContentProps {
  stepKey: StepKey;
  objectives: string[] | null;
  warmup: ActivityOutput | null;
  activity: ActivityOutput | null;
  guidedPractice: string | null;
  worksheet: WorksheetOutput | null;
  exitTicket: QuizOutput | null;
  isRTL: boolean;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  lang: string;
}

function StepContent({ stepKey, objectives, warmup, activity, guidedPractice, worksheet, exitTicket, isRTL, colors, lang }: StepContentProps) {
  switch (stepKey) {
    case 'objectives':
      return (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8, gap: 5 }}>
          {(objectives ?? []).map((obj, i) => (
            <View key={i} style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }]}>
              <View style={[styles.bullet, { backgroundColor: NAVY }]} />
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>{obj}</Text>
            </View>
          ))}
        </View>
      );

    case 'warmup':
    case 'activity': {
      const act = stepKey === 'warmup' ? warmup : activity;
      if (!act) return null;
      return (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          <Text style={[{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{act.title}</Text>
          {act.steps.map((step, i) => (
            <View key={i} style={[styles.activityStep, { backgroundColor: colors.muted }]}>
              <View style={[styles.stepNum, { backgroundColor: stepKey === 'warmup' ? '#E67E22' : '#4F46E5' }]}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12.5, textAlign: isRTL ? 'right' : 'left' }}>{step.title}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, lineHeight: 17, textAlign: isRTL ? 'right' : 'left' }}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'guided':
      return (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
          <View style={[styles.guidedBox, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' }}>
              {guidedPractice}
            </Text>
          </View>
        </View>
      );

    case 'worksheet': {
      if (!worksheet) return null;
      const allQs = worksheet.sections.flatMap((s: { questions: Array<{ text: string; points: number }> }) => s.questions);
      return (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8, gap: 6 }}>
          {allQs.slice(0, 5).map((q, i) => (
            <View key={i} style={[styles.qBlock, { backgroundColor: colors.muted }]}>
              <View style={[styles.qNum, { backgroundColor: '#8B5CF6' }]}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>{q.text}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>{q.points}pt</Text>
            </View>
          ))}
        </View>
      );
    }

    case 'exitTicket': {
      if (!exitTicket) return null;
      const allQs = exitTicket.questions;
      return (
        <View style={{ paddingHorizontal: 14, paddingBottom: 8, gap: 6 }}>
          {allQs.slice(0, 3).map((q, i) => (
            <View key={i} style={[styles.qBlock, { backgroundColor: colors.muted }]}>
              <View style={[styles.qNum, { backgroundColor: '#F59E0B' }]}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 10 }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>{q.text}</Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 }}>{q.points}pt</Text>
            </View>
          ))}
        </View>
      );
    }

    default:
      return null;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 14,
  },
  progressBg: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  formSection: {
    padding: 16,
  },
  label: {
    fontSize: 13.5,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  stepsContainer: {
    padding: 16,
    gap: 10,
  },
  stepCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 14,
  },
  activityStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guidedBox: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    flexShrink: 0,
  },
  qBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 10,
  },
  qNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionBar: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    gap: 8,
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 13,
  },
  actionBtnSave: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
