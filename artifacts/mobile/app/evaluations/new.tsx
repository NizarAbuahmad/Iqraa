/**
 * New evaluation — scope, shape, generate, in one screen.
 *
 * The full authoring flow the plan describes (scope → shape → generate →
 * review/edit → preview → publish) is a multi-step wizard with per-question
 * editors for all eight types. This is deliberately smaller: pick a book,
 * pick objectives, pick question types and a count, and generate — enough to
 * reach a real published evaluation end to end. Editing individual generated
 * questions happens later, not here.
 *
 * Two modes share the same scope pickers. **Generate** builds the questions
 * from the curriculum. **Paper exam** is for an exam the teacher already set
 * and handed out: the app never sees the question text, only a grid of what
 * each question is worth and what it measures — enough to mark it, score it,
 * and afterwards say which objectives the class is weak on.
 *
 * Objectives come straight from `@workspace/curriculum` (already bundled with
 * the app, same package the API resolves against) rather than a network call
 * — the picker works offline and never drifts from what the server will
 * accept, since both read the same package.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getObjectivesForBook, type CurriculumObjective } from '@/services/curriculumData';
import {
  EvaluationError,
  createEvaluation,
  generateEvaluation,
  listEvaluableBooks,
  setPaperQuestions,
  type CompetencyKey,
  type Difficulty,
  type EvaluableBook,
  type QuestionType,
} from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

const ALL_TYPES: QuestionType[] = [
  'multiple_choice',
  'true_false',
  'matching',
  'fill_blank',
  'short_answer',
  'open_ended',
  'problem_solving',
  'practical_task',
];
const TYPE_LABEL_KEY: Record<QuestionType, TranslationKey> = {
  multiple_choice: 'typeMultipleChoice',
  true_false: 'typeTrueFalse',
  matching: 'typeMatching',
  fill_blank: 'typeFillBlank',
  short_answer: 'typeShortAnswer',
  open_ended: 'typeOpenEnded',
  problem_solving: 'typeProblemSolving',
  practical_task: 'typePracticalTask',
};
const DIFFICULTIES: Difficulty[] = ['basic', 'standard', 'advanced'];
const DIFFICULTY_KEY: Record<Difficulty, TranslationKey> = {
  basic: 'evalDifficultyBasic',
  standard: 'evalDifficultyStandard',
  advanced: 'evalDifficultyAdvanced',
};
const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];

type Mode = 'generate' | 'paper';

/** One row of the paper grid, as it sits in the form. */
type PaperRow = { marks: string; objectiveId: string; competencyKey: CompetencyKey };

const COMPETENCIES: CompetencyKey[] = ['knowledge', 'understanding', 'application', 'critical_thinking'];
const COMPETENCY_KEY: Record<CompetencyKey, TranslationKey> = {
  knowledge: 'competencyKnowledge',
  understanding: 'competencyUnderstanding',
  application: 'competencyApplication',
  critical_thinking: 'competencyCriticalThinking',
};
const DEFAULT_MARKS = '1';

