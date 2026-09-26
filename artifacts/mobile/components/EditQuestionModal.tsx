/**
 * Write a question by hand, or fix one the generator wrote.
 *
 * One form for both: adding picks a type first, editing keeps the stored one.
 * The body ↔ form mapping lives in `services/questionDraft.ts` (tested there);
 * validation stays the server's, so its refusal is shown as-is.
 *
 * Mounted only while open, so its state starts from the question every time.
 */
import React, { useState } from 'react';
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
import {
  addEvaluationQuestion,
  updateEvaluationQuestion,
  type CompetencyKey,
  type Difficulty,
  type EvaluationQuestion,
} from '@/services/evaluations';
import {
  EDITABLE_TYPES,
  countGaps,
  emptyForm,
  formFromQuestion,
  payloadFromForm,
  type EditableType,
  type QuestionForm,
} from '@/services/questionDraft';
import type { TranslationKey } from '@/services/i18n';
import { COMPETENCIES } from '@/components/AddReadAloudModal';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

const TYPE_LABEL: Record<EditableType, TranslationKey> = {
  multiple_choice: 'typeMultipleChoice',
  true_false: 'typeTrueFalse',
  matching: 'typeMatching',
  fill_blank: 'typeFillBlank',
  short_answer: 'typeShortAnswer',
  open_ended: 'typeOpenEnded',
  problem_solving: 'typeProblemSolving',
  practical_task: 'typePracticalTask',
};

const DIFFICULTY_LABEL: Record<Difficulty, TranslationKey> = {
  basic: 'evalDifficultyBasic',
  standard: 'evalDifficultyStandard',
  advanced: 'evalDifficultyAdvanced',
};

