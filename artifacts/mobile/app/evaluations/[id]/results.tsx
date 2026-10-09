/**
 * Results dashboard — every student's attempt at this evaluation, at a glance.
 *
 * The level distribution and mean percent come from `listAttempts`, computed
 * client-side. **What the class missed** does not: `getClassInsights` sums
 * marks per objective across every marked attempt server-side, because a mean
 * of per-student percentages ranks the class's real problem below a rounding
 * error — twenty students losing 1 of 2 marks is not the same picture as one
 * losing 9 of 10.
 *
 * The client-side summary is over *finished* papers only — see
 * `services/attemptSummary.ts` for the rule and its tests. A student still
 * `not_started` or mid-entry has no percent to average in, and folding them in
 * as zeros would understate the class rather than honestly say fewer students
 * have been assessed than are on the roster. The opposite error is the one
 * that actually shipped: a link submission is auto-marked on arrival and
 * carries a result scored over only the questions the machine could mark, so
 * counting it here read 100%/`proficient` off a paper with six answers still
 * unmarked. Those are counted and named on their own line instead.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  EvaluationError,
  getClassInsights,
  getEvaluation,
  listAttempts,
  setMasteryUnlock,
  type AttemptListRow,
  type AttemptStatus,
  type ClassInsights,
  type Evaluation,
  type LevelKey,
  type Recommendation,
} from '@/services/evaluations';
import {
  buildGapWarmupRequest,
  lessonPickerParams,
  lessonPrepPickerIndices,
  scopePickerParams,
} from '@/services/lessonPrep';
import { summariseAttempts } from '@/services/attemptSummary';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { saveItem } from '@/services/workspace';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';
import { ACTIVITY_TYPE_IDS } from '@/constants/activityType';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

const STATUS_KEY: Record<AttemptStatus, TranslationKey> = {
  not_started: 'attemptStatusNotStarted',
  in_progress: 'attemptStatusInProgress',
  submitted: 'attemptStatusSubmitted',
  grading: 'attemptStatusGrading',
  graded: 'attemptStatusGraded',
  needs_review: 'attemptStatusNeedsReview',
  abandoned: 'attemptStatusAbandoned',
};
const STATUS_COLOR: Record<AttemptStatus, string> = {
  not_started: '#6B7280',
  in_progress: palette.warning,
  submitted: palette.info,
  grading: palette.info,
  graded: palette.success,
  needs_review: palette.destructive,
  abandoned: '#6B7280',
};
const LEVEL_ORDER: LevelKey[] = ['advanced', 'proficient', 'developing', 'beginner'];
const LEVEL_KEY: Record<LevelKey, TranslationKey> = {
  beginner: 'levelBeginner',
  developing: 'levelDeveloping',
  proficient: 'levelProficient',
  advanced: 'levelAdvanced',
};
const LEVEL_COLOR: Record<LevelKey, string> = {
  beginner: palette.destructive,
  developing: palette.warning,
  proficient: palette.success,
  advanced: palette.success,
};

/** Keyed on the evaluation id: each evaluation's results are cached separately. */
function evaluationResultsQueryKey(id: string) {
  return ['evaluationResults', id] as const;
}
/**
 * This screen is stack-pushed from the evaluation, so revisiting it (check
 * results, go back, come back) used to re-earn all three calls over the
 * network every time. A minute of cache lets a quick back-and-forth repaint
 * instantly from the last fetch, same as `classes/index.tsx`.
 */
const EVALUATION_RESULTS_STALE_MS = 60_000;

type EvaluationResultsData = {
  evaluation: Evaluation;
  attempts: AttemptListRow[];
  insights: ClassInsights;
  nextSteps: Recommendation[];
  scope: { gradeId: string; subjectId: string; bookId: string };
};

