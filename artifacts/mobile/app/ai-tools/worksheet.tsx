import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { aiService } from '@/services/ai/generators';
import { WorksheetOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';

const GRADE_NAMES = GRADES.map(g => g.name);
const SUBJECT_NAMES = SUBJECTS.map(s => s.name);

export default function WorksheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [grade, setGrade] = useState('Grade 8');
  const [subject, setSubject] = useState('Science');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorksheetOutput | null>(null);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) { setError('Please enter a topic.'); return; }
    setError(''); setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateWorksheet({ grade, subject, topic: topic.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(out);
    } catch { setError('Generation failed. Please try again.'); }
    finally { setLoading(false); }
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: '#8B5CF6', paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>Create Worksheet</Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' }]}>Differentiated for any level</Text>
      </View>

      <View style={{ padding: 20 }}>
        <SimplePickerField label="Grade" value={grade} options={GRADE_NAMES} onChange={setGrade} colors={colors} />
        <SimplePickerField label="Subject" value={subject} options={SUBJECT_NAMES} onChange={setSubject} colors={colors} />
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>Topic</Text>
        <View style={[styles.input, { backgroundColor: colors.card, borderColor: error && !topic ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
          <TextInput style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }]} placeholder="e.g. States of Matter…" placeholderTextColor={colors.mutedForeground} value={topic} onChangeText={t => { setTopic(t); setError(''); }} multiline />
        </View>
        {error ? <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8 }]}>{error}</Text> : null}
        <Button label={loading ? 'Generating…' : 'Create Worksheet'} onPress={generate} loading={loading} fullWidth />
      </View>

      {loading && (
        <View style={[styles.loadBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20 }]}>
          <ActivityIndicator color="#8B5CF6" />
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }]}>Building your worksheet…</Text>
        </View>
      )}

      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          <View style={[styles.successBanner, { backgroundColor: '#8B5CF6' + '15', borderColor: '#8B5CF6' + '30', borderRadius: colors.radius }]}>
            <Ionicons name="document-text" size={18} color="#8B5CF6" />
            <Text style={[{ color: '#8B5CF6', fontFamily: 'Inter_600SemiBold', fontSize: 14 }]}>{result.title}</Text>
          </View>
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 16, lineHeight: 18 }]}>{result.instructions}</Text>
          {result.sections.map(sec => (
            <View key={sec.title} style={{ marginBottom: 20 }}>
              <Text style={[styles.secTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{sec.title}</Text>
              {sec.questions.map((q, i) => (
                <View key={i} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[styles.qNum, { color: '#8B5CF6', fontFamily: 'Inter_600SemiBold' }]}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 }]}>{q.text}</Text>
                    {q.options && q.options.map(o => (
                      <View key={o} style={styles.optionRow}>
                        <View style={[styles.optionDot, { borderColor: colors.border }]} />
                        <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }]}>{o}</Text>
                      </View>
                    ))}
                    <Text style={[styles.points, { color: '#8B5CF6', fontFamily: 'Inter_500Medium' }]}>{q.points} pts</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SimplePickerField({ label, value, options, onChange, colors }: { label: string; value: string; options: string[]; onChange: (v: string) => void; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      <Pressable onPress={() => setOpen(o => !o)} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: 'row', alignItems: 'center' }]}>
        <Text style={[{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15 }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card, marginTop: -8, marginBottom: 8, maxHeight: 180, overflow: 'hidden' }]}>
          <ScrollView nestedScrollEnabled>
            {options.map(o => (
              <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={[{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: o === value ? colors.secondary : 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={[{ color: o === value ? '#8B5CF6' : colors.foreground, fontFamily: o === value ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14 }]}>{o}</Text>
                {o === value && <Ionicons name="checkmark" size={16} color="#8B5CF6" />}
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
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, marginBottom: 12 },
  secTitle: { fontSize: 14, marginBottom: 10 },
  qCard: { flexDirection: 'row', padding: 14, borderWidth: 1, gap: 10, marginBottom: 8 },
  qNum: { fontSize: 14, width: 20 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  optionDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  points: { fontSize: 11, marginTop: 8 },
});
