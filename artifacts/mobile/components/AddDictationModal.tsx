/**
 * Compose a dictation (إملاء) set by hand, or draw one from the curriculum.
 *
 * Dictation is a *list*, not a question. A teacher dictates ten words, not one,
 * so unlike `AddReadAloudModal` this appends several questions in one press.
 *
 * Two ways in, and they exist for different teachers:
 *
 *   **From a rule** — pick the إملاء rule the unit is on and the bank supplies
 *   the words, the misspellings and the answer key. This is the path that makes
 *   `@workspace/arabic-spelling` worth having: the words come from the
 *   curriculum, vowelled, with distractors that are the confusions the book
 *   teaches rather than whatever a model would invent.
 *
 *   **Own words** — type a list, one per line. Always write mode: a teacher
 *   typing their own list is composing a dictation test, and writing is the
 *   point. Tap-the-spelling is for children too young to type, and those
 *   questions come from a rule, which knows the near misses.
 *
 * No audio anywhere in here. A dictation question with no `audioUrl` means the
 * teacher reads it aloud — which is how إملاء has always been taught, works on
 * a native device where the app cannot play audio at all, and works in a
 * classroom with one screen. Synthesis is an addition to this screen later, not
 * a prerequisite for it.
 *
 * Validation is the server's, as in the read-aloud modal: `QUESTION_TYPES
 * .dictation.validate` owns the rules and a second copy here would be a second
 * thing to keep in step. What this does is show the teacher the words it is
 * about to add, so a surprise is never the first thing they learn.
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
import {
  SPELLING_RULES,
  takeSpellingItems,
  type SpellingItem,
  type SpellingRule,
} from '@workspace/arabic-spelling';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { addEvaluationQuestion, type CompetencyKey, type EvaluationQuestion } from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';
import { palette } from '@/constants/colors';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

/**
 * Mirrors nothing on the server — this is a UI guard, not a rule.
 *
 * The add endpoint takes one question per call, so a forty-word list is forty
 * round trips and a progress bar nobody asked for. Twenty is a long dictation
 * by any measure.
 *
 * ponytail: sequential creates. Add a batch insert if lists routinely hit this.
 */
const MAX_WORDS = 20;

const COMPETENCIES: { key: CompetencyKey; label: TranslationKey }[] = [
  { key: 'knowledge', label: 'competencyKnowledge' },
  { key: 'understanding', label: 'competencyUnderstanding' },
  { key: 'application', label: 'competencyApplication' },
  { key: 'critical_thinking', label: 'competencyCriticalThinking' },
];

type Source = 'rule' | 'own';

/** What the teacher will get, resolved before they press save. */
function itemsFromOwnWords(lines: string[]): SpellingItem[] {
  return lines.map(text => ({
    type: 'dictation' as const,
    body: { mode: 'write', wordCount: text.split(/\s+/).filter(Boolean).length },
    expectedAnswer: { text },
  }));
}

/**
 * The grade number inside a curriculum grade id (`grade-2` → 2).
 *
 * Null rather than a guess when it does not parse: the bank reads a missing
 * grade as "no filter", which is the safe direction — a teacher sees the whole
 * rule and can drop what does not suit, where a wrong number would silently
 * hide words they wanted.
 */
function gradeNumber(gradeId: string | undefined): number | undefined {
  const match = /(\d+)/.exec(gradeId ?? '');
  return match ? Number(match[1]) : undefined;
}

