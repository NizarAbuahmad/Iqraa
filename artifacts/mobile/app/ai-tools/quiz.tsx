import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { aiService } from '@/services/ai/generators';
import { QuizOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';

const GRADE_NAMES = GRADES.map(g => g.name);
const SUBJECT_NAMES = SUBJECTS.map(s => s.name);

const TYPE_LABEL: Record<string, string> = { multiple_choice: 'Multiple Choice', true_false: 'True / False', short_answer: 'Short Answer' };
const TYPE_COLOR: Record<string, string> = { multiple_choice: '#F59E0B', true_false: '#3B82F6', short_answer: '#10B981' };

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [grade, setGrade] = useState('Grade 10');
  const [subject, setSubject] = useState('Mathematics');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizOutput | null>(null);
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);

  const generate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return; }
    setError(''); setLoading(true); setResult(null); setShowAnswers(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateQuiz({ grade, subject, topic: topic.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(out);
    } catch { setError('Generation failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: '#F59E0B', paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>Create Quiz</Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' }]}>Auto-graded questions</Text>
      </View>

      <View style={{ padding: 20 }}>
        <PickerRow label="Grade" value={grade} options={GRADE_NAMES} onChange={setGrade} accentColor="#F59E0B" colors={colors} />
        <PickerRow label="Subject" value={subject} options={SUBJECT_NAMES} onChange={setSubject} accentColor="#F59E0B" colors={colors} />
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Topic</Text>
        <View style={[styles.input, { backgroundColor: colors.card, borderColor: error && !topic ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
          <TextInput style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }]} placeholder="e.g. Quadratic Formula, Fractions…" placeholderTextColor={colors.mutedForeground} value={topic} onChangeText={t => { setTopic(t); setError(''); }} multiline />
        </View>
        {error ? <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8 }]}>{error}</Text> : null}
        <Button label={loading ? 'Generating…' : 'Generate Quiz'} onPress={generate} loading={loading} fullWidth style={{ backgroundColor: '#F59E0B' }} />
      </View>

      {loading && (
        <View style={[styles.loadBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20 }]}>
          <ActivityIndicator color="#F59E0B" />
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }]}>Generating quiz questions…</Text>
        </View>
      )}

      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          {/* Quiz header */}
          <View style={[styles.quizHeader, { backgroundColor: '#F59E0B' + '15', borderColor: '#F59E0B' + '40', borderRadius: colors.radius }]}>
            <Text style={[styles.quizTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>{result.title}</Text>
            <View style={styles.quizMeta}>
              <MetaPill icon="time-outline" text={`${result.duration} min`} color="#F59E0B" />
              <MetaPill icon="star-outline" text={`${result.totalPoints} pts`} color="#F59E0B" />
              <MetaPill icon="help-circle-outline" text={`${result.questions.length} Qs`} color="#F59E0B" />
            </View>
          </View>

          <Pressable onPress={() => setShowAnswers(v => !v)} style={[styles.toggleBtn, { borderColor: '#F59E0B', borderRadius: colors.radius }]}>
            <Ionicons name={showAnswers ? 'eye-off-outline' : 'eye-outline'} size={16} color="#F59E0B" />
            <Text style={[{ color: '#F59E0B', fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
              {showAnswers ? 'Hide Answers' : 'Show Answers'}
            </Text>
          </Pressable>

          {result.questions.map((q, i) => {
            const tc = TYPE_COLOR[q.type] ?? '#F59E0B';
            return (
              <View key={q.id} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.qTop}>
                  <View style={[styles.qNumCircle, { backgroundColor: '#F59E0B' }]}>
                    <Text style={[{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 }]}>{i + 1}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[{ color: tc, fontFamily: 'Inter_500Medium', fontSize: 11 }]}>{TYPE_LABEL[q.type]}</Text>
                  </View>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginLeft: 'auto' }]}>{q.points} pts</Text>
                </View>
                <Text style={[styles.qText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>{q.text}</Text>
                {q.options && q.options.map((opt, oi) => {
                  const isCorrect = showAnswers && opt === q.correctAnswer;
                  return (
                    <View key={oi} style={[styles.optRow, { backgroundColor: isCorrect ? '#10B981' + '15' : colors.muted, borderRadius: 8 }]}>
                      <Text style={[styles.optLabel, { color: isCorrect ? '#10B981' : colors.mutedForeground, fontFamily: isCorrect ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {String.fromCharCode(65 + oi)}.
                      </Text>
                      <Text style={[{ flex: 1, color: isCorrect ? '#10B981' : colors.foreground, fontFamily: isCorrect ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 13 }]}>{opt}</Text>
                      {isCorrect && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                    </View>
                  );
                })}
                {showAnswers && q.type === 'true_false' && (
                  <View style={[styles.ansBox, { backgroundColor: '#10B981' + '15', borderRadius: 8 }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[{ color: '#10B981', fontFamily: 'Inter_500Medium', fontSize: 13 }]}>Answer: {q.correctAnswer}</Text>
                  </View>
                )}
                {showAnswers && (
                  <View style={[styles.expBox, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                    <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }]}>
                      💡 {q.explanation}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function MetaPill({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color + '18', borderRadius: 20 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color, fontFamily: 'Inter_500Medium', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function PickerRow({ label, value, options, onChange, accentColor, colors }: { label: string; value: string; options: string[]; onChange: (v: string) => void; accentColor: string; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      <Pressable onPress={() => setOpen(o => !o)} style={[styles.input, { backgroundColor: colors.card, borderColor: open ? accentColor : colors.border, borderRadius: colors.radius, flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={[{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card, marginTop: -8, marginBottom: 8, maxHeight: 180, overflow: 'hidden' }]}>
          <ScrollView nestedScrollEnabled>
            {options.map(o => (
              <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={[{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: o === value ? accentColor + '15' : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={[{ color: o === value ? accentColor : colors.foreground, fontFamily: o === value ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14 }]}>{o}</Text>
                {o === value && <Ionicons name="checkmark" size={16} color={accentColor} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerTitle: { fontSize: 26 },
  headerSub: { fontSize: 13, marginTop: 4 },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  loadBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  quizHeader: { padding: 16, borderWidth: 1, marginBottom: 16 },
  quizTitle: { fontSize: 16, marginBottom: 10 },
  quizMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16, alignSelf: 'flex-start' },
  qCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  qTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qNumCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  qText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 6 },
  optLabel: { fontSize: 13, width: 20 },
  ansBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, marginTop: 8 },
  expBox: { padding: 10, marginTop: 8 },
});