export function EditQuestionModal({
  onClose,
  evaluationId,
  objectiveIds,
  question,
  onSaved,
}: {
  onClose: () => void;
  evaluationId: string;
  objectiveIds: string[];
  /** The question to edit; absent to add a new one. */
  question?: EvaluationQuestion;
  onSaved: (question: EvaluationQuestion, totalMarks: number) => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  const [type, setType] = useState<EditableType>((question?.type as EditableType) ?? 'multiple_choice');
  const [form, setForm] = useState<QuestionForm>(() => (question ? formFromQuestion(question) : emptyForm()));
  const [marks, setMarks] = useState(question ? String(Number(question.marks)) : '1');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'standard');
  const [objectiveId, setObjectiveId] = useState(objectiveIds[0] ?? '');
  const [competency, setCompetency] = useState<CompetencyKey>('understanding');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (patch: Partial<QuestionForm>) => setForm(f => ({ ...f, ...patch }));
  const marksValue = Number(marks);
  const canSave = marksValue > 0 && !!objectiveId && !busy;

  async function save() {
    setBusy(true);
    setError('');
    try {
      const { body, expectedAnswer, rubric } = payloadFromForm(type, form, marksValue, question);
      const result = question
        ? await updateEvaluationQuestion(evaluationId, question.id, { marks: marksValue, difficulty, body, expectedAnswer })
        : await addEvaluationQuestion(evaluationId, {
            type,
            objectiveId,
            competencyKey: competency,
            marks: marksValue,
            difficulty,
            body,
            expectedAnswer,
            rubric,
          });
      onSaved(result.question, result.totalMarks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('questionSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  const label = (key: TranslationKey, ...args: string[]) => (
    <Text style={[styles.label, { color: colors.foreground, textAlign: align }]}>{t(key, ...args)}</Text>
  );
  const input = (value: string, onChange: (v: string) => void, opts: { multiline?: boolean; placeholder?: string } = {}) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={[
        styles.input,
        opts.multiline && styles.multiline,
        { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign: align, writingDirection: isRTL ? 'rtl' : 'ltr' },
      ]}
    />
  );
  const chip = (key: string, text: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? ACCENT : colors.border, backgroundColor: selected ? ACCENT + '12' : colors.card }]}
    >
      <Text style={{ color: selected ? ACCENT : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>{text}</Text>
    </Pressable>
  );
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;

  function typeFields() {
    switch (type) {
      case 'multiple_choice':
        return (
          <>
            {label('questionStemLabel')}
            {input(form.prompt, v => set({ prompt: v }), { multiline: true })}
            {label('questionOptionsLabel')}
            {form.options.map((text, i) => {
              const on = form.correct.includes(i);
              return (
                <View key={i} style={[row, { alignItems: 'center', gap: 8 }]}>
                  <Pressable onPress={() => set({ correct: [i] })} hitSlop={8} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? ACCENT : colors.mutedForeground} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    {input(text, v => set({ options: form.options.map((o, k) => (k === i ? v : o)) }), {
                      placeholder: t('questionOptionN', String(i + 1)),
                    })}
                  </View>
                </View>
              );
            })}
          </>
        );
      case 'true_false':
        return (
          <>
            {label('questionStatementLabel')}
            {input(form.prompt, v => set({ prompt: v }), { multiline: true })}
            {label('questionAnswerLabel')}
            <View style={[row, { gap: 8 }]}>
              {chip('t', t('practiceTrue'), form.truth, () => set({ truth: true }))}
              {chip('f', t('practiceFalse'), !form.truth, () => set({ truth: false }))}
            </View>
          </>
        );
      case 'fill_blank': {
        const gaps = countGaps(form.prompt);
        return (
          <>
            {label('questionStemLabel')}
            <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align }]}>{t('questionBlankTextHint')}</Text>
            {input(form.prompt, v => set({ prompt: v }), { multiline: true })}
            {Array.from({ length: gaps }, (_, i) => (
              <View key={i} style={{ gap: 6 }}>
                {label('questionBlankN', String(i + 1))}
                {input(form.blanks[i] ?? '', v => {
                  const blanks = [...form.blanks];
                  blanks[i] = v;
                  set({ blanks });
                })}
              </View>
            ))}
          </>
        );
      }
      case 'matching':
        return (
          <>
            {label('questionPairsLabel')}
            {form.pairs.map((p, i) => (
              <View key={i} style={[row, { gap: 8 }]}>
                <View style={{ flex: 1 }}>
                  {input(p.left, v => set({ pairs: form.pairs.map((q, k) => (k === i ? { ...q, left: v } : q)) }))}
                </View>
                <Ionicons name="swap-horizontal" size={18} color={colors.mutedForeground} style={{ alignSelf: 'center' }} />
                <View style={{ flex: 1 }}>
                  {input(p.right, v => set({ pairs: form.pairs.map((q, k) => (k === i ? { ...q, right: v } : q)) }))}
                </View>
              </View>
            ))}
            <View style={row}>{chip('add', `+ ${t('questionAddPair')}`, false, () => set({ pairs: [...form.pairs, { left: '', right: '' }] }))}</View>
          </>
        );
      case 'practical_task':
        return (
          <>
            {label('questionStemLabel')}
            {input(form.prompt, v => set({ prompt: v }), { multiline: true })}
            {label('questionCriteriaLabel')}
            {input(form.list, v => set({ list: v }), { multiline: true })}
          </>
        );
      default:
        return (
          <>
            {label('questionStemLabel')}
            {input(form.prompt, v => set({ prompt: v }), { multiline: true })}
            {type === 'problem_solving' && (
              <>
                {label('questionScenarioLabel')}
                {input(form.scenario, v => set({ scenario: v }), { multiline: true })}
              </>
            )}
            {label('questionModelAnswerLabel')}
            {input(form.modelAnswer, v => set({ modelAnswer: v }), { multiline: true })}
            {label('questionKeyConceptsLabel')}
            {input(form.list, v => set({ list: v }), { multiline: true })}
          </>
        );
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, row, { borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 17 }}>
              {t(question ? 'questionEditTitle' : 'questionAddTitle')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }} keyboardShouldPersistTaps="handled">
            {!question && (
              <>
                {label('questionTypeLabel')}
                <View style={[row, styles.wrap]}>
                  {EDITABLE_TYPES.map(k => chip(k, t(TYPE_LABEL[k]), type === k, () => setType(k)))}
                </View>
              </>
            )}

            {typeFields()}

            {label('marksLabel')}
            <View style={{ width: 120 }}>
              <TextInput
                value={marks}
                onChangeText={setMarks}
                keyboardType="numeric"
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign: align }]}
              />
            </View>

            {label('evalDifficultyLabel')}
            <View style={[row, { gap: 8 }]}>
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map(d =>
                chip(d, t(DIFFICULTY_LABEL[d]), difficulty === d, () => setDifficulty(d)),
              )}
            </View>

            {!question && objectiveIds.length > 1 && (
              <>
                {label('readAloudObjectiveLabel')}
                <View style={[row, styles.wrap]}>
                  {objectiveIds.map((id, i) =>
                    chip(id, t('readAloudObjectiveN', String(i + 1)), objectiveId === id, () => setObjectiveId(id)),
                  )}
                </View>
              </>
            )}

            {!question && (
              <>
                {label('readAloudCompetencyLabel')}
                <View style={[row, styles.wrap]}>
                  {COMPETENCIES.map(c => chip(c.key, t(c.label), competency === c.key, () => setCompetency(c.key)))}
                </View>
              </>
            )}

            {!!error && <Text style={{ color: '#B91C1C', fontSize: 13, textAlign: align }}>{error}</Text>}

            <Pressable
              onPress={() => void save()}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: ACCENT_FILL, opacity: canSave ? 1 : 0.5 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>{t('questionSaveBtn')}</Text>
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
  header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  label: { fontFamily: 'Cairo_600SemiBold', fontSize: 14, marginTop: 6 },
  hint: { fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Almarai_400Regular' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  wrap: { flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 16, marginTop: 10 },
});
