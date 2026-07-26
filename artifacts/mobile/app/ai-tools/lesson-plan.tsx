import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { aiService } from '@/services/ai/generators';
import { LessonPlanOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';

const GRADE_NAMES = GRADES.map(g => g.name);
const SUBJECT_NAMES = SUBJECTS.map(s => s.name);

export default function LessonPlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topic: initialTopic } = useLocalSearchParams<{ topic?: string }>();

  const [grade, setGrade] = useState('Grade 10');
  const [subject, setSubject] = useState('Mathematics');
  const [topic, setTopic] = useState(initialTopic ?? '');
  const [duration, setDuration] = useState('45');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LessonPlanOutput | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateLessonPlan({
        grade, subject, topic: topic.trim(), duration: parseInt(duration) || 45, language: 'english',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(out);
    } catch {
      setError('Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: '#1B6B62', paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerBadge}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <Text style={[styles.headerBadgeText, { color: '#fff', fontFamily: 'Inter_500Medium' }]}>AI Lesson Plan</Text>
        </View>
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>Generate Lesson Plan</Text>
      </View>

      <View style={styles.form}>
        <PickerField label="Grade" value={grade} options={GRADE_NAMES} onChange={setGrade} colors={colors} />
        <PickerField label="Subject" value={subject} options={SUBJECT_NAMES} onChange={setSubject} colors={colors} />

        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Topic / Lesson title</Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: error && !topic ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="e.g. Quadratic Equations, Photosynthesis..."
            placeholderTextColor={colors.mutedForeground}
            value={topic}
            onChangeText={t => { setTopic(t); setError(''); }}
            multiline
          />
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', marginTop: 4 }]}>Duration (minutes)</Text>
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        {error ? <Text style={[{ color: colors.destructive, fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 8 }]}>{error}</Text> : null}
        <Button label={loading ? 'Generating…' : 'Generate Lesson Plan'} onPress={generate} loading={loading} fullWidth />
      </View>

      {loading && (
        <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20 }]}>
          <ActivityIndicator color="#1B6B62" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
            Crafting your lesson plan…
          </Text>
        </View>
      )}

      {result && <LessonPlanResult plan={result} colors={colors} />}
    </ScrollView>
  );
}

function LessonPlanResult({ plan, colors }: { plan: LessonPlanOutput; colors: any }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
      <View style={[styles.resultHeader, { backgroundColor: '#1B6B62' + '15', borderColor: '#1B6B62' + '30', borderRadius: colors.radius }]}>
        <Ionicons name="checkmark-circle" size={20} color="#1B6B62" />
        <Text style={[styles.resultHeaderText, { color: '#1B6B62', fontFamily: 'Inter_600SemiBold' }]}>
          Lesson plan generated successfully
        </Text>
      </View>

      <ResultSection title="Objectives" icon="flag-outline">
        {plan.objectives.map((o, i) => <BulletItem key={i} text={o} colors={colors} />)}
      </ResultSection>
      <ResultSection title="Materials Needed" icon="bag-outline">
        {plan.materials.map((m, i) => <BulletItem key={i} text={m} colors={colors} />)}
      </ResultSection>
      <ResultSection title="Introduction" icon="play-outline">
        <BodyText text={plan.introduction} colors={colors} />
      </ResultSection>
      <ResultSection title="Main Activity" icon="people-outline">
        <BodyText text={plan.mainActivity} colors={colors} />
      </ResultSection>
      <ResultSection title="Closure" icon="stop-circle-outline">
        <BodyText text={plan.closure} colors={colors} />
      </ResultSection>
      <ResultSection title="Assessment" icon="checkmark-done-outline">
        <BodyText text={plan.assessment} colors={colors} />
      </ResultSection>
      <ResultSection title="Differentiation" icon="layers-outline">
        <BodyText text={plan.differentiation} colors={colors} />
      </ResultSection>
      <ResultSection title="Homework" icon="home-outline">
        <BodyText text={plan.homework} colors={colors} />
      </ResultSection>
    </View>
  );
}

function ResultSection({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.resultSectionHeader}>
        <Ionicons name={icon} size={15} color="#1B6B62" />
        <Text style={[styles.resultSectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{title}</Text>
      </View>
      <View style={[styles.resultSectionBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        {children}
      </View>
    </View>
  );
}

function BulletItem({ text, colors }: { text: string; colors: any }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: '#1B6B62' }]} />
      <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{text}</Text>
    </View>
  );
}

function BodyText({ text, colors }: { text: string; colors: any }) {
  return <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{text}</Text>;
}

function PickerField({ label, value, options, onChange, colors }: { label: string; value: string; options: string[]; onChange: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      >
        <Text style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, flex: 1 }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map(o => (
              <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }}
                style={[styles.pickerOption, { borderBottomColor: colors.border, backgroundColor: o === value ? colors.secondary : 'transparent' }]}>
                <Text style={[{ color: o === value ? colors.primary : colors.foreground, fontFamily: o === value ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14 }]}>{o}</Text>
                {o === value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
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
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  headerBadgeText: { fontSize: 13 },
  headerTitle: { fontSize: 24 },
  form: { padding: 20, paddingBottom: 8 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  inputBox: { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  textInput: { fontSize: 15, padding: 0, minHeight: 44 },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pickerDropdown: { borderWidth: 1, marginTop: -8, marginBottom: 8, overflow: 'hidden' },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  loadingText: { fontSize: 14 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderWidth: 1, marginBottom: 20 },
  resultHeaderText: { fontSize: 14 },
  resultSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  resultSectionTitle: { fontSize: 14 },
  resultSectionBody: { padding: 14, borderWidth: 1 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 20 },
  bodyText: { fontSize: 13, lineHeight: 20 },
});
