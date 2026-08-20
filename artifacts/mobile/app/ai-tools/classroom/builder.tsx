import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { TopicSelector } from '@/components/ui/TopicSelector';
import { Button } from '@/components/ui/Button';
import {
  getPickerGrades, getPickerSubjects, resolvePickerIndex,
} from '@/services/curriculumData';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { ClassroomActivity } from '@/services/ai/AIService';
import { buildGeneratorContext } from '@/services/kbContext';
import { setPendingClassroomActivity } from '@/services/classroomStore';
import { ACTIVITY_CARDS, resolveActivityType } from '@/services/classroomRouting';

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
    setError(''); setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const additionalContext = buildGeneratorContext(topic.trim(), lang as 'ar' | 'en') || undefined;
      const out = await aiService.generateClassroomActivity({
        grade: grades[gradeIdx].name,
        subject: subjects[subjectIdx].name,
        topic: topic.trim(),
        activityType: resolveActivityType(params),
        duration: DURATIONS[durationIdx],
        difficulty,
        groupType,
        teachingGoal,
        language: lang === 'ar' ? 'arabic' : 'english',
        additionalContext,
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

  const PillGroup = <T extends string>({
    label, options, value, onChange,
  }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[styles.pill, {
                backgroundColor: active ? ACCENT : colors.card,
                borderColor: active ? ACCENT : colors.border,
                borderRadius: colors.radius,
              }]}
            >
              <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular' }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

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
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('grade')}</Text>
          <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {grades.map((g, idx) => {
              const active = gradeIdx === idx;
              const label = lang === 'ar' ? g.nameAr : g.name;
              return (
                <Pressable key={g.id} onPress={() => setGradeIdx(idx)} style={[styles.pill, { backgroundColor: active ? ACCENT : colors.card, borderColor: active ? ACCENT : colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular' }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Subject */}
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('subjects')}</Text>
          <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {subjects.map((s, i) => {
              const active = subjectIdx === i;
              return (
                <Pressable key={s.id} onPress={() => setSubjectIdx(i)} style={[styles.pill, { backgroundColor: active ? ACCENT : colors.card, borderColor: active ? ACCENT : colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular' }]}>
                    {lang === 'ar' ? s.nameAr : s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

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
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('durationLabel')}</Text>
          <View style={[styles.pillRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {DURATIONS.map((d, i) => {
              const active = durationIdx === i;
              return (
                <Pressable key={d} onPress={() => setDurationIdx(i)} style={[styles.pill, { backgroundColor: active ? ACCENT : colors.card, borderColor: active ? ACCENT : colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.pillText, { color: active ? '#fff' : colors.mutedForeground, fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular' }]}>
                    {d} {t('min')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <PillGroup label={t('difficultyLabel')} options={difficultyOpts} value={difficulty} onChange={setDifficulty} />
        <PillGroup label={lang === 'ar' ? 'نوع المجموعة' : 'Class type'} options={groupOpts} value={groupType} onChange={setGroupType} />
        <PillGroup label={t('teachingGoalLabel')} options={goalOpts} value={teachingGoal} onChange={setTeachingGoal} />

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
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  pillRow: { flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5 },
  pillText: { fontSize: 13 },
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