export function AddDictationModal({
  visible,
  onClose,
  evaluationId,
  gradeId,
  objectiveIds,
  onAdded,
}: {
  visible: boolean;
  onClose: () => void;
  evaluationId: string;
  /**
   * The grade this evaluation is for, so the bank does not offer a
   * seven-year-old a word from the grade 5 half of the same rule. The
   * curriculum revisits these rules for years, so a rule spans grades and its
   * words do not.
   */
  gradeId?: string;
  /** The objectives this evaluation was scoped to; the server refuses any other. */
  objectiveIds: string[];
  onAdded: (questions: EvaluationQuestion[], totalMarks: number) => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();

  const [source, setSource] = useState<Source>('rule');
  const [ruleId, setRuleId] = useState(SPELLING_RULES[0]?.id ?? '');
  const [count, setCount] = useState('8');
  const [ownWords, setOwnWords] = useState('');
  const [marks, setMarks] = useState('1');
  const [objectiveId, setObjectiveId] = useState(objectiveIds[0] ?? '');
  const [competency, setCompetency] = useState<CompetencyKey>('knowledge');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const rule: SpellingRule | undefined = useMemo(
    () => SPELLING_RULES.find(r => r.id === ruleId),
    [ruleId],
  );

  const ownLines = useMemo(
    () => ownWords.split('\n').map(l => l.trim()).filter(Boolean).slice(0, MAX_WORDS),
    [ownWords],
  );

  /**
   * The questions this will add, computed now so the teacher sees them.
   *
   * The seed is the rule and the count rather than a clock: asking for the same
   * eight words twice should give the same eight words, or a teacher who
   * reopens the sheet to check something finds a different paper.
   */
  const grade = gradeNumber(gradeId);
  const items = useMemo<SpellingItem[]>(() => {
    if (source === 'own') return itemsFromOwnWords(ownLines);
    if (!rule) return [];
    const n = Math.min(Math.max(1, Number(count) || 0), MAX_WORDS);
    return takeSpellingItems(rule, n, { seed: rule.id.length + n, grade });
  }, [source, ownLines, rule, count, grade]);

  const marksValue = Number(marks);
  const canSave = items.length > 0 && marksValue > 0 && !!objectiveId && !busy;

  async function save() {
    setBusy(true);
    setError('');
    setProgress(0);
    const added: EvaluationQuestion[] = [];
    let total = 0;
    try {
      for (const item of items) {
        const result = await addEvaluationQuestion(evaluationId, {
          type: item.type,
          objectiveId,
          competencyKey: competency,
          marks: marksValue,
          body: item.body,
          expectedAnswer: item.expectedAnswer,
        });
        added.push(result.question);
        total = result.totalMarks;
        setProgress(added.length);
      }
      onAdded(added, total);
      setOwnWords('');
      onClose();
    } catch (err) {
      // Partial success is real and must be reported as such: the questions
      // already added are on the exam, and telling the teacher "failed" would
      // send them to add the whole list again on top of half of it.
      if (added.length > 0) onAdded(added, total);
      setError(
        added.length > 0
          ? t('dictationAddPartial', String(added.length), String(items.length))
          : err instanceof Error ? err.message : t('dictationAddFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  function preview(item: SpellingItem): string {
    if (item.body['mode'] === 'choice' || item.type === 'multiple_choice') {
      const options = (item.body['options'] ?? []) as { text: string }[];
      return options.map(o => o.text).join('  |  ');
    }
    if (item.type === 'true_false') return String(item.body['statement'] ?? '');
    return String(item.expectedAnswer['text'] ?? '');
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row', borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 17 }}>
              {t('dictationAddTitle')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
            <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('dictationReadAloudNote')}
            </Text>

            <View style={{ gap: 8 }}>
              {(['rule', 'own'] as const).map(s => (
                <Pressable
                  key={s}
                  onPress={() => setSource(s)}
                  style={[
                    styles.choice,
                    {
                      borderColor: source === s ? ACCENT : colors.border,
                      backgroundColor: source === s ? ACCENT + '12' : colors.card,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <Ionicons
                    name={source === s ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={source === s ? ACCENT : colors.mutedForeground}
                  />
                  <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, flex: 1 }}>
                    {t(s === 'rule' ? 'dictationSourceRule' : 'dictationSourceOwn')}
                  </Text>
                </Pressable>
              ))}
            </View>

            {source === 'rule' ? (
              <>
                <View style={{ gap: 6 }}>
                  <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('dictationRuleLabel')}
                  </Text>
                  <View style={{ gap: 8 }}>
                    {SPELLING_RULES.map(r => (
                      <Pressable
                        key={r.id}
                        onPress={() => setRuleId(r.id)}
                        style={[
                          styles.choice,
                          {
                            borderColor: ruleId === r.id ? ACCENT : colors.border,
                            backgroundColor: ruleId === r.id ? ACCENT + '12' : colors.card,
                            flexDirection: isRTL ? 'row-reverse' : 'row',
                          },
                        ]}
                      >
                        <Ionicons
                          name={ruleId === r.id ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={ruleId === r.id ? ACCENT : colors.mutedForeground}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' }}>
                            {r.nameAr}
                          </Text>
                          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}>
                            {t('dictationRuleGrades', r.grades.join('، '))}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {rule ? (
                  <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {rule.ruleAr}
                  </Text>
                ) : null}

                <View style={{ gap: 6 }}>
                  <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('dictationCountLabel')}
                  </Text>
                  <TextInput
                    value={count}
                    onChangeText={setCount}
                    keyboardType="numeric"
                    style={[
                      styles.smallInput,
                      { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, textAlign: isRTL ? 'right' : 'left' },
                    ]}
                  />
                </View>
              </>
            ) : (
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('dictationOwnWordsLabel')}
                </Text>
                <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('dictationOwnWordsHint')}
                </Text>
                <TextInput
                  value={ownWords}
                  onChangeText={setOwnWords}
                  multiline
                  placeholder={'مَدْرَسَة\nحَديقَة\nذَهَبَ الوَلَدُ إِلى المَدْرَسَةِ'}
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.wordsInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      textAlign: 'right',
                      writingDirection: 'rtl',
                    },
                  ]}
                />
              </View>
            )}

            {/* What is about to be added. A teacher who cannot see the words
                before pressing save is being asked to trust a bank they have
                never read. */}
            {items.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('dictationPreviewLabel', String(items.length))}
                </Text>
                <View style={[styles.preview, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  {items.map((item, i) => (
                    <Text
                      key={i}
                      style={{
                        color: colors.foreground,
                        fontFamily: 'Almarai_400Regular',
                        fontSize: 15,
                        lineHeight: 28,
                        textAlign: 'right',
                        writingDirection: 'rtl',
                      }}
                    >
                      {`${i + 1}. ${preview(item)}`}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={[styles.label, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('dictationMarksEachLabel')}
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
                      <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22, flex: 1 }}>
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
                    <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, lineHeight: 22 }}>
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
              style={[styles.saveBtn, { backgroundColor: ACCENT_FILL, opacity: canSave ? 1 : 0.5 }]}
            >
              {busy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 14 }}>
                    {t('dictationAddProgress', String(progress), String(items.length))}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
                  {t('dictationAddBtn', String(items.length))}
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
  wordsInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 140,
    fontSize: 15,
    lineHeight: 26,
  },
  smallInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  choice: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  preview: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 16, marginTop: 4 },
});