export default function ResultsDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    data,
    isLoading: loading,
    isError,
    error: loadErrorRaw,
    refetch,
  } = useQuery({
    queryKey: evaluationResultsQueryKey(id ?? ''),
    queryFn: async (): Promise<EvaluationResultsData> => {
      const [{ evaluation: ev }, rows, classView] = await Promise.all([
        getEvaluation(id as string),
        listAttempts(id as string),
        getClassInsights(id as string),
      ]);
      return {
        evaluation: ev,
        attempts: rows,
        insights: classView.insights,
        nextSteps: classView.recommendations,
        scope: classView.scope,
      };
    },
    enabled: !!id,
    staleTime: EVALUATION_RESULTS_STALE_MS,
  });
  const [unlockBusy, setUnlockBusy] = useState<string | null>(null);
  /** The student whose last unlock attempt failed, so the message sits on their row. */
  const [unlockFailedFor, setUnlockFailedFor] = useState<string | null>(null);
  const onUnlock = async (studentId: string, unlocked: boolean) => {
    setUnlockBusy(studentId);
    setUnlockFailedFor(null);
    try {
      await setMasteryUnlock(id as string, studentId, unlocked);
      await refetch();
    } catch {
      setUnlockFailedFor(studentId);
    } finally {
      setUnlockBusy(null);
    }
  };
  const evaluation = data?.evaluation ?? null;
  const attempts = data?.attempts ?? [];
  const insights = data?.insights ?? null;
  const nextSteps = data?.nextSteps ?? [];
  const scope = data?.scope ?? null;
  const error = isError
    ? (loadErrorRaw instanceof EvaluationError ? loadErrorRaw.message : t('evaluationLoadFailed'))
    : '';

  const { gradedCount, provisionalCount, meanPercent, levelCounts } = useMemo(
    () => summariseAttempts(attempts),
    [attempts],
  );
  const maxLevelCount = Math.max(1, ...LEVEL_ORDER.map(k => levelCounts[k]));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={() => goBack()} hitSlop={10} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]} numberOfLines={1}>
          {t('resultsDashboardTitle')}
        </Text>
        <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align, color: 'rgba(255,255,255,0.95)' }]} numberOfLines={1}>
          {evaluation ? (lang === 'ar' ? evaluation.titleAr : evaluation.title) || t('newEvaluation') : ''}
        </Text>
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.destructive, margin: 20, marginBottom: 0 }]}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', flex: 1, textAlign: align }}>
            {error}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={attempts}
        keyExtractor={a => a.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListHeaderComponent={
          attempts.length === 0 ? null : (
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
              <View style={[styles.summaryTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, lineHeight: 24 }}>
                    {t('gradedCountLabel', gradedCount, attempts.length)}
                  </Text>
                  {/* Named rather than folded in: these papers carry a result
                      the machine wrote over the questions it could mark, and
                      averaging that in would flatter the class. */}
                  {provisionalCount > 0 && (
                    <Text style={{ color: palette.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 2 }}>
                      {t('provisionalCountLabel', provisionalCount)}
                    </Text>
                  )}
                </View>
                {meanPercent !== null && (
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 16, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
                    {t('classAverageLabel')}: {t('resultPercentLabel', String(meanPercent))}
                  </Text>
                )}
              </View>

              {gradedCount > 0 && (
                <View style={{ marginTop: 14, gap: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12, textAlign: align }}>
                    {t('levelDistributionLabel')}
                  </Text>
                  {LEVEL_ORDER.map(key => {
                    const count = levelCounts[key];
                    const widthPct = (count / maxLevelCount) * 100;
                    return (
                      <View key={key} style={[styles.levelBarRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text style={{ width: 70, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
                          {t(LEVEL_KEY[key])}
                        </Text>
                        <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                          <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: LEVEL_COLOR[key] }]} />
                        </View>
                        <Text style={{ width: 20, color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12, textAlign: 'center' }}>
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {insights && insights.objectiveScores.length > 0 && (
                <ClassGaps
                  insights={insights}
                  recommendations={nextSteps}
                  scope={scope}
                  colors={colors}
                  isRTL={isRTL}
                  align={align}
                  lang={lang}
                  t={t}
                />
              )}
            </View>
          )
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t('noAttemptsYet')}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                {t('noAttemptsYetDesc')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/evaluations/[id]/answers/[studentId]', params: { id: id as string, studentId: item.studentId } })}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: align }}>
                {item.studentName}
              </Text>
              {item.result && Number(item.result.totalMarks) > 0 && (
                <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 4 }]}>
                  {item.result.levelKey && (
                    <Text style={{ color: LEVEL_COLOR[item.result.levelKey], fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>
                      {t(LEVEL_KEY[item.result.levelKey])}
                    </Text>
                  )}
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21 }}>
                    {t('resultPercentLabel', item.result.percent)}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
              <Text style={{ color: STATUS_COLOR[item.status], fontFamily: 'ReadexPro_600SemiBold', fontSize: 11 }}>
                {t(STATUS_KEY[item.status])}
              </Text>
            </View>
          </Pressable>
          {/* Beside the row, not inside it: the row is a button, and a button
              inside a button is invalid on the web build. */}
          {item.masteryUnlock && item.masteryUnlock !== 'none' ? (
            <View
              style={[
                styles.unlockBar,
                { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
                {unlockFailedFor === item.studentId
                  ? t('masteryUnlockFailed')
                  : item.masteryUnlock === 'granted'
                    ? t('masteryUnlockGranted')
                    : t('masteryStudentNotPassed')}
              </Text>
              <Pressable
                onPress={() => void onUnlock(item.studentId, item.masteryUnlock === 'available')}
                disabled={unlockBusy === item.studentId}
                accessibilityRole="button"
                style={[styles.unlockBtn, { backgroundColor: item.masteryUnlock === 'granted' ? colors.muted : ACCENT, opacity: unlockBusy === item.studentId ? 0.6 : 1 }]}
              >
                {unlockBusy === item.studentId ? (
                  <ActivityIndicator size="small" color={item.masteryUnlock === 'granted' ? colors.foreground : '#fff'} />
                ) : (
                  <Text style={{ color: item.masteryUnlock === 'granted' ? colors.foreground : '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                    {item.masteryUnlock === 'granted' ? t('masteryUnlockUndo') : t('masteryUnlockBtn')}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
          </View>
        )}
      />
    </View>
  );
}

/** Beyond this a teacher is reading an inventory, not a plan. */
const MAX_CLASS_GAPS = 4;

/**
 * What the class as a whole missed.
 *
 * Two numbers per objective, and they are not redundant. The percentage is the
 * class's marks on that objective; the count is how many students were under
 * water on it. They disagree in the case that matters most — "62%, 14 of 26
 * students below" is a reteach for the room, "62%, 3 students below" is three
 * conversations — and showing only the first would hide which one it is.
 */
function ClassGaps({
  insights, recommendations, scope, colors, isRTL, align, lang, t,
}: {
  insights: ClassInsights;
  recommendations: Recommendation[];
  scope: { gradeId: string; subjectId: string } | null;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  lang: string;
  t: (key: TranslationKey, ...args: any[]) => string;
}) {
  // Indices against the same bare picker lists the worksheet screen rebuilds —
  // see scopePickerParams: a grade-filtered list here would drift from the
  // receiver the day INVESTOR_MVP_CURRICULUM stops flattening the argument.
  const pickerParams = scope ? scopePickerParams(scope.gradeId, scope.subjectId) : null;
  const canGenerate = pickerParams !== null;

  const worst = insights.objectiveScores.slice(0, MAX_CLASS_GAPS);
  // One tap from "the class missed X" to a warm-up on X, saved and opened on
  // the activity screen. Built on the worst objective's own lesson so the
  // offline generator (which picks by topic) actually changes what it serves.
  const gap = worst[0] ? buildGapWarmupRequest(worst[0].objectiveId, lang as 'ar' | 'en') : null;
  const [warming, setWarming] = useState(false);
  const [warmError, setWarmError] = useState('');
  const startWarmup = async () => {
    if (!gap) return;
    setWarming(true); setWarmError('');
    try {
      const out = await aiService.generateActivity(gap.request);
      const { gradeIdx, subjectIdx } = lessonPrepPickerIndices(gap.context);
      const topic = gap.context.topic;
      const saved = await saveItem({
        type: 'activity',
        title: lang === 'ar' ? `تهيئة: ${topic}` : `Warm-up: ${topic}`,
        subject: gap.context.subjectName,
        grade: gap.context.gradeName,
        topic,
        language: lang as 'ar' | 'en',
        content: JSON.stringify(out),
        formState: {
          gradeIdx, subjectIdx, topic,
          activityTypeIdx: ACTIVITY_TYPE_IDS.indexOf('group'),
          // The form's shortest length (20 min) — it has no 8-minute option.
          durationIdx: 0,
          objective: '',
        },
      });
      // ponytail: Regenerate on the activity screen rebuilds this as a plain
      // 20-minute group activity — its form has no warm-up slot. Add a `variant=warmup`
      // route param there if teachers turn out to regenerate warm-ups.
      router.push({
        pathname: '/ai-tools/activity',
        params: { savedId: saved.id, topic, ...lessonPickerParams(gap.context.lessonId, lang as 'ar' | 'en') },
      });
    } catch {
      setWarmError(t('generationFailed'));
    } finally {
      setWarming(false);
    }
  };
  const top = recommendations.find(r => r.kind !== 'reassess');
  const topTitle = top
    ? (lang === 'ar' ? top.payload.objectiveTitleAr : top.payload.objectiveTitle) ||
      top.payload.objectiveTitleAr
    : '';

  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: align }}>
        {t('classGapsTitle')}
      </Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: align }}>
        {t('classGapsHint', String(insights.studentCount))}
      </Text>

      {worst.map(o => {
        const title = (lang === 'ar' ? o.titleAr : o.title) || o.titleAr || o.objectiveId;
        const weak = o.percent < 60;
        return (
          <View key={o.objectiveId} style={{ gap: 4 }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: weak ? palette.destructive : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>
                {t('resultPercentLabel', String(o.percent))}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18 }}>
                {t('classBelowLine', String(o.studentsBelowGap), String(o.studentCount))}
              </Text>
            </View>
            <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
              {title}
            </Text>
          </View>
        );
      })}

      {canGenerate && topTitle ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/ai-tools/worksheet',
              params: { topic: topTitle, ...pickerParams },
            })
          }
          style={[styles.classGapBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="document-text-outline" size={14} color={ACCENT} />
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
            {t('classGapWorksheet')}
          </Text>
        </Pressable>
      ) : null}

      {gap ? (
        <Pressable
          onPress={() => { void startWarmup(); }}
          disabled={warming}
          accessibilityRole="button"
          style={[styles.classGapBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: warming ? 0.7 : 1 }]}
        >
          {warming
            ? <ActivityIndicator size="small" color={ACCENT} />
            : <Ionicons name="flash-outline" size={14} color={ACCENT} />}
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
            {t('classGapWarmup')}
          </Text>
        </Pressable>
      ) : null}
      {warmError ? (
        <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: align }}>
          {warmError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 14, gap: 8 },
  headerTitle: { fontSize: 22, color: '#fff' },
  headerSub: { fontSize: 15, lineHeight: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  summaryTop: { alignItems: 'center' },
  classGapBtn: { alignSelf: 'flex-start', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  levelBarRow: { alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  row: { alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  unlockBar: { alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  unlockBtn: { alignSelf: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17 },
  emptyText: { fontSize: 15, maxWidth: 280, lineHeight: 21 },
});
