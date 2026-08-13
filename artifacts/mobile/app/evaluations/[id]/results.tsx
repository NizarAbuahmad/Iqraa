/**
 * Results dashboard — every student's attempt at this evaluation, at a glance.
 *
 * Reuses `listAttempts`, the same endpoint the answer-entry picker already
 * calls — no new backend work. The class summary (level distribution, mean
 * percent) is computed client-side from that same list, over graded attempts
 * only: a student still `not_started` or mid-entry has no percent to average
 * in, and folding them in as zeros would understate the class rather than
 * honestly say fewer students have been assessed than are on the roster.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  EvaluationError,
  getEvaluation,
  listAttempts,
  type AttemptListRow,
  type AttemptStatus,
  type Evaluation,
  type LevelKey,
} from '@/services/evaluations';
import type { TranslationKey } from '@/services/i18n';

const ACCENT = '#1B6B62';

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
  not_started: '#9CA3AF',
  in_progress: '#F59E0B',
  submitted: '#3B82F6',
  grading: '#3B82F6',
  graded: '#10B981',
  needs_review: '#EF4444',
  abandoned: '#9CA3AF',
};
const LEVEL_ORDER: LevelKey[] = ['advanced', 'proficient', 'developing', 'beginner'];
const LEVEL_KEY: Record<LevelKey, TranslationKey> = {
  beginner: 'levelBeginner',
  developing: 'levelDeveloping',
  proficient: 'levelProficient',
  advanced: 'levelAdvanced',
};
const LEVEL_COLOR: Record<LevelKey, string> = {
  beginner: '#EF4444',
  developing: '#F59E0B',
  proficient: '#10B981',
  advanced: '#059669',
};

export default function ResultsDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [attempts, setAttempts] = useState<AttemptListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setError('');
    try {
      const [{ evaluation: ev }, rows] = await Promise.all([getEvaluation(id), listAttempts(id)]);
      setEvaluation(ev);
      setAttempts(rows);
    } catch (err) {
      setError(err instanceof EvaluationError ? err.message : t('evaluationLoadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const graded = useMemo(() => attempts.filter(a => a.result && Number(a.result.totalMarks) > 0), [attempts]);
  const meanPercent = useMemo(() => {
    if (graded.length === 0) return null;
    const sum = graded.reduce((s, a) => s + Number(a.result!.percent), 0);
    return Math.round((sum / graded.length) * 100) / 100;
  }, [graded]);
  const levelCounts = useMemo(() => {
    const counts = { beginner: 0, developing: 0, proficient: 0, advanced: 0 } as Record<LevelKey, number>;
    for (const a of graded) {
      if (a.result?.levelKey) counts[a.result.levelKey] += 1;
    }
    return counts;
  }, [graded]);
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
      <View style={[styles.header, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Cairo_700Bold', textAlign: align }]} numberOfLines={1}>
          {t('resultsDashboardTitle')}
        </Text>
        <Text style={[styles.headerSub, { fontFamily: 'Almarai_400Regular', textAlign: align, color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
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
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
                  {t('gradedCountLabel', graded.length, attempts.length)}
                </Text>
                {meanPercent !== null && (
                  <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16, marginLeft: isRTL ? 0 : 'auto', marginRight: isRTL ? 'auto' : 0 }}>
                    {t('classAverageLabel')}: {t('resultPercentLabel', String(meanPercent))}
                  </Text>
                )}
              </View>

              {graded.length > 0 && (
                <View style={{ marginTop: 14, gap: 8 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12, textAlign: align }}>
                    {t('levelDistributionLabel')}
                  </Text>
                  {LEVEL_ORDER.map(key => {
                    const count = levelCounts[key];
                    const widthPct = (count / maxLevelCount) * 100;
                    return (
                      <View key={key} style={[styles.levelBarRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text style={{ width: 70, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                          {t(LEVEL_KEY[key])}
                        </Text>
                        <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                          <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: LEVEL_COLOR[key] }]} />
                        </View>
                        <Text style={{ width: 20, color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12, textAlign: 'center' }}>
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                {t('noAttemptsYet')}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                {t('noAttemptsYetDesc')}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/evaluations/[id]/answers/[studentId]', params: { id: id as string, studentId: item.studentId } })}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 15, textAlign: align }}>
                {item.studentName}
              </Text>
              {item.result && Number(item.result.totalMarks) > 0 && (
                <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginTop: 4 }]}>
                  {item.result.levelKey && (
                    <Text style={{ color: LEVEL_COLOR[item.result.levelKey], fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>
                      {t(LEVEL_KEY[item.result.levelKey])}
                    </Text>
                  )}
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
                    {t('resultPercentLabel', item.result.percent)}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[item.status] + '20' }]}>
              <Text style={{ color: STATUS_COLOR[item.status], fontFamily: 'Cairo_600SemiBold', fontSize: 11 }}>
                {t(STATUS_KEY[item.status])}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  headerTitle: { fontSize: 22, color: '#fff' },
  headerSub: { fontSize: 13 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 16 },
  summaryTop: { alignItems: 'center' },
  levelBarRow: { alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  row: { alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 17 },
  emptyText: { fontSize: 14, maxWidth: 280, lineHeight: 20 },
});
