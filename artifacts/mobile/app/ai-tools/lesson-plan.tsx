import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { aiService } from '@/services/ai/generators';
import { LessonPlanOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';
import { getItem, saveItem, updateItem } from '@/services/workspace';

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
  }>();
  const scrollRef = useRef<ScrollView>(null);

  const gradeNames = GRADES.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = SUBJECTS.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_VALUES.map(d => `${d} ${t('min')}`);
  const styleLabels = [t('teachingStyleDirect'), t('teachingStyleInquiry'), t('teachingStyleCollaborative')];

  const [gradeIdx, setGradeIdx] = useState(params.gradeIdx ? parseInt(params.gradeIdx, 10) : 9);
  const [subjectIdx, setSubjectIdx] = useState(params.subjectIdx ? parseInt(params.subjectIdx, 10) : 2);
  const [topic, setTopic] = useState(params.topic ?? '');
  const [objectives, setObjectives] = useState(params.objectives ?? '');
  const [durationIdx, setDurationIdx] = useState(params.durationIdx ? parseInt(params.durationIdx, 10) : 1);
  const [styleIdx, setStyleIdx] = useState(params.styleIdx ? parseInt(params.styleIdx, 10) : 0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LessonPlanOutput | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>(params.savedId);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved' | 'updated'>('save');

  // If editing a saved item, load it and restore its result
  useEffect(() => {
    if (params.savedId) {
      getItem(params.savedId).then(item => {
        if (item) {
          try {
            const parsed = JSON.parse(item.content) as LessonPlanOutput;
            setResult(parsed);
          } catch { /* noop */ }
        }
      });
    }
  }, [params.savedId]);

  // Reset save label when result changes (new generation)
  useEffect(() => {
    if (result) setSaveLabel(savedId ? 'updated' : 'save');
  }, [result]);

  const generate = async () => {
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    setError('');
    setLoading(true);
    setResult(null);
    setSaveLabel('save');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateLessonPlan({
        grade: GRADES[gradeIdx].name,
        subject: SUBJECTS[subjectIdx].name,
        topic: topic.trim(),
        duration: DURATION_VALUES[durationIdx],
        language: lang === 'ar' ? 'arabic' : 'english',
        teachingStyle: STYLE_IDS[styleIdx],
        objectives: objectives.trim() || undefined,
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

  const handleSave = async () => {
    if (!result) return;
    const title = lang === 'ar'
      ? `خطة درس: ${topic.trim()}`
      : `Lesson Plan: ${topic.trim()}`;
    const formState = { gradeIdx, subjectIdx, topic: topic.trim(), durationIdx, styleIdx, objectives };

    if (savedId) {
      await updateItem(savedId, {
        title,
        subject: SUBJECTS[subjectIdx].name,
        grade: GRADES[gradeIdx].name,
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
        subject: SUBJECTS[subjectIdx].name,
        grade: GRADES[gradeIdx].name,
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

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const saveBtnLabel =
    saveLabel === 'saved' ? t('savedSuccess')
      : saveLabel === 'updated' ? t('updatedSuccess')
        : savedId ? t('updateInWorkspace')
          : t('saveToWorkspace');

  return (
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
          <Text style={[styles.headerBadgeText, { color: '#fff', fontFamily: 'Inter_500Medium' }]}>{t('aiLessonPlanBadge')}</Text>
        </View>
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('generateLessonPlanTitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Topic */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('topicLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: error && !topic ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('topicPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={topic}
            onChangeText={text => { setTopic(text); setError(''); }}
            multiline
          />
        </View>

        {/* Objectives (optional) */}
        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('objectivesLabel')}
        </Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left', minHeight: 60 }]}
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

        {error ? <Text style={[{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
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
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            {t('craftingLessonPlan')}
          </Text>
        </View>
      )}

      {/* Result */}
      {result && <LessonPlanResult plan={result} colors={colors} isRTL={isRTL} t={t} />}

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
              { color: (saveLabel === 'saved' || saveLabel === 'updated') ? '#fff' : ACCENT, fontFamily: 'Inter_600SemiBold' },
            ]}>
              {saveBtnLabel}
            </Text>
          </Pressable>
          {/* Regenerate */}
          <Pressable
            onPress={generate}
            style={[styles.regenBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="refresh-outline" size={16} color={ACCENT} />
            <Text style={[styles.regenText, { color: ACCENT, fontFamily: 'Inter_600SemiBold' }]}>{t('regenerateBtn')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function LessonPlanResult({ plan, colors, isRTL, t }: {
  plan: LessonPlanOutput;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: (k: any, ...a: any[]) => string;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <View style={[styles.resultHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="checkmark-circle" size={20} color={ACCENT} />
        <Text style={[styles.resultHeaderText, { color: ACCENT, fontFamily: 'Inter_600SemiBold' }]}>
          {t('lessonPlanReady')}
        </Text>
      </View>

      <ResultSection title={t('sectionObjectives')} icon="flag-outline" isRTL={isRTL}>
        {plan.objectives.map((o, i) => <BulletItem key={i} text={o} colors={colors} isRTL={isRTL} />)}
      </ResultSection>
      <ResultSection title={t('sectionMaterials')} icon="bag-outline" isRTL={isRTL}>
        {plan.materials.map((m, i) => <BulletItem key={i} text={m} colors={colors} isRTL={isRTL} />)}
      </ResultSection>
      <ResultSection title={t('sectionIntroduction')} icon="play-outline" isRTL={isRTL}>
        <BodyText text={plan.introduction} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionMainActivity')} icon="people-outline" isRTL={isRTL}>
        <BodyText text={plan.mainActivity} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionGuidedPractice')} icon="hand-left-outline" isRTL={isRTL}>
        <BodyText text={plan.guidedPractice} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionIndependentPractice')} icon="person-outline" isRTL={isRTL}>
        <BodyText text={plan.independentPractice} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionClosure')} icon="stop-circle-outline" isRTL={isRTL}>
        <BodyText text={plan.closure} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionAssessment')} icon="checkmark-done-outline" isRTL={isRTL}>
        <BodyText text={plan.assessment} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionDifferentiation')} icon="layers-outline" isRTL={isRTL}>
        <BodyText text={plan.differentiation} colors={colors} isRTL={isRTL} />
      </ResultSection>
      <ResultSection title={t('sectionHomework')} icon="home-outline" isRTL={isRTL}>
        <BodyText text={plan.homework} colors={colors} isRTL={isRTL} />
      </ResultSection>
    </View>
  );
}

function ResultSection({ title, icon, isRTL, children }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; isRTL: boolean; children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.resultSectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={15} color={ACCENT} />
        <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
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
      <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>
    </View>
  );
}

function BodyText({ text, colors, isRTL }: { text: string; colors: ReturnType<typeof useColors>; isRTL: boolean }) {
  return <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{text}</Text>;
}

function PickerField({ label, value, options, onChange, colors, isRTL, accent }: {
  label: string; value: string; options: string[]; onChange: (i: number) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Text style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
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
                <Text style={[{ color: o === value ? accent : colors.foreground, fontFamily: o === value ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{o}</Text>
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
