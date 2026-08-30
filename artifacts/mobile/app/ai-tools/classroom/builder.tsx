import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { PillSelector } from '@/components/ui/PillSelector';
import { Button } from '@/components/ui/Button';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { ClassroomActivity } from '@/services/ai/AIService';
import { buildGeneratorContext, generatorUnitId } from '@/services/kbContext';
import { groundedSubjectConflict } from '@/services/lessonPrep';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { ACTIVITY_CARDS, ClassroomSetup, resolveActivityType } from '@/services/classroomRouting';

const ACCENT = '#4F46E5';

type Difficulty = 'easy' | 'standard' | 'advanced';
type GroupType = 'individual' | 'pairs' | 'groups' | 'whole-class';
type TeachingGoal = 'warm-up' | 'practice' | 'revision' | 'assessment' | 'critical-thinking';

const DURATIONS = [10, 20, 30];

export default function ClassroomBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const params = useLocalSearchParams<{ activityType?: string }>();
  // Header reflects the card the teacher picked (falls back to escape-challenge).
  const selectedCard = ACTIVITY_CARDS.find(c => c.id === resolveActivityType(params));
  const scrollRef = useRef<ScrollView>(null);
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const grades = getPickerGrades();
  const subjects = getPickerSubjects();

  const [gradeIdx, setGradeIdx] = useState(() => resolvePickerIndex(undefined, grades.length));
  const [subjectIdx, setSubjectIdx] = useState(() => resolvePickerIndex(undefined, subjects.length));
  const [topic, setTopic] = useState('');
  const [durationIdx, setDurationIdx] = useState(1); // 20 min default
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [groupType, setGroupType] = useState<GroupType>('groups');
  const [teachingGoal, setTeachingGoal] = useState<TeachingGoal>('practice');
  // Defaults to the projector because that is what the app's own deck assumes;
  // a board-only room is the choice that changes what gets printed.
  const [classroomSetup, setClassroomSetup] = useState<ClassroomSetup>('screen');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassroomActivity | null>(null);
  const [error, setError] = useState('');

  const prevGradeRef = useRef(gradeIdx);
  const prevSubjectRef = useRef(subjectIdx);
  useEffect(() => {
    if (prevGradeRef.current !== gradeIdx || prevSubjectRef.current !== subjectIdx) {
      setTopic('');
      prevGradeRef.current = gradeIdx;
      prevSubjectRef.current = subjectIdx;
    }
  }, [gradeIdx, subjectIdx]);

  const generate = async () => {
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    // A topic that grounds to another subject's lesson cannot make an honest
    // activity — the KB serves that lesson's own content while the header
    // claims the picked subject. Refuse and name the real subject instead.
    const conflict = groundedSubjectConflict(topic.trim(), lang as 'ar' | 'en', subjects[subjectIdx].id);
    if (conflict) { setError(t('subjectTopicMismatch', lang === 'ar' ? conflict.nameAr : conflict.name)); return; }
    setError(''); setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const additionalContext = buildGeneratorContext(topic.trim(), lang as 'ar' | 'en');
      const out = await aiService.generateClassroomActivity({
        grade: grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        activityType: resolveActivityType(params),
        duration: DURATIONS[durationIdx],
        difficulty,
        groupType,
        teachingGoal,
        classroomSetup,
        language: lang === 'ar' ? 'arabic' : 'english',
        additionalContext,
        unitId: generatorUnitId(topic.trim(), lang as 'ar' | 'en'),
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

  const handleStartPresentation = () => {
    if (!result) return;
    setPendingClassroomActivity(result);
    router.push('/ai-tools/classroom/presentation' as any);
  };

  const difficultyOpts: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: t('difficultyEasy') },
    { value: 'standard', label: lang === 'ar' ? 'متوسط' : 'Standard' },
    { value: 'advanced', label: lang === 'ar' ? 'متقدم' : 'Advanced' },
  ];
  const groupOpts: { value: GroupType; label: string }[] = [
    { value: 'individual', label: t('activityTypeIndividual') },
    { value: 'pairs', label: lang === 'ar' ? 'ثنائي' : 'Pairs' },
    { value: 'groups', label: lang === 'ar' ? 'مجموعات' : 'Groups' },
    { value: 'whole-class', label: lang === 'ar' ? 'الصف' : 'Whole Class' },
  ];
  const setupOpts: { value: ClassroomSetup; label: string }[] = [
    { value: 'screen', label: lang === 'ar' ? 'شاشة عرض' : 'Projector' },
    { value: 'board', label: lang === 'ar' ? 'سبورة فقط' : 'Board only' },
  ];
  const goalOpts: { value: TeachingGoal; label: string }[] = [
    { value: 'warm-up', label: t('teachingGoalWarmup') },
    { value: 'practice', label: t('teachingGoalPractice') },
    { value: 'revision', label: t('teachingGoalRevision') },
    { value: 'assessment', label: t('teachingGoalAssessment') },
    { value: 'critical-thinking', label: t('teachingGoalCritical') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 6 }]}>
          <Text style={{ fontSize: 22 }}>{selectedCard?.emoji ?? '🔐'}</Text>
          <Text style={[{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }]}>
            {selectedCard ? t(selectedCard.titleKey as any) : t('classroomBuilderSubtitle')}
          </Text>
        </View>
        <Text style={[{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('classroomBuilderTitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Grade */}
        <PillSelector
          label={t('grade')}
          options={grades.map((g, idx) => ({ value: idx, label: lang === 'ar' ? g.nameAr : g.name }))}
          value={gradeIdx}
          onChange={setGradeIdx}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />

        {/* Subject */}
        <PillSelector
          label={t('subjects')}
          options={subjects.map((s, i) => ({ value: i, label: lang === 'ar' ? s.nameAr : s.name }))}
          value={subjectIdx}
          onChange={setSubjectIdx}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />

        {/* Topic */}
        <TopicSelector
          subjectId={subjects[subjectIdx].id}
          gradeId={grades[gradeIdx].id}
          value={topic}
          onChange={v => { setTopic(v); setError(''); }}
          lang={lang as 'ar' | 'en'}
          isRTL={isRTL}
          colors={colors}
          accent={ACCENT}
          hasError={!!error && !topic}
          t={t}
        />

        {/* Duration */}
        <PillSelector
          label={t('durationLabel')}
          options={DURATIONS.map((d, i) => ({ value: i, label: `${d} ${t('min')}` }))}
          value={durationIdx}
          onChange={setDurationIdx}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />

        <PillSelector label={t('difficultyLabel')} options={difficultyOpts} value={difficulty} onChange={setDifficulty} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PillSelector label={lang === 'ar' ? 'نوع المجموعة' : 'Class type'} options={groupOpts} value={groupType} onChange={setGroupType} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PillSelector label={t('teachingGoalLabel')} options={goalOpts} value={teachingGoal} onChange={setTeachingGoal} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PillSelector
          label={lang === 'ar' ? 'تجهيزات الصف' : 'Classroom setup'}
          options={setupOpts}
          value={classroomSetup}
          onChange={setClassroomSetup}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />

        {error ? <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}

        <Button
          label={loading ? t('generatingClassroom') : t('generateClassroomBtn')}
          onPress={generate}
          loading={loading}
          fullWidth
        />
      </View>

      {/* Loading */}
      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
            {t('generatingClassroom')}
          </Text>
        </View>
      )}

      {/* Preview */}
      {result && !loading && (
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          {/* Ready banner */}
          <View style={[styles.readyBanner, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
            <Text style={[styles.readyText, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>{t('classroomReady')}</Text>
          </View>

          {/* Activity overview */}
          <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.previewTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {result.activityName}
            </Text>
            <Text style={[styles.previewObj, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {result.learningObjective}
            </Text>

            {/* Stats row */}
            <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: colors.border }]}>
              <StatItem icon="layers-outline" label={t('slideCount', result.slides.length)} accent={ACCENT} />
              <StatItem icon="time-outline" label={`${result.duration} ${t('min')}`} accent={ACCENT} />
              <StatItem icon="people-outline" label={result.groupType} accent={ACCENT} />
            </View>
          </View>

          {/* Materials */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: ACCENT, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
              {lang === 'ar' ? 'المواد اللازمة' : 'Materials'}
            </Text>
            {result.materials.map((m, i) => (
              <View key={i} style={[styles.bullet, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={[styles.dot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{m}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleStartPresentation}
            style={({ pressed }) => [styles.ctaBtn, { backgroundColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: pressed ? 0.88 : 1 }]}
          >
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={[styles.ctaText, { fontFamily: 'Cairo_700Bold' }]}>{t('startPresentation')}</Text>
          </Pressable>

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
    </View>
  );
}

function StatItem({ icon, label, accent }: { icon: keyof typeof Ionicons.glyphMap; label: string; accent: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={accent} />
      <Text style={{ fontSize: 12, color: accent, fontFamily: 'Cairo_500Medium' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  form: { padding: 20 },
  loadingBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  loadingText: { fontSize: 14 },
  readyBanner: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 14 },
  readyText: { fontSize: 14 },
  previewCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 17, marginBottom: 6 },
  previewObj: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  statsRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', gap: 16 },
  sectionCard: { borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  bullet: { gap: 8, marginBottom: 5, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  ctaBtn: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 10 },
  ctaText: { color: '#fff', fontSize: 16 },
  regenBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5 },
  regenText: { fontSize: 14 },
});
