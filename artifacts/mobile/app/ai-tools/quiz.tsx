import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { aiService } from '@/services/ai/generators';
import { QuizOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';

const ACCENT = '#F59E0B';

type QType = 'multiple_choice' | 'true_false' | 'short_answer';

const DURATION_OPTIONS = [10, 15, 20, 25, 30, 45];
const MARKS_OPTIONS = [10, 20, 25, 30, 40, 50, 100];
const ALL_Q_TYPES: QType[] = ['multiple_choice', 'true_false', 'short_answer'];

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);

  const gradeNames = GRADES.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = SUBJECTS.map(s => lang === 'ar' ? s.nameAr : s.name);
  const durationLabels = DURATION_OPTIONS.map(d => `${d} ${t('min')}`);
  const marksLabels = MARKS_OPTIONS.map(m => String(m));

  const [gradeIdx, setGradeIdx] = useState(9);
  const [subjectIdx, setSubjectIdx] = useState(2);
  const [topic, setTopic] = useState('');
  const [durationIdx, setDurationIdx] = useState(2); // 20 min
  const [marksIdx, setMarksIdx] = useState(1); // 20 marks
  const [selectedTypes, setSelectedTypes] = useState<Set<QType>>(new Set(['multiple_choice', 'true_false', 'short_answer']));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuizOutput | null>(null);
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);

  const toggleType = (type: QType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const TYPE_LABEL: Record<QType, string> = {
    multiple_choice: t('typeMultipleChoice'),
    true_false: t('typeTrueFalse'),
    short_answer: t('typeShortAnswer'),
  };
  const TYPE_COLOR: Record<QType, string> = {
    multiple_choice: '#F59E0B',
    true_false: '#3B82F6',
    short_answer: '#10B981',
  };

  const generate = async () => {
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    setError(''); setLoading(true); setResult(null); setShowAnswers(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateQuiz({
        grade: GRADES[gradeIdx].name,
        subject: SUBJECTS[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        duration: DURATION_OPTIONS[durationIdx],
        totalMarks: MARKS_OPTIONS[marksIdx],
        questionTypes: Array.from(selectedTypes),
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

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

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
        <Text style={[styles.headerTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('createQuizTitle')}
        </Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quizSubtitle')}
        </Text>
      </View>

      {/* Form */}
      <View style={{ padding: 20 }}>
        <PickerField label={t('grade')} value={gradeNames[gradeIdx]} options={gradeNames} onChange={setGradeIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />
        <PickerField label={t('subjects')} value={subjectNames[subjectIdx]} options={subjectNames} onChange={setSubjectIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Topic */}
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{t('topicLabel')}</Text>
        <View style={[styles.input, { backgroundColor: colors.card, borderColor: error && !topic ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('topicPlaceholderQuiz')}
            placeholderTextColor={colors.mutedForeground}
            value={topic}
            onChangeText={text => { setTopic(text); setError(''); }}
            multiline
          />
        </View>

        {/* Duration */}
        <PickerField label={t('quizDurationLabel')} value={durationLabels[durationIdx]} options={durationLabels} onChange={setDurationIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Total marks */}
        <PickerField label={t('totalMarksLabel')} value={marksLabels[marksIdx]} options={marksLabels} onChange={setMarksIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Question types */}
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }]}>{t('questionTypesLabel')}</Text>
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {ALL_Q_TYPES.map(type => (
            <CheckboxRow
              key={type}
              label={TYPE_LABEL[type]}
              checked={selectedTypes.has(type)}
              onToggle={() => toggleType(type)}
              accent={ACCENT}
              colors={colors}
              isRTL={isRTL}
            />
          ))}
        </View>

        {error ? <Text style={[{ color: colors.destructive, fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{error}</Text> : null}
        <Button
          label={loading ? t('generatingQuiz') : t('generateQuizBtn')}
          onPress={generate}
          loading={loading}
          fullWidth
          style={{ backgroundColor: ACCENT }}
        />
      </View>

      {/* Loading */}
      {loading && (
        <View style={[styles.loadBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }]}>{t('generatingQuiz')}</Text>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          {/* Quiz header card */}
          <View style={[styles.quizHeader, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40', borderRadius: colors.radius }]}>
            <Text style={[styles.quizTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>{result.title}</Text>
            <View style={[styles.quizMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MetaPill icon="time-outline" text={`${result.duration} ${t('min')}`} color={ACCENT} />
              <MetaPill icon="star-outline" text={`${result.totalPoints} ${t('pts')}`} color={ACCENT} />
              <MetaPill icon="help-circle-outline" text={`${result.questions.length} Q`} color={ACCENT} />
            </View>
          </View>

          {/* Show/hide answers toggle */}
          <Pressable
            onPress={() => setShowAnswers(v => !v)}
            style={[styles.toggleBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={showAnswers ? 'eye-off-outline' : 'eye-outline'} size={16} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
              {showAnswers ? t('hideAnswers') : t('showAnswers')}
            </Text>
          </Pressable>

          {/* Questions */}
          {result.questions.map((q, i) => {
            const tc = TYPE_COLOR[q.type as QType] ?? ACCENT;
            return (
              <View key={q.id} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={[styles.qTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.qNumCircle, { backgroundColor: ACCENT }]}>
                    <Text style={[{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 }]}>{i + 1}</Text>
                  </View>
                  <View style={[styles.typeBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[{ color: tc, fontFamily: 'Inter_500Medium', fontSize: 11 }]}>{TYPE_LABEL[q.type as QType] ?? q.type}</Text>
                  </View>
                  <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }]}>{q.points} {t('pts')}</Text>
                </View>
                <Text style={[styles.qText, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{q.text}</Text>

                {q.options?.map((opt, oi) => {
                  const isCorrect = showAnswers && opt === q.correctAnswer;
                  return (
                    <View key={oi} style={[styles.optRow, { backgroundColor: isCorrect ? '#10B981' + '15' : colors.muted, borderRadius: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.optLabel, { color: isCorrect ? '#10B981' : colors.mutedForeground, fontFamily: isCorrect ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                        {String.fromCharCode(65 + oi)}.
                      </Text>
                      <Text style={[{ flex: 1, color: isCorrect ? '#10B981' : colors.foreground, fontFamily: isCorrect ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }]}>{opt}</Text>
                      {isCorrect && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                    </View>
                  );
                })}

                {showAnswers && q.type === 'true_false' && (
                  <View style={[styles.ansBox, { backgroundColor: '#10B981' + '15', borderRadius: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={[{ color: '#10B981', fontFamily: 'Inter_500Medium', fontSize: 13 }]}>{t('answer')}: {q.correctAnswer}</Text>
                  </View>
                )}

                {showAnswers && q.type === 'short_answer' && (
                  <View style={[styles.ansBox, { backgroundColor: '#3B82F6' + '12', borderRadius: 8 }]}>
                    <Text style={[{ color: '#3B82F6', fontFamily: 'Inter_500Medium', fontSize: 12, textAlign: isRTL ? 'right' : 'left' }]}>
                      {t('answer')}: {q.correctAnswer}
                    </Text>
                  </View>
                )}

                {showAnswers && (
                  <View style={[styles.expBox, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                    <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }]}>
                      💡 {q.explanation}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Regenerate */}
      {result && !loading && (
        <Pressable
          onPress={generate}
          style={[styles.regenBtn, { borderColor: ACCENT, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="refresh-outline" size={16} color={ACCENT} />
          <Text style={[styles.regenText, { color: ACCENT, fontFamily: 'Inter_600SemiBold' }]}>{t('regenerateBtn')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function MetaPill({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color + '18', borderRadius: 20 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ color, fontFamily: 'Inter_500Medium', fontSize: 12 }}>{text}</Text>
    </View>
  );
}

function CheckboxRow({ label, checked, onToggle, accent, colors, isRTL }: {
  label: string; checked: boolean; onToggle: () => void;
  accent: string; colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.checkRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? accent : colors.border, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text style={[{ color: colors.foreground, fontFamily: checked ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
    </Pressable>
  );
}

function PickerField({ label, value, options, onChange, colors, isRTL, accent }: {
  label: string; value: string; options: string[]; onChange: (i: number) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.input, { backgroundColor: colors.card, borderColor: open ? accent : colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}
      >
        <Text style={[{ flex: 1, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card, marginTop: -8, marginBottom: 8, maxHeight: 180, overflow: 'hidden' }]}>
          <ScrollView nestedScrollEnabled>
            {options.map((o, i) => (
              <Pressable
                key={i}
                onPress={() => { onChange(i); setOpen(false); }}
                style={[{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: o === value ? accent + '15' : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }]}
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
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerTitle: { fontSize: 26 },
  headerSub: { fontSize: 13, marginTop: 4 },
  label: { fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1.5, padding: 14, marginBottom: 16 },
  checkboxGroup: { borderWidth: 1, padding: 14, marginBottom: 16, gap: 4 },
  checkRow: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  loadBox: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, marginBottom: 16 },
  quizHeader: { padding: 16, borderWidth: 1, marginBottom: 16 },
  quizTitle: { fontSize: 16, marginBottom: 10 },
  quizMeta: { gap: 8, flexWrap: 'wrap' },
  toggleBtn: { alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  qCard: { borderWidth: 1, padding: 16, marginBottom: 12 },
  qTop: { alignItems: 'center', gap: 8, marginBottom: 10 },
  qNumCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  qText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  optRow: { alignItems: 'center', gap: 8, padding: 10, marginBottom: 6 },
  optLabel: { fontSize: 13, width: 20 },
  ansBox: { alignItems: 'center', gap: 6, padding: 10, marginTop: 8 },
  expBox: { padding: 10, marginTop: 8 },
  regenBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5, marginHorizontal: 20, marginTop: 4, marginBottom: 20 },
  regenText: { fontSize: 14 },
});
