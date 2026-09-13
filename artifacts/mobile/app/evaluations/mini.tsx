/**
 * Quick check — three self-marking questions on one objective.
 *
 * The full evaluation screen asks a teacher seven questions before it will
 * generate anything. That is correct for an exam and far too much for the
 * three questions worth asking at the end of a lesson, which is the kind of
 * assessment that actually moves learning (retrieval practice, and a teacher
 * who finds out today rather than at the unit test).
 *
 * So this screen asks one question — which objective — and answers the rest
 * from the preset in `services/miniEval.ts` and from the class itself. A
 * class already knows its grade and subject, so the book does not need asking
 * for; where the class predates those fields (both default to '') it falls back
 * to listing the evaluable books rather than guessing one.
 *
 * **Review is not skipped, it is delegated.** After generating, this hands off
 * to the ordinary evaluation screen, which already shows the questions, the
 * answer-key verification notices, and a publish button. Sending
 * model-written questions to thirty students without a teacher looking at them
 * is the one shortcut that would cost more trust than the feature is worth, and
 * reusing that screen means the quick path cannot drift away from the checks
 * the slow path performs.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  BOOKS,
  getEvaluableBookIds,
  getObjectivesForBook,
  type CurriculumObjective,
} from '@/services/curriculumData';
import {
  EvaluationError,
  createEvaluation,
  generateEvaluation,
  setEvaluationClass,
} from '@/services/evaluations';
import { getClass } from '@/services/roster';
import {
  MINI_EVAL_COUNT,
  MINI_EVAL_DIFFICULTY,
  MINI_EVAL_TYPES,
} from '@/services/miniEval';

const ACCENT = '#1B6B62';

export default function MiniEvalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { classId } = useLocalSearchParams<{ classId?: string }>();

  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [bookChoices, setBookChoices] = useState<{ id: string; titleAr: string; title: string }[]>([]);
  const [objectiveId, setObjectiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // The evaluable set is the same list the server validates against — both
      // read @workspace/curriculum — so a book offered here cannot be refused
      // on create.
      const evaluable = new Set(getEvaluableBookIds());
      let candidates = BOOKS.filter(b => evaluable.has(b.id));
      try {
        if (classId) {
          const { group } = await getClass(classId);
          // Both default to '' on older classes. Narrow only on what is set;
          // an empty filter would leave a teacher with no books and no reason.
          const scoped = candidates.filter(
            b =>
              (!group.gradeId || b.gradeId === group.gradeId) &&
              (!group.subjectId || b.subjectId === group.subjectId),
          );
          if (scoped.length > 0) candidates = scoped;
        }
      } catch {
        // A roster failure must not empty the book list — the teacher can still
        // pick one by hand, which is what an unscoped class gets anyway.
      }
      if (cancelled) return;
      setBookChoices(candidates.map(b => ({ id: b.id, titleAr: b.titleAr, title: b.title })));
      if (candidates.length === 1) setBookId(candidates[0]!.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const objectives: CurriculumObjective[] = useMemo(
    () => (bookId ? getObjectivesForBook(bookId) : []),
    [bookId],
  );

  const onGenerate = useCallback(async () => {
    if (!bookId || !objectiveId) return;
    setError('');
    setWorking(true);
    try {
      const evaluation = await createEvaluation({
        bookId,
        objectiveIds: [objectiveId],
        assessmentTypes: [...MINI_EVAL_TYPES],
        targetQuestionCount: MINI_EVAL_COUNT,
        difficulty: MINI_EVAL_DIFFICULTY,
      });
      // Attached now, not later. The full flow attaches after authoring and
      // used to strand teachers on a share card that named the problem and
      // offered no way to fix it — and a quick check has a class in hand
      // already, so there is nothing to defer.
      if (classId) {
        try {
          await setEvaluationClass(evaluation.id, classId);
        } catch {
          // The evaluation exists and is worth keeping; the detail screen can
          // attach it. Losing the draft over this would be the worse trade.
        }
      }
      const result = await generateEvaluation(evaluation.id);

      /*
        The mock generator cannot produce any of the four types this screen
        asks for — `pickType` in mockGenerator.ts offers open-response types
        only, on purpose, because inventing MCQ distractors means inventing
        subject content. So with live generation off a quick evaluation comes
        back empty, every time.

        Say that here rather than dropping the teacher onto a nought-question
        draft. The review screen does surface the generator's own warning, but
        it reads "add an open-response type, or switch to a real model" — sound
        advice on the full screen, which has a type picker, and impossible
        advice here, which deliberately does not.
      */
      if (result.produced === 0) {
        setError(t('miniEvalNeedsLiveAi'));
        setWorking(false);
        return;
      }

      const warnings = result.warnings ?? [];
      router.replace({
        pathname: '/evaluations/[id]',
        params: {
          id: evaluation.id,
          ...(warnings.length ? { warnings: warnings.join('\n') } : {}),
        },
      });
    } catch (err) {
      if (err instanceof EvaluationError && err.code === 'no_level_scale') {
        setError(t('evaluationSetupNotReady'));
      } else {
        setError(err instanceof EvaluationError ? err.message : t('miniEvalFailed'));
      }
      setWorking(false);
    }
  }, [bookId, objectiveId, classId, t]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
          hitSlop={10}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]}>
          {t('miniEvalTitle')}
        </Text>
        <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('miniEvalSubtitle')}
        </Text>
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.destructive, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
            {error}
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
      ) : bookChoices.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {t('miniEvalNoObjectives')}
        </Text>
      ) : (
        <View style={{ padding: 20, gap: 8 }}>
          {/* Only shown when the class did not narrow it to one. */}
          {bookChoices.length > 1 && (
            <View style={{ gap: 8, marginBottom: 8 }}>
              {bookChoices.map(b => {
                const selected = b.id === bookId;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      setBookId(b.id);
                      setObjectiveId(null);
                    }}
                    style={[
                      styles.row,
                      {
                        borderColor: selected ? ACCENT : colors.border,
                        backgroundColor: selected ? ACCENT + '12' : colors.card,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'Cairo_500Medium', fontSize: 14, textAlign: align }}>
                      {lang === 'ar' ? b.titleAr : b.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
            {t('miniEvalPickObjective')}
          </Text>

          {/*
            Two different empty states, because they have two different causes
            and one of them is the teacher's next tap. With more than one book
            in scope none is preselected, and saying "no objectives for this
            class" there names the wrong cause entirely — the objectives are
            fine, the book just has not been chosen yet.
          */}
          {!bookId ? (
            <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('miniEvalPickBookFirst')}
            </Text>
          ) : objectives.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('miniEvalNoObjectives')}
            </Text>
          ) : (
            objectives.map(o => {
              const selected = o.id === objectiveId;
              return (
                <Pressable
                  key={o.id}
                  // One objective, not a set: three questions spread over two
                  // objectives is not enough evidence about either, and the
                  // server would honestly report nothing for both.
                  onPress={() => setObjectiveId(selected ? null : o.id)}
                  style={[
                    styles.row,
                    {
                      borderColor: selected ? ACCENT : colors.border,
                      backgroundColor: selected ? ACCENT + '12' : colors.card,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 10,
                    },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? ACCENT : colors.mutedForeground}
                  />
                  <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, flex: 1, textAlign: align }}>
                    {(lang === 'ar' ? o.descriptionAr : o.description) || o.description}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {bookChoices.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 8 }}>
          <Pressable
            onPress={() => void onGenerate()}
            disabled={!objectiveId || working}
            style={[
              styles.cta,
              {
                backgroundColor: ACCENT,
                opacity: !objectiveId || working ? 0.5 : 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            {working ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="flash-outline" size={18} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>
              {working ? t('miniEvalGenerating') : t('miniEvalGenerate')}
            </Text>
          </Pressable>
          <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
            {t('miniEvalReviewHint')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  headerTitle: { color: '#fff', fontSize: 20 },
  headerSub: { color: '#fff', opacity: 0.9, fontSize: 13 },
  errorBox: {
    margin: 20,
    marginBottom: 0,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
    alignItems: 'center',
  },
  label: { fontSize: 14, marginBottom: 4 },
  hint: { fontSize: 12 },
  empty: { padding: 20, fontSize: 13 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12 },
  cta: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
