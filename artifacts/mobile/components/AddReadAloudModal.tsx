/**
 * Compose a read-aloud question by hand.
 *
 * This exists because `read_aloud` is the one type the generator must never
 * write. Its passage is both the prompt and the answer key, and a model asked
 * for one would invent English prose at an unknown reading level and put it in
 * front of a class as a reading exercise. So a person chooses the text — from
 * the openly-licensed resources on the lesson shelf, or from the book in front
 * of them — and pastes it here.
 *
 * The passage input is LTR and left-aligned inside an otherwise RTL screen.
 * The teacher is typing English, and an English paragraph laid out
 * right-to-left is unreadable while you are checking it for typos.
 *
 * Validation is the server's job, not this form's: `QUESTION_TYPES.read_aloud
 * .validate` owns the word bounds and the empty-expectedAnswer rule, and a
 * second copy of those numbers here would be a second thing to keep in step.
 * What this does is count words as you type, so the server's refusal is never
 * the first time you learn the passage is too short.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { addEvaluationQuestion, type CompetencyKey, type EvaluationQuestion } from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

/**
 * Mirrors MIN_PASSAGE_WORDS / MAX_WORDS in api-server. Advisory only — the
 * server decides — but a teacher should see the limit while writing rather
 * than after pressing save.
 */
const MIN_WORDS = 10;
const MAX_WORDS = 600;

const COMPETENCIES: { key: CompetencyKey; label: TranslationKey }[] = [
  { key: 'knowledge', label: 'competencyKnowledge' },
  { key: 'understanding', label: 'competencyUnderstanding' },
  { key: 'application', label: 'competencyApplication' },
  { key: 'critical_thinking', label: 'competencyCriticalThinking' },
];

export function AddReadAloudModal({
  visible,
  onClose,
  evaluationId,
  objectiveIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  evaluationId: string;
  /** The objectives this evaluation was scoped to; the server refuses any other. */
  objectiveIds: string[];
  onAdded: (question: EvaluationQuestion, totalMarks: number) => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();

  const [passage, setPassage] = useState('');
  const [marks, setMarks] = useState('5');
  const [objectiveId, setObjectiveId] = useState(objectiveIds[0] ?? '');
  const [competency, setCompetency] = useState<CompetencyKey>('application');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Counted the way the scorer counts: whitespace-separated, punctuation
  // ignored. A teacher shown "12 words" by one rule and refused by another
  // would be right to think the form was lying.
  const wordCount = useMemo(
    () => passage.trim().split(/\s+/).filter(Boolean).length,
    [passage],
  );
  const lengthOk = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
  const marksValue = Number(marks);
  const canSave = lengthOk && marksValue > 0 && !!objectiveId && !busy;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const result = await addEvaluationQuestion(evaluationId, {
        type: 'read_aloud',
        objectiveId,
        competencyKey: competency,
        marks: marksValue,
        // `expectedAnswer` stays empty on purpose: the passage in `body` is the
        // reference, and a duplicate here would drift from what the student was
        // shown. The type's own validate() refuses a non-empty one.
        body: { passage: passage.trim(), maxSeconds: 120 },
      });
      onAdded(result.question, result.totalMarks);
      setPassage('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('readAloudAddFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 17 }}>
              {t('readAloudAddTitle')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('readAloudPassageLabel')}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('readAloudPassageHint')}
              </Text>
              <TextInput
                value={passage}
                onChangeText={setPassage}
                multiline
                placeholder="The power of appearance is greater than most people think…"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.passageInput,
                  {
                    color: colors.foreground,
                    borderColor: lengthOk || wordCount === 0 ? colors.border : '#B91C1C',
                    backgroundColor: colors.card,
                    textAlign: 'left',
                    writingDirection: 'ltr',
                  },
                ]}
              />
              <Text
                style={[
                  styles.hint,
                  { color: lengthOk || wordCount === 0 ? colors.mutedForeground : '#B91C1C', textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t('readAloudWordCount', String(wordCount), String(MIN_WORDS), String(MAX_WORDS))}
              </Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('marksLabel')}
              </Text>
              <TextInput
                value={marks}
                onChangeText={setMarks}
                keyboardType="numeric"
                style={[
                  styles.smallInput,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign: isRTL ? 'right' : 'left' },
                ]}
              />
            </View>

            {/* Only offered when there is a choice to make. An evaluation
                scoped to one objective has nothing to ask about. */}
            {objectiveIds.length > 1 ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('readAloudObjectiveLabel')}
                </Text>
                <View style={{ gap: 8 }}>
                  {objectiveIds.map((id, i) => (
                    <Pressable
                      key={id}
                      onPress={() => setObjectiveId(id)}
                      style={[
                        styles.choice,
                        {
                          borderColor: objectiveId === id ? ACCENT : colors.border,
                          backgroundColor: objectiveId === id ? ACCENT + '12' : colors.card,
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                        },
                      ]}
                    >
                      <Ionicons
                        name={objectiveId === id ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={objectiveId === id ? ACCENT : colors.mutedForeground}
                      />
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, flex: 1 }}
                      >
                        {t('readAloudObjectiveN', String(i + 1))}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('readAloudCompetencyLabel')}
              </Text>
              <View style={{ gap: 8 }}>
                {COMPETENCIES.map(c => (
                  <Pressable
                    key={c.key}
                    onPress={() => setCompetency(c.key)}
                    style={[
                      styles.choice,
                      {
                        borderColor: competency === c.key ? ACCENT : colors.border,
                        backgroundColor: competency === c.key ? ACCENT + '12' : colors.card,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                  >
                    <Ionicons
                      name={competency === c.key ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={competency === c.key ? ACCENT : colors.mutedForeground}
                    />
                    <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14 }}>
                      {t(c.label)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {!!error && <Text style={{ color: '#B91C1C', fontSize: 13 }}>{error}</Text>}

            <Pressable
              onPress={() => void save()}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: ACCENT, opacity: canSave ? 1 : 0.5 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
                  {t('readAloudAddBtn')}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  label: { fontFamily: 'Cairo_600SemiBold', fontSize: 14 },
  hint: { fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 20 },
  passageInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 160,
    fontSize: 15,
    lineHeight: 24,
  },
  smallInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  choice: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 16, marginTop: 4 },
});
