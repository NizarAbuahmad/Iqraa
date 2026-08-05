import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  CQV_ARTIFACTS,
  CQV_THRESHOLDS,
  averageScore,
  clampScore,
  dimensionsBelowThreshold,
  downloadMarkdown,
  getCqvLesson,
  getGeneratedOutput,
  getLessonProgress,
  getReportsForLesson,
  isCqvEnabled,
  lessonProgressChecklistMarkdown,
  lessonSummaryMarkdown,
  reportToMarkdown,
  saveReport,
  testEntireLesson,
  type BatchProgressEvent,
  type CqvArtifactId,
  type CqvReport,
  type CqvVerdict,
  type ScoreDimensionKey,
} from '@/services/cqv';

const NAVY = '#081B3A';
const TEAL = '#00A99D';
const DANGER = '#DC2626';
const WARN = '#B45309';

const SCORE_FIELDS: { key: ScoreDimensionKey; label: string }[] = [
  { key: 'educationalQuality', label: 'Educational Quality' },
  { key: 'arabicLanguage', label: 'Arabic Language' },
  { key: 'curriculumAlignment', label: 'Curriculum Alignment' },
  { key: 'teacherUsability', label: 'Teacher Usability' },
  { key: 'formatting', label: 'Formatting' },
  { key: 'teacherTrust', label: 'Teacher Trust' },
];

function statusMark(complete: boolean, generated: boolean) {
  if (complete) return '✓';
  if (generated) return '◆';
  return '○';
}

