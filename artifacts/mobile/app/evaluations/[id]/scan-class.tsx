/**
 * Scan the class — photograph each student's marked paper, check the table,
 * save the lot.
 *
 * The screen holds no rules. What blocks a save, what only warns, and what a
 * retry must remember live in `services/classScanReview.ts` and
 * `classScanSave.ts`, where they are tested; the runner that sends photos three
 * at a time lives in `classScanRunner.ts`. This file only wires them to views.
 *
 * Nothing here writes until «احفظ العلامات»: the scan returns proposals, they
 * land in boxes, and the ordinary start-attempt and marking endpoints do the
 * saving. Photos live in this component's memory and nowhere else.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { palette } from '@/constants/colors';
import { BackButton } from '@/components/ui/BackButton';
import { PickerField } from '@/components/ui/PickerField';
import { getClass, type RosterStudent } from '@/services/roster';
import {
  getEvaluation,
  listAttempts,
  scanClassPaper,
  setQuestionGrade,
  startAttemptChecked,
  submitAttempt,
} from '@/services/evaluations';
import { pickMarkSheetPhotos } from '@/services/documents/pick';
import { scanAll } from '@/services/classScanRunner';
import { isBatchStopError, scanErrorKey, type ScanErrorKey } from '@/services/scanErrors';
import { saveRows, type SaveDeps } from '@/services/classScanSave';
import {
  assignStudent,
  canDiscard,
  canSave,
  discardRow,
  isStudentLocked,
  newRow,
  reportRows,
  rosterLabels,
  rowFromScan,
  rowTotal,
  saveSummary,
  setMark,
  type ReviewContext,
  type ReviewQuestion,
  type ReviewRow,
  type RowReport,
} from '@/services/classScanReview';
import { filterToAudience } from '@/services/supportGroups';
import { isPaperQuestion } from '@/services/paperQuestion';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
/** One class in one sitting; also the route's own per-minute budget in practice. */
const MAX_PHOTOS = 40;

/** The three calls a save makes, adapted to the shapes `saveRows` expects. */
const SAVE_DEPS: SaveDeps = {
  async startAttempt(evaluationId, studentId) {
    const { attempt, created } = await startAttemptChecked(evaluationId, studentId);
    return { attemptId: attempt.id, created };
  },
  async setGrade(attemptId, questionId, marks) {
    await setQuestionGrade(attemptId, questionId, { awardedMarks: marks });
  },
  async submit(attemptId) {
    await submitAttempt(attemptId);
  },
};

