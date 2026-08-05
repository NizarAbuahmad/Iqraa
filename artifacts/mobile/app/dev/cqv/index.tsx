import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  SCORE_DIMENSION_KEYS,
  SCORE_DIMENSION_LABELS,
  curriculumProgressMarkdown,
  downloadMarkdown,
  getAllReports,
  getCqvScope,
  getCurriculumProgress,
  getImprovementQueue,
  getLessonProgress,
  groupCqvLessonsBySemester,
  isCqvEnabled,
  type CqvLessonRef,
  type CqvReport,
  type ImprovementItem,
  type SemesterProgress,
} from '@/services/cqv';

const NAVY = '#081B3A';
const TEAL = '#00A99D';
const WARN = '#B45309';
const DANGER = '#DC2626';

function fmt(n: number | null) {
  return n == null ? '—' : n.toFixed(1);
}

function SemesterCard({ data }: { data: SemesterProgress }) {
  return (
    <View style={styles.semCard}>
      <Text style={styles.semTitle}>{data.label}</Text>
      <Text style={styles.semLine}>
        Lessons validated:{' '}
        <Text style={styles.semStrong}>
          {data.lessonsValidated} / {data.lessonsTotal}
        </Text>
      </Text>
      <Text style={styles.semLine}>
        Artifacts completed:{' '}
        <Text style={styles.semStrong}>
          {data.artifactsCompleted} / {data.artifactsTotal}
        </Text>
      </Text>
      <Text style={styles.semLine}>
        Overall completion:{' '}
        <Text style={styles.semStrong}>{data.overallCompletionPct}%</Text>
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${data.overallCompletionPct}%` as any }]} />
      </View>
    </View>
  );
}

function QualityDashboard({
  progress,
}: {
  progress: ReturnType<typeof getCurriculumProgress>;
}) {
  const { averages, belowThresholdCount, lessonsBlockedByMetric, thresholds } = progress;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Quality dashboard</Text>
      <Text style={styles.cardHint}>
        Averages from completed reviews · per-metric targets from CQV thresholds config
      </Text>
      {SCORE_DIMENSION_KEYS.map(key => {
        const v = averages[key];
        const need = thresholds[key];
        const blocked = lessonsBlockedByMetric[key];
        const low = v != null && v < need;
        return (
          <View key={key} style={styles.metricBlock}>
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, low && styles.metricLow]}>
                {SCORE_DIMENSION_LABELS[key]}
              </Text>
              <Text style={[styles.metricValue, low && styles.metricLow]}>
                {fmt(v)}{low ? ' ⚠' : ''}
              </Text>
            </View>
            <Text style={[styles.metricMeta, low && styles.metricLow]}>
              need ≥ {need} · {blocked} lesson{blocked === 1 ? '' : 's'} blocked
            </Text>
          </View>
        );
      })}
      <View style={[styles.metricRow, styles.metricOverall]}>
        <Text style={styles.metricLabelBold}>Overall average</Text>
        <Text style={styles.metricValueBold}>{fmt(averages.overall)}</Text>
      </View>
      {belowThresholdCount > 0 ? (
        <Text style={styles.warnBanner}>
          {belowThresholdCount} score cell(s) below configured thresholds
        </Text>
      ) : (
        <Text style={styles.okBanner}>No scored dimensions below configured thresholds</Text>
      )}
    </View>
  );
}

function ImprovementQueue({ items }: { items: ImprovementItem[] }) {
  if (items.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Improvement queue</Text>
        <Text style={styles.cardHint}>No lessons requiring attention.</Text>
      </View>
    );
  }

  const categoryLabel: Record<ImprovementItem['category'], string> = {
    attention: 'Needs attention',
    trust: 'Lowest Teacher Trust',
    alignment: 'Lowest Curriculum Alignment',
    quality: 'Lowest Educational Quality',
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Improvement queue</Text>
      <Text style={styles.cardHint}>Sorted by priority · tap to open lesson</Text>
      {items.slice(0, 12).map(item => (
        <Pressable
          key={`${item.lessonId}-${item.category}-${item.reason}`}
          onPress={() =>
            router.push({
              pathname: '/dev/cqv/[lessonId]',
              params: { lessonId: item.lessonId },
            })
          }
          style={({ pressed }) => [styles.queueRow, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.queueCat}>{categoryLabel[item.category]}</Text>
            <Text style={styles.queueTitle}>{item.lessonNameAr}</Text>
            <Text style={styles.queueReason} numberOfLines={2}>{item.reason}</Text>
          </View>
          <View style={styles.queueRight}>
            <Text style={styles.queueSem}>S{item.semester}</Text>
            {item.score != null ? (
              <Text
                style={[
                  styles.queueScore,
                  item.threshold != null && item.score < item.threshold && { color: DANGER },
                ]}
              >
                {item.score.toFixed(1)}
              </Text>
            ) : (
              <Text style={styles.queueScoreMuted}>—</Text>
            )}
            <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function LessonRow({
  lesson,
  reports,
}: {
  lesson: CqvLessonRef;
  reports: CqvReport[];
}) {
  const mine = reports.filter(r => r.lessonId === lesson.lessonId);
  const lp = getLessonProgress(lesson, mine);
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/dev/cqv/[lessonId]', params: { lessonId: lesson.lessonId } })
      }
      style={({ pressed }) => [styles.lessonRow, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.lessonTitleRow}>
          {lp.validated ? (
            <Text style={styles.validatedPill}>VALIDATED</Text>
          ) : null}
          <Text style={styles.lessonTitleAr}>{lesson.lessonNameAr}</Text>
        </View>
        <Text style={styles.lessonTitleEn}>{lesson.lessonName}</Text>
        <Text style={styles.lessonMeta}>
          Unit {lesson.unitOrder} · {lesson.unitNameAr}
        </Text>
        <Text style={styles.checklistMini}>
          {lp.artifacts.map(a => (a.complete ? '✓' : '○')).join(' ')} · {lp.completedCount}/{lp.totalArtifacts}
        </Text>
      </View>
      <View style={styles.badgeCol}>
        <Text style={styles.badgeText}>{lp.completedCount}/{lp.totalArtifacts}</Text>
        <Text style={[styles.badgeSub, lp.attentionReasons.some(r => r.includes('fail')) && { color: WARN }]}>
          {lp.validated ? 'validated' : 'in progress'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      </View>
    </Pressable>
  );
}

export default function CqvIndexScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<CqvReport[]>([]);
  const scope = useMemo(() => getCqvScope(), []);
  const groups = useMemo(() => groupCqvLessonsBySemester(), []);

  useFocusEffect(
    useCallback(() => {
      getAllReports().then(setReports);
    }, []),
  );

  const progress = useMemo(() => getCurriculumProgress(reports), [reports]);
  const queue = useMemo(() => getImprovementQueue(reports), [reports]);

  const exportProgress = () => {
    const md = curriculumProgressMarkdown(progress, queue);
    const ok = downloadMarkdown(`cqv-progress-grade-10-math.md`, md);
    if (!ok) console.log(md);
  };

  if (!isCqvEnabled()) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.blockedTitle}>CQV disabled</Text>
        <Text style={styles.blockedBody}>
          Curriculum Quality Validation is an internal tool. Enable with{'\n'}
          EXPO_PUBLIC_ENABLE_CQV=1 or run a __DEV__ build.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerEyebrow}>INTERNAL · NOT IN INVESTOR MVP</Text>
        <Text style={styles.headerTitle}>Curriculum Quality Validation</Text>
        <Text style={styles.headerSub}>
          {scope.curriculumAr} · الصف العاشر · الرياضيات · {scope.lessonCount} lessons
        </Text>
        <Text style={styles.headerPct}>
          Overall {progress.overallCompletionPct}% · {progress.lessonsValidated}/{progress.lessonsTotal} validated
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Curriculum progress</Text>
          <Pressable onPress={exportProgress} style={styles.exportChip}>
            <Text style={styles.exportChipText}>Export progress MD</Text>
          </Pressable>
        </View>

        <SemesterCard data={progress.semester1} />
        <SemesterCard data={progress.semester2} />

        <QualityDashboard progress={progress} />

        <ImprovementQueue items={queue} />

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
          Semester 1 · الفصل الأول ({groups.semester1.length})
        </Text>
        {groups.semester1.map(l => (
          <LessonRow key={l.lessonId} lesson={l} reports={reports} />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>
          Semester 2 · الفصل الثاني ({groups.semester2.length})
        </Text>
        {groups.semester2.map(l => (
          <LessonRow key={l.lessonId} lesson={l} reports={reports} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 22,
    gap: 6,
  },
  headerBack: { marginBottom: 8, alignSelf: 'flex-start' },
  headerEyebrow: {
    color: TEAL,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  headerPct: {
    marginTop: 4,
    color: TEAL,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  body: { padding: 20, gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    color: NAVY,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    marginBottom: 4,
    marginTop: 8,
  },
  exportChip: {
    backgroundColor: TEAL,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportChipText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  semCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  semTitle: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 4 },
  semLine: { color: '#475569', fontFamily: 'Inter_400Regular', fontSize: 13 },
  semStrong: { fontFamily: 'Inter_700Bold', color: NAVY },
  barTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  barFill: { height: 8, backgroundColor: TEAL, borderRadius: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  cardTitle: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 15 },
  cardHint: { color: '#64748B', fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 4 },
  metricBlock: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    gap: 2,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricOverall: { borderBottomWidth: 0, marginTop: 8, paddingTop: 4 },
  metricLabel: { color: '#334155', fontFamily: 'Inter_400Regular', fontSize: 13 },
  metricLabelBold: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 13 },
  metricValue: { color: NAVY, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  metricValueBold: { color: TEAL, fontFamily: 'Inter_700Bold', fontSize: 16 },
  metricMeta: { color: '#94A3B8', fontFamily: 'Inter_400Regular', fontSize: 11 },
  metricLow: { color: DANGER },
  warnBanner: {
    marginTop: 6,
    color: WARN,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
  },
  okBanner: {
    marginTop: 6,
    color: '#059669',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 8,
  },
  queueRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  queueCat: { color: TEAL, fontFamily: 'Inter_600SemiBold', fontSize: 10, textTransform: 'uppercase' },
  queueTitle: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 14, textAlign: 'right' },
  queueReason: { color: '#64748B', fontFamily: 'Inter_400Regular', fontSize: 12 },
  queueRight: { alignItems: 'flex-end', gap: 2, minWidth: 48 },
  queueSem: { color: '#94A3B8', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  queueScore: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 14 },
  queueScoreMuted: { color: '#CBD5E1', fontFamily: 'Inter_700Bold', fontSize: 14 },
  lessonRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  lessonTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  validatedPill: {
    backgroundColor: '#059669',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  lessonTitleAr: {
    color: NAVY,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    textAlign: 'right',
    flexShrink: 1,
  },
  lessonTitleEn: {
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  lessonMeta: {
    color: '#94A3B8',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  checklistMini: {
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 2,
  },
  badgeCol: { alignItems: 'flex-end', gap: 2, minWidth: 72 },
  badgeText: { color: TEAL, fontFamily: 'Inter_700Bold', fontSize: 14 },
  badgeSub: { color: '#94A3B8', fontFamily: 'Inter_400Regular', fontSize: 10 },
  blocked: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    gap: 12,
  },
  blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: NAVY },
  blockedBody: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#64748B', lineHeight: 22 },
  backBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold' },
});