export default function CqvLessonScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const lesson = useMemo(() => (lessonId ? getCqvLesson(lessonId) : undefined), [lessonId]);
  const [reports, setReports] = useState<CqvReport[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<CqvArtifactId>('lesson-plan');
  const [saving, setSaving] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchEvents, setBatchEvents] = useState<Record<string, BatchProgressEvent>>({});
  const [preview, setPreview] = useState<string | null>(null);

  const active = reports.find(r => r.artifactId === activeArtifact) ?? null;
  const lessonProgress = useMemo(
    () => (lesson ? getLessonProgress(lesson, reports) : null),
    [lesson, reports],
  );

  const reload = useCallback(async () => {
    if (!lessonId) return;
    const list = await getReportsForLesson(lessonId);
    setReports(list);
  }, [lessonId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!isCqvEnabled()) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.blockedTitle}>CQV disabled</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!lesson || !active || !lessonProgress) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.blockedTitle}>Lesson not found</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Back to CQV</Text>
        </Pressable>
      </View>
    );
  }

  const topic = lesson.lessonNameAr;
  const artifactDef = CQV_ARTIFACTS.find(a => a.id === activeArtifact)!;

  const openTool = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const params: Record<string, string> = {
      topic,
      grade: 'الصف العاشر',
      subject: 'الرياضيات',
      cqvLessonId: lesson.lessonId,
      cqvArtifact: activeArtifact,
    };
    if (active.savedMaterialId) {
      params.savedId = active.savedMaterialId;
    }
    router.push({
      pathname: artifactDef.route as any,
      params,
    });
  };

  const openOverview = () => {
    router.push({
      pathname: '/curriculum/lesson-detail',
      params: { lessonId: lesson.lessonId, subjectColor: TEAL },
    });
  };

  const patchActive = (patch: Partial<CqvReport>) => {
    setReports(prev =>
      prev.map(r => (r.artifactId === activeArtifact ? { ...r, ...patch } : r)),
    );
  };

  const patchScore = (key: keyof CqvReport['scores'], raw: string) => {
    const n = raw.trim() === '' ? null : clampScore(Number(raw));
    patchActive({ scores: { ...active.scores, [key]: n } });
  };

  const setVerdict = (verdict: CqvVerdict) => {
    patchActive({
      verdict,
      reviewedAt: verdict === 'pending' ? null : new Date().toISOString(),
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await saveReport(active);
      setReports(prev => prev.map(r => (r.id === saved.id ? saved : r)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
  };

  const onExportOne = async () => {
    await onSave();
    const md = reportToMarkdown(active);
    const filename = `cqv-${lesson.lessonId}-${activeArtifact}.md`;
    const ok = downloadMarkdown(filename, md);
    if (!ok) {
      Alert.alert('Markdown ready', 'Printed to console on this platform.', [{ text: 'OK' }]);
      console.log(md);
    }
  };

  const onExportLesson = async () => {
    await onSave();
    const list = await getReportsForLesson(lesson.lessonId);
    const md = lessonSummaryMarkdown(lesson.lessonId, list);
    const ok = downloadMarkdown(`cqv-lesson-${lesson.lessonId}.md`, md);
    if (!ok) console.log(md);
  };

  const onExportChecklist = () => {
    const md = lessonProgressChecklistMarkdown(lessonProgress);
    const ok = downloadMarkdown(`cqv-checklist-${lesson.lessonId}.md`, md);
    if (!ok) console.log(md);
  };

  const onTestEntireLesson = async () => {
    if (batchRunning) return;
    Alert.alert(
      'Test Entire Lesson',
      'Generate all 8 artifacts for this lesson in Demo Mode?\n\nYou will still score each artifact after generation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate all',
          onPress: async () => {
            setBatchRunning(true);
            setBatchEvents({});
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await testEntireLesson(lesson.lessonId, event => {
                setBatchEvents(prev => ({ ...prev, [event.artifactId]: event }));
                if (event.report) {
                  setReports(prev => {
                    const others = prev.filter(r => r.artifactId !== event.artifactId);
                    return [...others, event.report!].sort(
                      (a, b) =>
                        CQV_ARTIFACTS.findIndex(x => x.id === a.artifactId)
                        - CQV_ARTIFACTS.findIndex(x => x.id === b.artifactId),
                    );
                  });
                }
              });
              await reload();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Batch complete',
                'All supported artifacts were generated. Score each report below (Pass/Fail + 1–10).',
              );
            } catch (e) {
              Alert.alert('Batch failed', e instanceof Error ? e.message : String(e));
            } finally {
              setBatchRunning(false);
            }
          },
        },
      ],
    );
  };

  const onViewGenerated = async () => {
    const out = await getGeneratedOutput(lesson.lessonId, activeArtifact);
    if (!out) {
      Alert.alert('No generated output', 'Run Test Entire Lesson or Open the tool first.');
      return;
    }
    try {
      const parsed = JSON.parse(out.content);
      setPreview(JSON.stringify(parsed, null, 2).slice(0, 4000));
    } catch {
      setPreview(out.content.slice(0, 4000));
    }
  };

  const avg = averageScore(active.scores);
  const activeBelowKeys = dimensionsBelowThreshold(active.scores);
  const activeBelow = SCORE_FIELDS.filter(f => activeBelowKeys.includes(f.key));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerEyebrow}>
          S{lesson.semester} · {lesson.unitNameAr} · INTERNAL CQV
        </Text>
        <Text style={styles.headerTitleAr}>{lesson.lessonNameAr}</Text>
        <Text style={styles.headerTitleEn}>{lesson.lessonName}</Text>
        {lessonProgress.validated ? (
          <Text style={styles.validatedBanner}>VALIDATED · all artifacts meet threshold</Text>
        ) : (
          <Text style={styles.progressBanner}>
            {lessonProgress.completedCount} / {lessonProgress.totalArtifacts} Complete
            {lessonProgress.generatedCount > 0
              ? ` · ${lessonProgress.generatedCount} generated`
              : ''}
          </Text>
        )}
        <View style={styles.headerActions}>
          <Pressable onPress={openOverview} style={styles.headerChip}>
            <Text style={styles.headerChipText}>Lesson Overview</Text>
          </Pressable>
          <Pressable onPress={onExportLesson} style={[styles.headerChip, styles.headerChipAccent]}>
            <Text style={[styles.headerChipText, { color: NAVY }]}>Export lesson MD</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <Pressable
          onPress={onTestEntireLesson}
          disabled={batchRunning}
          style={[styles.batchBtn, batchRunning && { opacity: 0.7 }]}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={styles.batchBtnText}>
            {batchRunning ? 'Generating all artifacts…' : 'Test Entire Lesson'}
          </Text>
        </Pressable>
        <Text style={styles.batchHint}>
          One click generates Lesson Plan, Worksheet, Quiz, Homework, Classroom Activity,
          Interactive Lesson, Assessment, and Answer Key (Demo Mode). Then score each below.
        </Text>

        <Text style={styles.sectionLabel}>Progress tracking</Text>
        <View style={styles.checklistCard}>
          {lessonProgress.artifacts.map(a => {
            const ev = batchEvents[a.artifactId];
            const running = ev?.state === 'running';
            const err = ev?.state === 'error';
            return (
              <Pressable
                key={a.artifactId}
                onPress={() => setActiveArtifact(a.artifactId)}
                style={[
                  styles.checkRow,
                  a.artifactId === activeArtifact && styles.checkRowActive,
                ]}
              >
                <Text
                  style={[
                    styles.checkMark,
                    a.complete && { color: '#059669' },
                    !a.complete && a.generated && { color: TEAL },
                    err && { color: DANGER },
                  ]}
                >
                  {running ? '…' : err ? '✗' : statusMark(a.complete, a.generated)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkLabel}>{a.label}</Text>
                  <Text style={styles.checkLabelAr}>{a.labelAr}</Text>
                </View>
                {a.averageScore != null ? (
                  <Text
                    style={[
                      styles.checkScore,
                      a.belowThresholdKeys.length > 0 && { color: DANGER },
                    ]}
                  >
                    {a.averageScore.toFixed(1)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <Text style={styles.checkOverall}>
            Overall: {lessonProgress.completedCount} / {lessonProgress.totalArtifacts} Complete
          </Text>
          <Pressable onPress={onExportChecklist} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Export checklist MD</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>1 · Select artifact & review</Text>
        <View style={styles.artifactGrid}>
          {CQV_ARTIFACTS.map(a => {
            const rep = reports.find(r => r.artifactId === a.id);
            const selected = a.id === activeArtifact;
            const tone =
              rep?.verdict === 'pass' ? '#059669'
                : rep?.verdict === 'fail' ? DANGER
                  : rep?.generatedAt ? TEAL
                    : '#94A3B8';
            return (
              <Pressable
                key={a.id}
                onPress={() => { setActiveArtifact(a.id); setPreview(null); }}
                style={[
                  styles.artifactChip,
                  selected && styles.artifactChipSelected,
                  { borderColor: selected ? TEAL : '#E2E8F0' },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: tone }]} />
                <Text style={styles.artifactChipText} numberOfLines={2}>
                  {a.labelAr}
                </Text>
                <Text style={styles.artifactChipEn} numberOfLines={1}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={openTool} style={[styles.primaryBtn, { flex: 1 }]}>
            <Ionicons name="sparkles-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Open {artifactDef.label}</Text>
          </Pressable>
          <Pressable onPress={onViewGenerated} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>View output</Text>
          </Pressable>
        </View>
        {artifactDef.note ? <Text style={styles.note}>{artifactDef.note}</Text> : null}
        {active.generationError ? (
          <Text style={styles.errorNote}>Generation error: {active.generationError}</Text>
        ) : null}
        {active.generatedAt ? (
          <Text style={styles.note}>Generated: {new Date(active.generatedAt).toLocaleString()}</Text>
        ) : null}

        {preview ? (
          <View style={styles.previewBox}>
            <View style={styles.previewHeader}>
              <Text style={styles.fieldLabel}>Generated preview</Text>
              <Pressable onPress={() => setPreview(null)}>
                <Text style={styles.linkBtnText}>Hide</Text>
              </Pressable>
            </View>
            <Text style={styles.previewText}>{preview}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>2 · CQV report</Text>
        <View style={styles.card}>
          <Text style={styles.cardMeta}>
            Artifact: {artifactDef.labelAr} / {artifactDef.label}
            {avg != null ? ` · avg ${avg.toFixed(1)}/10` : ''}
          </Text>
          <Text style={styles.cardMeta}>
            Validated when all 8 artifacts Pass and every score meets its configured threshold
            (EQ {CQV_THRESHOLDS.educationalQuality} · AR {CQV_THRESHOLDS.arabicLanguage} · CA{' '}
            {CQV_THRESHOLDS.curriculumAlignment} · TU {CQV_THRESHOLDS.teacherUsability} · FMT{' '}
            {CQV_THRESHOLDS.formatting} · TT {CQV_THRESHOLDS.teacherTrust}).
          </Text>

          <Text style={styles.fieldLabel}>Pass / Fail</Text>
          <View style={styles.verdictRow}>
            {(['pending', 'pass', 'fail'] as CqvVerdict[]).map(v => (
              <Pressable
                key={v}
                onPress={() => setVerdict(v)}
                style={[
                  styles.verdictBtn,
                  active.verdict === v && styles.verdictBtnOn,
                  v === 'pass' && active.verdict === v && { backgroundColor: '#059669' },
                  v === 'fail' && active.verdict === v && { backgroundColor: DANGER },
                ]}
              >
                <Text style={[styles.verdictText, active.verdict === v && { color: '#fff' }]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>

          {SCORE_FIELDS.map(f => {
            const val = active.scores[f.key];
            const need = CQV_THRESHOLDS[f.key];
            const low = typeof val === 'number' && val < need;
            return (
              <View key={f.key} style={styles.scoreRow}>
                <Text style={[styles.scoreLabel, low && { color: DANGER }]}>
                  {f.label} (≥{need}){low ? ' ⚠' : ''}
                </Text>
                <TextInput
                  style={[styles.scoreInput, low && styles.scoreInputLow]}
                  keyboardType="number-pad"
                  placeholder="1–10"
                  placeholderTextColor="#94A3B8"
                  value={val == null ? '' : String(val)}
                  onChangeText={raw => patchScore(f.key, raw)}
                  maxLength={2}
                />
              </View>
            );
          })}
          {activeBelow.length > 0 ? (
            <Text style={styles.warnInline}>
              Below configured threshold:{' '}
              {activeBelow.map(f => `${f.label} (need ≥${CQV_THRESHOLDS[f.key]})`).join(', ')}
            </Text>
          ) : null}

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.textArea, { textAlign: 'left' }]}
            multiline
            value={active.notes}
            onChangeText={notes => patchActive({ notes })}
            placeholder="Observations during teacher review…"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.fieldLabel}>Recommended improvements</Text>
          <TextInput
            style={[styles.textArea, { textAlign: 'left' }]}
            multiline
            value={active.improvements}
            onChangeText={improvements => patchActive({ improvements })}
            placeholder="Concrete fixes for generators / content / formatting…"
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.saveRow}>
            <Pressable onPress={onSave} style={[styles.primaryBtn, { flex: 1, opacity: saving ? 0.7 : 1 }]}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save report'}</Text>
            </Pressable>
            <Pressable onPress={onExportOne} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Export MD</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 4,
  },
  headerBack: { marginBottom: 8, alignSelf: 'flex-start' },
  headerEyebrow: {
    color: TEAL,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  headerTitleAr: {
    color: '#fff',
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    textAlign: 'right',
  },
  headerTitleEn: {
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  validatedBanner: {
    marginTop: 8,
    color: '#6EE7B7',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  progressBanner: {
    marginTop: 8,
    color: TEAL,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  headerChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerChipAccent: { backgroundColor: TEAL },
  headerChipText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  body: { padding: 20, gap: 10 },
  batchBtn: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  batchBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
  batchHint: {
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  sectionLabel: {
    color: NAVY,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  checkRowActive: { backgroundColor: '#F0FDFA' },
  checkMark: {
    width: 22,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#94A3B8',
  },
  checkLabel: { color: NAVY, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  checkLabelAr: { color: '#94A3B8', fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'right' },
  checkScore: { color: NAVY, fontFamily: 'Inter_700Bold', fontSize: 13 },
  checkOverall: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    color: NAVY,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  linkBtn: { alignSelf: 'flex-start', marginTop: 6 },
  linkBtnText: { color: TEAL, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  artifactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artifactChip: {
    width: '48%',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  artifactChipSelected: { backgroundColor: '#F0FDFA' },
  artifactChipText: {
    color: NAVY,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textAlign: 'right',
  },
  artifactChipEn: { color: '#94A3B8', fontFamily: 'Inter_400Regular', fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  note: {
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  errorNote: { color: DANGER, fontFamily: 'Inter_400Regular', fontSize: 12 },
  previewBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    maxHeight: 220,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewText: {
    color: '#E2E8F0',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  cardMeta: { color: '#64748B', fontFamily: 'Inter_400Regular', fontSize: 12 },
  fieldLabel: {
    color: NAVY,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 6,
  },
  verdictRow: { flexDirection: 'row', gap: 8 },
  verdictBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  verdictBtnOn: { backgroundColor: NAVY, borderColor: NAVY },
  verdictText: {
    color: '#475569',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreLabel: { flex: 1, color: '#334155', fontFamily: 'Inter_400Regular', fontSize: 13 },
  scoreInput: {
    width: 64,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    color: NAVY,
    backgroundColor: '#F8FAFC',
  },
  scoreInputLow: { borderColor: DANGER, backgroundColor: '#FEF2F2' },
  warnInline: {
    color: WARN,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 8,
  },
  textArea: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: NAVY,
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  saveRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  secondaryBtnText: { color: NAVY, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  blocked: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 24, gap: 12 },
  blockedTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: NAVY },
});