export default function ScanClassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [hasAttempt, setHasAttempt] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  // The save loop reads the rows as they are when it starts; a ref keeps that
  // read current without making the loop re-create on every keystroke.
  const rowsRef = useRef<ReviewRow[]>([]);
  rowsRef.current = rows;
  // A second tap while the picker is still open must not start a second batch;
  // `reading` is only set once the picker returns, so a ref guards the gap.
  const pickingRef = useRef(false);
  // Row keys are never reused, whatever the photo count says at the time.
  const nextKeyRef = useRef(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [data, attempts] = await Promise.all([getEvaluation(id), listAttempts(id)]);
        if (!data.evaluation.classGroupId) {
          setLoadError(t('scanNoClass'));
          return;
        }
        if (data.evaluation.status !== 'published') {
          setLoadError(t('scanNotPublished'));
          return;
        }
        // The server refuses too (`not_paper_exam`): on an exam the app marks
        // itself, a blank box plus submit would score the question 0.
        if (!(data.questions.length > 0 && data.questions.every(isPaperQuestion))) {
          setLoadError(t('scanNotPaper'));
          return;
        }
        const { students } = await getClass(data.evaluation.classGroupId);
        setRoster(filterToAudience(students, data.audience));
        // Numbered in the same order the server numbers them for the model.
        setQuestions(data.questions.map((q, i) => ({ id: q.id, number: i + 1, maxMarks: Number(q.marks) })));
        setHasAttempt(new Set(attempts.map(a => a.studentId)));
      } catch {
        setLoadError(t('classScanLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const ctx = useMemo<ReviewContext>(() => ({ questions, hasAttempt }), [questions, hasAttempt]);
  const reports = useMemo(() => reportRows(rows, ctx), [rows, ctx]);
  const summary = useMemo(() => saveSummary(rows), [rows]);
  // Two children with one name must not look identical in the chips or picker.
  const labels = useMemo(
    () => rosterLabels(roster.map(s => ({ id: s.id, displayName: s.displayName, externalRef: s.externalRef }))),
    [roster],
  );

  const patchRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }, []);
  const updateRow = useCallback((key: string, fn: (r: ReviewRow) => ReviewRow) => {
    setRows(prev => prev.map(r => (r.key === key ? fn(r) : r)));
  }, []);

  const onPick = async () => {
    if (!id || pickingRef.current || reading || saving) return;
    pickingRef.current = true;
    try {
      const room = MAX_PHOTOS - photos.length;
      if (room <= 0) {
        setNote(t('classScanTooMany', String(MAX_PHOTOS)));
        return;
      }
      const picked = await pickMarkSheetPhotos(room);
      if (picked.length === 0) return;

      // Each photo's key is fixed here, and the outcome callback addresses its
      // row by that key, never by a position computed from the photo count.
      const keys = picked.map(() => `p${nextKeyRef.current++}`);
      // Appended in the same tick, so photos[index] stays rows[index].
      setPhotos(prev => [...prev, ...picked]);
      setRows(prev => [...prev, ...keys.map(key => newRow(key))]);
      setReading(true);
      setNote('');
      await scanAll(
        picked.length,
        i => scanClassPaper(id, picked[i]!),
        (i, outcome) => {
          const key = keys[i]!;
          if (outcome.state === 'read') {
            updateRow(key, r => rowFromScan(r, outcome.result));
          } else if (outcome.state === 'failed') {
            patchRow(key, { state: 'failed', error: scanErrorKey(outcome.error) });
            // Say why the batch stopped, once, in the teacher's language.
            if (isBatchStopError(outcome.error)) setNote(t(scanErrorKey(outcome.error)));
          } else {
            patchRow(key, { state: 'not_run' });
          }
        },
        { onStart: i => patchRow(keys[i]!, { state: 'reading' }) },
      );
    } catch {
      setNote(t('scanFailed'));
    } finally {
      pickingRef.current = false;
      setReading(false);
    }
  };

  const onSave = async () => {
    if (saving) return;
    if (!id || reading || !canSave(rowsRef.current, ctx)) return;
    setSaving(true);
    try {
      await saveRows(id, rowsRef.current, ctx, SAVE_DEPS, patchRow);
      // A student saved now has a paper: a later stray photo of theirs is
      // flagged instead of being started a second time.
      const done = rowsRef.current.filter(r => r.state === 'saved' && r.studentId).map(r => r.studentId!);
      setHasAttempt(prev => new Set([...prev, ...done]));
    } finally {
      setSaving(false);
    }
  };

  // A photo the teacher set aside is not part of the batch any more.
  const counted = rows.filter(r => r.state !== 'discarded');
  const readCount = counted.filter(r => r.state !== 'queued' && r.state !== 'reading').length;
  const savedAny = summary.saved + summary.needAttention + summary.skipped > 0;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('classScanTitle')}
        </Text>
      </View>

      <View style={{ padding: 20, gap: 12 }}>
        {loadError ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{loadError}</Text>
        ) : (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
              {t('classScanHint')}
            </Text>

            <Pressable
              onPress={onPick}
              disabled={reading || saving}
              style={[styles.pickBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: reading || saving ? 0.6 : 1 }]}
            >
              {reading ? <ActivityIndicator size="small" color={ACCENT} /> : <Ionicons name="images-outline" size={20} color={ACCENT} />}
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                {reading ? t('classScanProgress', String(readCount), String(counted.length)) : t('classScanPickBtn')}
              </Text>
            </Pressable>

            {note ? (
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{note}</Text>
            ) : null}

            {rows.map((row, index) => (
              <RowCard
                key={row.key}
                row={row}
                index={index}
                photo={photos[index]}
                questions={questions}
                roster={roster}
                labels={labels}
                report={reports.get(row.key)}
                disabled={saving || reading}
                onAssign={studentId => {
                  if (saving) return;
                  updateRow(row.key, r => assignStudent(r, studentId));
                }}
                onDiscard={() => {
                  if (saving || reading) return;
                  updateRow(row.key, discardRow);
                }}
                onMark={(questionId, text) => {
                  if (saving) return;
                  updateRow(row.key, r => setMark(r, questionId, text));
                }}
                onOpenStudent={studentId =>
                  router.push({ pathname: '/evaluations/[id]/answers/[studentId]', params: { id: id as string, studentId } })
                }
                colors={colors}
                isRTL={isRTL}
                align={align}
                t={t}
              />
            ))}

            {rows.length > 0 && (
              <>
                {savedAny ? (
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }}>
                    {t('classScanSummary', String(summary.saved), String(summary.needAttention), String(summary.skipped))}
                  </Text>
                ) : null}
                <Pressable
                  onPress={onSave}
                  disabled={saving || reading || !canSave(rows, ctx)}
                  style={[styles.saveBtn, { backgroundColor: ACCENT_FILL, opacity: saving || reading || !canSave(rows, ctx) ? 0.5 : 1 }]}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
                  <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
                    {saving ? t('classScanSaving') : t('classScanSaveBtn')}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function RowCard({
  row, index, photo, questions, roster, labels, report, disabled, onAssign, onDiscard, onMark, onOpenStudent, colors, isRTL, align, t,
}: {
  row: ReviewRow;
  index: number;
  photo: string | undefined;
  questions: ReviewQuestion[];
  roster: RosterStudent[];
  /** Student id → what the teacher sees; twins are told apart. */
  labels: Map<string, string>;
  report: RowReport | undefined;
  disabled: boolean;
  onAssign: (studentId: string | null) => void;
  onDiscard: () => void;
  onMark: (questionId: string, text: string) => void;
  onOpenStudent: (studentId: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: any, ...args: any[]) => string;
}) {
  const live = row.state === 'read' || row.state === 'save_failed';
  const done = row.state === 'saved' || row.state === 'skipped_existing';
  // A row that has started a paper keeps its student (see `isStudentLocked`).
  const locked = isStudentLocked(row);
  const studentName = row.studentId
    ? labels.get(row.studentId) ?? roster.find(s => s.id === row.studentId)?.displayName ?? ''
    : '';
  const note = (text: string, color: string) => (
    <Text style={{ color, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{text}</Text>
  );

  if (row.state === 'discarded') {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, alignItems: 'center' }]}>
        {photo ? <Image source={{ uri: photo }} style={styles.thumbSmall} /> : null}
        <View style={{ flex: 1 }}>{note(t('classScanRowDiscarded'), colors.mutedForeground)}</View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
        {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
            {index + 1}
          </Text>
          {row.state === 'queued' || row.state === 'reading' ? <ActivityIndicator size="small" color={ACCENT} /> : null}
          {row.state === 'failed'
            ? note(`${t('classScanRowFailed')} ${row.error ? t(row.error as ScanErrorKey) : ''}`, colors.destructive)
            : null}
          {row.state === 'not_run' ? note(t('classScanRowNotRun'), colors.mutedForeground) : null}
          {row.state === 'saved' ? note(t('classScanRowSaved'), palette.success) : null}
          {row.state === 'skipped_existing' ? note(t('classScanRowSkipped'), colors.mutedForeground) : null}
          {row.state === 'save_failed'
            ? note(row.error === 'cleared_after_write' ? t('classScanRowCleared') : t('classScanRowSaveFailed'), colors.destructive)
            : null}
          {live || done ? note(row.nameRead ? t('classScanNameRead', row.nameRead) : t('classScanNoName'), colors.mutedForeground) : null}
        </View>
      </View>

      {live && (
        <>
          {!locked && !row.studentId && row.candidates.length > 0 ? (
            <View style={{ gap: 6, marginTop: 10 }}>
              {note(t('classScanLikely'), colors.mutedForeground)}
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                {row.candidates.map(c => (
                  <Pressable
                    key={c.studentId}
                    onPress={() => onAssign(c.studentId)}
                    disabled={disabled}
                    style={[styles.chip, { borderColor: ACCENT, opacity: c.hasAttempt ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: ACCENT, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>
                      {labels.get(c.studentId) ?? c.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {locked ? (
            <View style={{ gap: 2, marginTop: 8 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
                {studentName}
              </Text>
              {note(t('classScanRowLocked'), colors.mutedForeground)}
              {row.studentId ? (
                <Pressable onPress={() => onOpenStudent(row.studentId!)} hitSlop={8}>
                  <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: align }}>
                    {t('classScanOpenStudent')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <PickerField
              label={t('classScanPickStudent')}
              value={studentName}
              options={roster.map(s => labels.get(s.id) ?? s.displayName)}
              onChange={i => onAssign(roster[i]?.id ?? null)}
              colors={colors}
              isRTL={isRTL}
              accent={ACCENT}
            />
          )}

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {questions.map(q => (
              <View key={q.id} style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.number}</Text>
                <TextInput
                  value={row.marks[q.id] ?? ''}
                  onChangeText={text => onMark(q.id, text)}
                  editable={!disabled}
                  keyboardType="decimal-pad"
                  style={[styles.markBox, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>/{q.maxMarks}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 2, marginTop: 6 }}>
            {report?.blockers.includes('no_student') ? note(t('classScanBlockNoStudent'), colors.destructive) : null}
            {report?.blockers.includes('duplicate_student') ? note(t('classScanBlockDuplicate'), colors.destructive) : null}
            {report?.blockers.includes('mark_invalid') ? note(t('classScanBlockInvalid'), colors.destructive) : null}
            {report?.flags.includes('has_attempt') ? note(t('classScanFlagHasAttempt'), colors.mutedForeground) : null}
            {report?.flags.includes('has_attempt') && row.studentId ? (
              <Pressable onPress={() => onOpenStudent(row.studentId!)} hitSlop={8}>
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: align }}>
                  {t('classScanOpenStudent')}
                </Text>
              </Pressable>
            ) : null}
            {report?.flags.includes('blank_cells') ? note(t('classScanFlagBlank'), colors.mutedForeground) : null}
            {report?.flags.includes('total_mismatch') && row.writtenTotal !== null
              ? note(t('classScanFlagTotal', String(rowTotal(row, questions)), String(row.writtenTotal)), colors.mutedForeground)
              : null}
          </View>
        </>
      )}

      {canDiscard(row) && !disabled ? (
        <Pressable onPress={onDiscard} hitSlop={8} style={{ marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: align }}>
            {t('classScanDiscard')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 20, marginTop: 8 },
  pickBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#0001' },
  thumbSmall: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#0001' },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  markBox: { borderWidth: 1, borderRadius: 8, minWidth: 52, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center', fontSize: 14 },
});
