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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  BOOKS,
  getEvaluableBookIds,
  getObjectiveById,
  getObjectivesForBook,
  type CurriculumObjective,
} from '@/services/curriculumData';
import {
  EvaluationError,
  createEvaluation,
  generateEvaluation,
  setEvaluationAudience,
  setEvaluationClass,
} from '@/services/evaluations';
import { getClass } from '@/services/roster';
import { groupSizeLabel, parseStudentIds } from '@/services/supportGroups';
import { trackEvent } from '@/services/analytics';
import {
  MINI_EVAL_COUNT,
  MINI_EVAL_DIFFICULTY,
  MINI_EVAL_TYPES,
  groupObjectivesByLesson,
  miniEvalPreset,
} from '@/services/miniEval';
import { palette } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { narrowBooksToTeacher } from '@/services/teacherCatalogFilter';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

export default function MiniEvalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { classId, objectiveId: presetObjectiveId, studentIds: rawStudentIds } = useLocalSearchParams<{ classId?: string; objectiveId?: string; studentIds?: string }>();
  const groupIds = useMemo(() => parseStudentIds(rawStudentIds), [rawStudentIds]);
  const isGroup = groupIds.length > 0 && !!classId;
  // A ref: the profile narrows the book list once on load, and a refreshed user
  // object must not reset a book the teacher has already picked.
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const [loading, setLoading] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [bookChoices, setBookChoices] = useState<{ id: string; titleAr: string; title: string }[]>([]);
  const [lessonId, setLessonId] = useState<string | null>(null);
  /**
   * Set only by the student record's «تحقق سريع», which opens here aimed at one
   * objective. It narrows the check to that objective; picking any lesson by hand
   * clears it, so the lesson picker always means the whole lesson.
   */
  const [onlyObjectiveId, setOnlyObjectiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [groupNames, setGroupNames] = useState<{ id: string; name: string }[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(groupIds));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // The evaluable set is the same list the server validates against — both
      // read @workspace/curriculum — so a book offered here cannot be refused
      // on create.
      const evaluable = new Set(getEvaluableBookIds());
      let candidates = BOOKS.filter(b => evaluable.has(b.id));
      let classScoped = false;
      // Applied only after the staleness check below: a load for a class the
      // teacher has already left must not put its names on this screen.
      let inGroup: { id: string; name: string }[] | null = null;
      try {
        if (classId) {
          const { group, students: roster } = await getClass(classId);
          if (groupIds.length) {
            // Names from the class itself: an id in the link that is no longer
            // in the class is simply not offered.
            const inClass = roster.filter(s => groupIds.includes(s.id));
            inGroup = inClass.map(s => ({ id: s.id, name: s.displayName }));
          }
          // Both default to '' on older classes. Narrow only on what is set;
          // an empty filter would leave a teacher with no books and no reason.
          const scoped = candidates.filter(
            b =>
              (!group.gradeId || b.gradeId === group.gradeId) &&
              (!group.subjectId || b.subjectId === group.subjectId),
          );
          if (scoped.length > 0) {
            candidates = scoped;
            classScoped = true;
          }
        }
      } catch {
        // A roster failure must not empty the book list — the teacher can still
        // pick one by hand, which is what an unscoped class gets anyway.
      }
      if (cancelled) return;
      // A class with its own grade + subject is the stronger signal; otherwise
      // offer only the grades and subjects picked in the teacher's profile.
      if (!classScoped) {
        const u = userRef.current;
        candidates = narrowBooksToTeacher(candidates, u?.gradeIds, u?.subjectIds, u?.teachingAssignments);
      }
      if (inGroup) {
        setGroupNames(inGroup);
        setTicked(new Set(inGroup.map(s => s.id)));
      }
      setBookChoices(candidates.map(b => ({ id: b.id, titleAr: b.titleAr, title: b.title })));
      const preset = miniEvalPreset(presetObjectiveId, candidates.map(b => b.id), getObjectiveById);
      if (preset) {
        setBookId(preset.bookId);
        setOnlyObjectiveId(preset.objectiveId);
        setLessonId(getObjectiveById(preset.objectiveId)?.lessonId ?? null);
      } else if (candidates.length === 1) {
        setBookId(candidates[0]!.id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, presetObjectiveId, rawStudentIds]);

  const objectives: CurriculumObjective[] = useMemo(
    () => (bookId ? getObjectivesForBook(bookId) : []),
    [bookId],
  );
  // Shown under lesson headings, so the teacher can see which lesson the check
  // is for — the lesson is what the mastery gate unlocks.
  const lessonGroups = useMemo(() => groupObjectivesByLesson(objectives), [objectives]);
  const selectedGroup = lessonId ? lessonGroups.find(g => g.lessonId === lessonId) : undefined;

  const onGenerate = useCallback(async () => {
    if (!bookId || !selectedGroup) return;
    if (isGroup && ticked.size === 0) { setError(t('miniEvalGroupNoneTicked')); return; }
    setError('');
    setWorking(true);
    try {
      const evaluation = await createEvaluation({
        bookId,
        objectiveIds: onlyObjectiveId ? [onlyObjectiveId] : selectedGroup.objectives.map(o => o.id),
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
          // attach it. Losing the draft over this would be the worse trade —
          // except for a group check, whose students are checked against the
          // class: without it the draft would be class-wide.
          if (isGroup) {
            setError(t('supportGroupClassFailed'));
            setWorking(false);
            return;
          }
        }
      }
      if (isGroup) {
        // Before generating: a failed audience must not leave a class-wide
        // draft behind with its questions already written.
        try {
          await setEvaluationAudience(evaluation.id, [...ticked]);
        } catch {
          setError(t('supportGroupAudienceFailed'));
          setWorking(false);
          return;
        }
        trackEvent('support_group_check_created', { members: ticked.size });
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
        setError(t('miniEvalFailed'));
      }
      setWorking(false);
    }
  }, [bookId, selectedGroup, onlyObjectiveId, classId, isGroup, ticked, t]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
    >
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.headerTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
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

      {isGroup && groupNames.length > 0 ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
            {t('miniEvalWhoSits')} · {groupSizeLabel(ticked.size, lang === 'ar' ? 'ar' : 'en')}
          </Text>
          {groupNames.map(s => {
            const on = ticked.has(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => setTicked(prev => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                  return next;
                })}
                accessibilityRole="checkbox"
                aria-checked={on}
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? ACCENT : colors.mutedForeground} />
                <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, textAlign: align, flex: 1 }}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
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
                      setLessonId(null);
                      setOnlyObjectiveId(null);
                    }}
                    style={[
                      styles.row,
                      {
                        borderColor: selected ? ACCENT : colors.border,
                        backgroundColor: selected ? palette.selected : colors.card,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}>
                      {lang === 'ar' ? b.titleAr : b.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
            {t(bookId ? 'miniEvalPickLesson' : 'miniEvalPickBook')}
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
            lessonGroups.map((g, i) => {
              const selected = g.lessonId === lessonId;
              return (
                <View key={g.lessonId} style={{ gap: 8 }}>
                  {i === 0 || lessonGroups[i - 1]!.unitId !== g.unitId ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align, marginTop: 10 }}>
                      {(lang === 'ar' ? g.unitNameAr : g.unitName) || g.unitName}
                    </Text>
                  ) : null}
                  <Pressable
                    // One lesson: the check covers every objective the lesson lists.
                    onPress={() => {
                      setLessonId(selected ? null : g.lessonId);
                      setOnlyObjectiveId(null);
                    }}
                    style={[
                      styles.row,
                      {
                        borderColor: selected ? ACCENT : colors.border,
                        backgroundColor: selected ? palette.selected : colors.card,
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
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 15, lineHeight: 24, flex: 1, textAlign: align }}>
                      {(lang === 'ar' ? g.lessonTitleAr : g.lessonTitle) || g.lessonTitle}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      )}

      {bookChoices.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 8 }}>
          {selectedGroup ? (
            <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13, lineHeight: 21, textAlign: align }}>
              {t('miniEvalLessonHint', (lang === 'ar' ? selectedGroup.lessonTitleAr : selectedGroup.lessonTitle) || selectedGroup.lessonTitle)}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void onGenerate()}
            disabled={!selectedGroup || working}
            style={[
              styles.cta,
              {
                backgroundColor: ACCENT_FILL,
                opacity: !selectedGroup || working ? 0.5 : 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            {working ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="flash-outline" size={18} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
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
  header: { paddingHorizontal: 20, paddingBottom: 14, gap: 6 },
  headerTitle: { color: '#fff', fontSize: 20 },
  headerSub: { color: '#fff', opacity: 0.9, fontSize: 15, lineHeight: 24 },
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
  hint: { fontSize: 13, lineHeight: 21 },
  empty: { padding: 20, fontSize: 15, lineHeight: 24 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12 },
  cta: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
