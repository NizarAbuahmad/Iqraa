import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { aiService } from '@/services/ai/generators';
import { WorksheetOutput } from '@/services/ai/AIService';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { Button } from '@/components/ui/Button';

const ACCENT = '#8B5CF6';

type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
type QType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false';

const DIFFICULTY_IDS: Difficulty[] = ['easy', 'medium', 'hard', 'mixed'];
const NUM_Q_OPTIONS = [5, 8, 10, 12, 15, 20];
const ALL_Q_TYPES: QType[] = ['multiple_choice', 'short_answer', 'fill_blank', 'true_false'];

export default function WorksheetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);

  const gradeNames = GRADES.map(g => lang === 'ar' ? g.nameAr : g.name);
  const subjectNames = SUBJECTS.map(s => lang === 'ar' ? s.nameAr : s.name);
  const diffLabels = [t('difficultyEasy'), t('difficultyMedium'), t('difficultyHard'), t('difficultyMixed')];
  const numQLabels = NUM_Q_OPTIONS.map(n => String(n));

  const [gradeIdx, setGradeIdx] = useState(7);
  const [subjectIdx, setSubjectIdx] = useState(3);
  const [topic, setTopic] = useState('');
  const [diffIdx, setDiffIdx] = useState(1); // medium
  const [numQIdx, setNumQIdx] = useState(2); // 10
  const [selectedTypes, setSelectedTypes] = useState<Set<QType>>(new Set(['multiple_choice', 'short_answer']));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WorksheetOutput | null>(null);
  const [error, setError] = useState('');

  const toggleType = (type: QType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const generate = async () => {
    if (!topic.trim()) { setError(t('topicRequired')); return; }
    setError(''); setLoading(true); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const out = await aiService.generateWorksheet({
        grade: GRADES[gradeIdx].name,
        subject: SUBJECTS[subjectIdx].name,
        topic: topic.trim(),
        language: lang === 'ar' ? 'arabic' : 'english',
        difficulty: DIFFICULTY_IDS[diffIdx],
        numQuestions: NUM_Q_OPTIONS[numQIdx],
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

  const typeLabels: Record<QType, string> = {
    multiple_choice: t('typeMultipleChoice'),
    short_answer: t('typeShortAnswer'),
    fill_blank: t('typeFillBlank'),
    true_false: t('typeTrueFalse'),
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
          {t('createWorksheetTitle')}
        </Text>
        <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('worksheetSubtitle')}
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
            placeholder={t('topicPlaceholderWorksheet')}
            placeholderTextColor={colors.mutedForeground}
            value={topic}
            onChangeText={text => { setTopic(text); setError(''); }}
            multiline
          />
        </View>

        {/* Difficulty */}
        <PickerField label={t('difficultyLabel')} value={diffLabels[diffIdx]} options={diffLabels} onChange={setDiffIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Number of questions */}
        <PickerField label={t('numQuestionsLabel')} value={numQLabels[numQIdx]} options={numQLabels} onChange={setNumQIdx} colors={colors} isRTL={isRTL} accent={ACCENT} />

        {/* Question types */}
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left', marginBottom: 10 }]}>{t('questionTypesLabel')}</Text>
        <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {ALL_Q_TYPES.map(type => (
            <CheckboxRow
              key={type}
              label={typeLabels[type]}
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
          label={loading ? t('generating') : t('createWorksheetBtn')}
          onPress={generate}
          loading={loading}
          fullWidth
        />
      </View>

      {/* Loading */}
      {loading && (
        <View style={[styles.loadBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14 }]}>{t('buildingWorksheet')}</Text>
        </View>
      )}

      {/* Result */}
      {result && (
        <View style={{ paddingHorizontal: 20 }}>
          {/* Title banner */}
          <View style={[styles.successBanner, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30', borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="document-text" size={18} color={ACCENT} />
            <Text style={[{ color: ACCENT, fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{result.title}</Text>
          </View>

          {/* Instructions */}
          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 16, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }]}>
            {result.instructions}
          </Text>

          {/* Questions by section */}
          {result.sections.map(sec => {
            let qNum = 0;
            // Find question offset across sections
            return (
              <View key={sec.title} style={{ marginBottom: 20 }}>
                <Text style={[styles.secTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{sec.title}</Text>
                {sec.questions.map((q, i) => (
                  <View key={i} style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.qNum, { color: ACCENT, fontFamily: 'Inter_600SemiBold' }]}>{i + 1}.</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }]}>{q.text}</Text>
                      {q.options?.map(o => (
                        <View key={o} style={[styles.optionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                          <View style={[styles.optionDot, { borderColor: colors.border }]} />
                          <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 }]}>{o}</Text>
                        </View>
                      ))}
                      <Text style={[styles.pts, { color: ACCENT, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>{q.points} {t('pts')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}

          {/* Answer Key */}
          {result.answerKey.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={[styles.akHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="key-outline" size={15} color={ACCENT} />
                <Text style={[styles.akTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>{t('answerKeyTitle')}</Text>
              </View>
              <View style={[styles.akBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {result.answerKey.map(item => (
                  <View key={item.num} style={[styles.akRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Text style={[styles.akNum, { color: ACCENT, fontFamily: 'Inter_600SemiBold' }]}>{item.num}.</Text>
                    <Text style={[styles.akAnswer, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{item.answer}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}
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
  successBanner: { alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, marginBottom: 12 },
  secTitle: { fontSize: 14, marginBottom: 10 },
  qCard: { padding: 14, borderWidth: 1, gap: 10, marginBottom: 8 },
  qNum: { fontSize: 14, width: 20 },
  optionRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  optionDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, flexShrink: 0 },
  pts: { fontSize: 11, marginTop: 8 },
  akHeader: { alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  akTitle: { fontSize: 14 },
  akBody: { borderWidth: 1, padding: 14 },
  akRow: { gap: 8, marginBottom: 6, alignItems: 'flex-start' },
  akNum: { fontSize: 13, width: 22 },
  akAnswer: { flex: 1, fontSize: 13, lineHeight: 19 },
  regenBtn: { alignItems: 'center', gap: 8, padding: 14, borderWidth: 1.5, marginHorizontal: 20, marginTop: 8, marginBottom: 20 },
  regenText: { fontSize: 14 },
});