export default function NewEvaluationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  const [books, setBooks] = useState<EvaluableBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<CurriculumObjective[]>([]);
  const [selectedObjectives, setSelectedObjectives] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<QuestionType>>(
    new Set(['short_answer', 'open_ended']),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [countIdx, setCountIdx] = useState(1); // 10
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<Mode>('generate');
  const [paperRows, setPaperRows] = useState<PaperRow[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listEvaluableBooks()
      .then(res => setBooks(res.books))
      .catch(() => setError(t('evaluationLoadFailed')))
      .finally(() => setLoadingBooks(false));
  }, [t]);

  useEffect(() => {
    setObjectives(bookId ? getObjectivesForBook(bookId) : []);
    setSelectedObjectives(new Set());
  }, [bookId]);

  /**
   * Keep the grid the length the count picker asks for, preserving what the
   * teacher already typed. A row whose objective was since deselected falls
   * back to the first still-selected one rather than silently keeping an
   * objective the evaluation no longer covers — the server would reject it,
   * and the teacher would have no idea which row was at fault.
   */
  useEffect(() => {
    if (mode !== 'paper') return;
    const objectiveIds = [...selectedObjectives];
    const fallback = objectiveIds[0] ?? '';
    const count = QUESTION_COUNTS[countIdx] ?? 10;
    setPaperRows(prev =>
      Array.from({ length: count }, (_, i): PaperRow => {
        const row = prev[i];
        const keepObjective = row && objectiveIds.includes(row.objectiveId);
        return {
          marks: row?.marks ?? DEFAULT_MARKS,
          objectiveId: keepObjective ? row.objectiveId : fallback,
          competencyKey: row?.competencyKey ?? 'understanding',
        };
      }),
    );
  }, [mode, countIdx, selectedObjectives]);

  const setPaperRow = useCallback((index: number, patch: Partial<PaperRow>) => {
    setPaperRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const toggleObjective = useCallback((id: string) => {
    setSelectedObjectives(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: QuestionType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const selectedBook = books.find(b => b.bookId === bookId) ?? null;

  const onSubmit = async () => {
    if (creating) return;
    if (!bookId || !selectedBook?.evaluable) {
      setError(t('bookNotEvaluable'));
      return;
    }
    if (selectedObjectives.size === 0) {
      setError(t('selectAtLeastOneObjective'));
      return;
    }
    if (mode === 'generate' && selectedTypes.size === 0) {
      setError(t('selectAtLeastOneType'));
      return;
    }
    if (mode === 'paper') {
      // Named row, not "check your marks" — on a 30-row grid the teacher
      // should not have to hunt for the one that is wrong.
      const bad = paperRows.findIndex(r => !(Number(r.marks) > 0));
      if (bad >= 0) {
        setError(t('paperMarksInvalid', String(bad + 1)));
        return;
      }
    }

    setError('');
    setCreating(true);
    try {
      const evaluation = await createEvaluation({
        bookId,
        objectiveIds: [...selectedObjectives],
        // A paper question carries no text, so its type is the one with no
        // automatic grader — the teacher marks every one of them by hand.
        assessmentTypes: mode === 'paper' ? ['open_ended'] : [...selectedTypes],
        targetQuestionCount: mode === 'paper' ? paperRows.length : QUESTION_COUNTS[countIdx],
        difficulty,
        titleAr: title.trim() || undefined,
      });
      if (mode === 'paper') {
        await setPaperQuestions(
          evaluation.id,
          paperRows.map(r => ({
            marks: Number(r.marks),
            objectiveId: r.objectiveId,
            competencyKey: r.competencyKey,
            difficulty,
          })),
        );
      } else {
        await generateEvaluation(evaluation.id);
      }
      router.replace({ pathname: '/evaluations/[id]', params: { id: evaluation.id } });
    } catch (err) {
      if (err instanceof EvaluationError && err.code === 'no_level_scale') {
        setError(t('evaluationSetupNotReady'));
      } else {
        setError(err instanceof EvaluationError ? err.message : t('evaluationCreateFailed'));
      }
      setCreating(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('newEvaluation')}
        </Text>
      </View>

      <View style={{ padding: 20 }}>
        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
          {t('evalTitleLabel')}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('evalTitlePlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: 'Almarai_400Regular', textAlign: align },
          ]}
        />

        <View style={[styles.modeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {(['generate', 'paper'] as Mode[]).map(m => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeChip, { borderColor: active ? ACCENT : colors.border, backgroundColor: active ? ACCENT : colors.card }]}
              >
                <Text style={{ color: active ? '#fff' : colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                  {t(m === 'generate' ? 'evalModeGenerate' : 'evalModePaper')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t(mode === 'generate' ? 'evalModeGenerateHint' : 'evalModePaperHint')}
        </Text>

        <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
          {t('selectBookLabel')}
        </Text>
        {loadingBooks ? (
          <ActivityIndicator color={ACCENT} style={{ marginBottom: 16 }} />
        ) : (
          <View style={{ marginBottom: 8 }}>
            {books.map(b => {
              const selected = b.bookId === bookId;
              return (
                <Pressable
                  key={b.bookId}
                  onPress={() => b.evaluable && setBookId(b.bookId)}
                  disabled={!b.evaluable}
                  style={[
                    styles.bookRow,
                    {
                      borderColor: selected ? ACCENT : colors.border,
                      backgroundColor: selected ? ACCENT + '12' : colors.card,
                      opacity: b.evaluable ? 1 : 0.5,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14, textAlign: align }]}>
                      {b.titleAr}
                    </Text>
                    {!b.evaluable && (
                      <Text style={[{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 11, marginTop: 2, textAlign: align }]}>
                        {t('bookNotEvaluable')}
                      </Text>
                    )}
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {bookId && (
          <>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
              {t('selectObjectivesLabel')}
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('selectObjectivesHint')}
            </Text>
            <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {objectives.map(o => (
                <CheckboxRow
                  key={o.id}
                  label={lang === 'ar' ? o.descriptionAr || o.description : o.description}
                  checked={selectedObjectives.has(o.id)}
                  onToggle={() => toggleObjective(o.id)}
                  accent={ACCENT}
                  colors={colors}
                  isRTL={isRTL}
                />
              ))}
            </View>
          </>
        )}

        {mode === 'generate' && (
          <>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
              {t('assessmentTypesLabel')}
            </Text>
            <View style={[styles.checkboxGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {ALL_TYPES.map(type => (
                <CheckboxRow
                  key={type}
                  label={t(TYPE_LABEL_KEY[type])}
                  checked={selectedTypes.has(type)}
                  onToggle={() => toggleType(type)}
                  accent={ACCENT}
                  colors={colors}
                  isRTL={isRTL}
                />
              ))}
            </View>
          </>
        )}

        <PickerField
          label={t('evalDifficultyLabel')}
          value={t(DIFFICULTY_KEY[difficulty])}
          options={DIFFICULTIES.map(d => t(DIFFICULTY_KEY[d]))}
          onChange={i => setDifficulty(DIFFICULTIES[i])}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />
        <PickerField
          label={t('questionCountLabel')}
          value={String(QUESTION_COUNTS[countIdx])}
          options={QUESTION_COUNTS.map(String)}
          onChange={setCountIdx}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />

        {mode === 'paper' && (
          <>
            <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
              {t('paperGridLabel')}
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('paperGridHint')}
            </Text>
            {selectedObjectives.size === 0 ? (
              <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('selectAtLeastOneObjective')}
              </Text>
            ) : (
              paperRows.map((row, i) => (
                <PaperRowEditor
                  key={i}
                  index={i}
                  row={row}
                  objectives={objectives.filter(o => selectedObjectives.has(o.id))}
                  lang={lang}
                  onChange={patch => setPaperRow(i, patch)}
                  colors={colors}
                  isRTL={isRTL}
                  align={align}
                  t={t}
                />
              ))
            )}
          </>
        )}

        {error ? (
          <Text style={{ color: colors.destructive, fontSize: 13, fontFamily: 'Almarai_400Regular', marginBottom: 12, textAlign: align }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={creating}
          style={[styles.submitBtn, { backgroundColor: ACCENT, opacity: creating ? 0.7 : 1 }]}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
              {t(mode === 'paper' ? 'createPaperExamBtn' : 'generateAndCreateBtn')}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

/**
 * One question of a paper exam: what it is worth, what it measures, and at
 * what cognitive demand.
 *
 * The competency chips are not decoration and are not derived — see
 * `competency.ts` on the server: a question's cognitive demand is not its
 * objective's, and inheriting it produces a breakdown that is half
 * Understanding, half Application and nothing else. The default is a starting
 * point so a thirty-row grid stays fast to fill, not an answer.
 *
 * The objective picker is hidden when the evaluation covers exactly one —
 * there is nothing to choose, and a picker with a single option is furniture.
 */
function PaperRowEditor({
  index, row, objectives, lang, onChange, colors, isRTL, align, t,
}: {
  index: number;
  row: PaperRow;
  objectives: CurriculumObjective[];
  lang: string;
  onChange: (patch: Partial<PaperRow>) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  const label = (o: CurriculumObjective) =>
    lang === 'ar' ? o.descriptionAr || o.description : o.description;
  const current = objectives.find(o => o.id === row.objectiveId);

  return (
    <View style={[styles.paperRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.paperNum, { backgroundColor: ACCENT }]}>
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 12 }}>{index + 1}</Text>
        </View>
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
          {t('paperMarksLabel')}
        </Text>
        <TextInput
          value={row.marks}
          onChangeText={v => onChange({ marks: v })}
          keyboardType="decimal-pad"
          style={[styles.paperMarks, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />
      </View>

      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {COMPETENCIES.map(key => {
          const active = row.competencyKey === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange({ competencyKey: key })}
              style={[styles.compChip, { borderColor: active ? ACCENT : colors.border, backgroundColor: active ? ACCENT + '18' : 'transparent' }]}
            >
              <Text style={{ color: active ? ACCENT : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                {t(COMPETENCY_KEY[key])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {objectives.length > 1 && (
        <PickerField
          label={t('paperObjectiveLabel')}
          value={current ? label(current) : ''}
          options={objectives.map(label)}
          onChange={i => onChange({ objectiveId: objectives[i]!.id })}
          colors={colors}
          isRTL={isRTL}
          accent={ACCENT}
        />
      )}
      {objectives.length === 1 && (
        <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align, marginTop: 8, marginBottom: 0 }]}>
          {label(objectives[0]!)}
        </Text>
      )}
    </View>
  );
}

function CheckboxRow({
  label, checked, onToggle, accent, colors, isRTL,
}: {
  label: string; checked: boolean; onToggle: () => void;
  accent: string; colors: ReturnType<typeof useColors>; isRTL: boolean;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.checkRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={[styles.checkbox, { borderColor: checked ? accent : colors.border, backgroundColor: checked ? accent : 'transparent' }]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <Text
        style={{ color: colors.foreground, fontFamily: checked ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PickerField({
  label, value, options, onChange, colors, isRTL, accent,
}: {
  label: string; value: string; options: string[]; onChange: (i: number) => void;
  colors: ReturnType<typeof useColors>; isRTL: boolean; accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={[styles.pickerInput, { backgroundColor: colors.card, borderColor: open ? accent : colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
          {value}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </Pressable>
      {open && (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, marginTop: -8, marginBottom: 8, overflow: 'hidden' }}>
          {options.map((o, i) => (
            <Pressable
              key={i}
              onPress={() => { onChange(i); setOpen(false); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border,
                backgroundColor: o === value ? accent + '15' : 'transparent',
                flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: o === value ? accent : colors.foreground, fontFamily: o === value ? 'Cairo_500Medium' : 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                {o}
              </Text>
              {o === value && <Ionicons name="checkmark" size={16} color={accent} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  headerTitle: { fontSize: 22, color: '#fff' },
  label: { fontSize: 13, marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 8, marginTop: -2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 16 },
  bookRow: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  modeRow: { gap: 8, marginBottom: 8 },
  modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  paperRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  paperNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  paperMarks: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, textAlign: 'center', fontSize: 14 },
  compChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  checkboxGroup: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16, gap: 4 },
  checkRow: { alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pickerInput: { borderWidth: 1.5, borderRadius: 10, padding: 14, alignItems: 'center' },
  submitBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 10, marginTop: 4 },
});
