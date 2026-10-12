/**
 * «علامات الطلبة» — a paper exam's mark book: one row per student of the exam's
 * class, one box for their total out of N. For a quick paper exam (one paper
 * question worth N, made with «مجموع فقط»); a paper with several questions is
 * marked per student on answers/[studentId].
 *
 * «حفظ الكل» sends only the rows that changed to PUT /evaluations/:id/paper-totals,
 * which hands each one in and answers per student, so one bad row never loses
 * the rest. Families see a mark only after «أعلن النتائج», so the release sits
 * at the foot of this screen and waits for unsaved marks: type, save, release.
 * A mark saved after the release shows to the family at once, with no
 * notification (STATUS.md, Part 3 known gaps) — the screen says so.
 *
 * Loaded once, not on every focus: a refetch would wipe marks typed but not
 * saved. The one refetch is after a save whose outcome is unknown (a timeout):
 * it re-reads what the server holds but keeps every box as typed. A Stack screen with inputs — the root layout already wraps it in
 * KeyboardSafeView, so there is no KeyboardAvoidingView here (CLAUDE.md).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { getEvaluation, listAttempts, savePaperTotals, setResultsReleased, type Evaluation } from '@/services/evaluations';
import { getClass } from '@/services/roster';
import { filterToAudience } from '@/services/supportGroups';
import { apiErrorMessage } from '@/services/apiErrorKey';
import {
  MARKS_BLOCKER_KEY,
  buildTotalsRequest,
  chunkTotals,
  countRefused,
  editRow,
  formatMark,
  gridSummary,
  initialGridRows,
  marksBlocker,
  mergeTotalsResponse,
  paperTotalErrorText,
  paperTotalsFailureKey,
  refreshStoredMarks,
  rowProblemCode,
  rowState,
  saveOutcomeUncertain,
  savedMarksToClear,
  showGridSummary,
  type GridRow,
  type MarksBlocker,
} from '@/services/paperMarks';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

const ACCENT = palette.primary;
const ACCENT_FILL = palette.hero;

export default function PaperMarksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [maxMarks, setMaxMarks] = useState(0);
  const [rows, setRows] = useState<GridRow[] | null>(null);
  const [blocker, setBlocker] = useState<MarksBlocker | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<'save' | 'release' | null>(null);
  // `busy` is state: two taps inside one frame both read null. The ref flips synchronously.
  const savingRef = useRef(false);

  const load = async () => {
    if (!id) return;
    setLoadError('');
    try {
      const { evaluation: ev, questions, audience } = await getEvaluation(id);
      setEvaluation(ev);
      // A closed exam is fine: the route takes marks for a published or a closed one.
      const stop = marksBlocker(questions, ev.status, ev.classGroupId);
      setBlocker(stop);
      if (stop) return;
      setMaxMarks(Number(questions[0]!.marks));
      const [{ students }, attempts] = await Promise.all([getClass(ev.classGroupId!), listAttempts(id)]);
      setRows(initialGridRows(filterToAudience(students, audience), attempts));
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'marksGridLoadFailed', t));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const summary = rows ? gridSummary(rows, maxMarks) : null;
  const max = formatMark(maxMarks);
  const released = Boolean(evaluation?.releaseResultsToStudent);

  /** Held from the first tap: the clear confirmation awaits, and a second tap in that window must not start a second save. */
  const onSave = async () => {
    if (!id || !rows || busy || savingRef.current) return;
    savingRef.current = true;
    try {
      await saveRows(id, rows);
    } finally {
      savingRef.current = false;
    }
  };

  const saveRows = async (id: string, rows: GridRow[]) => {
    const { totals, invalidIds } = buildTotalsRequest(rows, maxMarks);
    if (invalidIds.length > 0) {
      setNotice({ kind: 'error', text: t('marksGridFixInvalid') });
      return;
    }
    if (totals.length === 0) return;
    // A blank box over a saved mark removes that student's result (and, once
    // results are released, takes it away from the family): ask first. A blank
    // row that never had a mark is not a clear and asks nothing.
    const clearing = savedMarksToClear(rows, maxMarks);
    if (clearing > 0) {
      const ok = await confirm({
        title: t('marksGridClearTitle'),
        message: t('marksGridClearConfirm', String(clearing), released ? '1' : '0'),
        confirmLabel: t('marksGridClearAction'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy('save');
    setNotice(null);
    let refused = 0;
    try {
      for (const chunk of chunkTotals(totals)) {
        const sent = new Map(chunk.map(x => [x.studentId, x.marks] as const));
        const { results } = await savePaperTotals(id, chunk);
        refused += countRefused(results);
        // Functional, once per chunk: a snapshot would lose chunk 1 when chunk 2 returns.
        setRows(prev => (prev ? mergeTotalsResponse(prev, results, sent) : prev));
      }
      setNotice(refused > 0 ? { kind: 'error', text: t('marksGridSavedWithErrors', String(refused)) } : { kind: 'ok', text: t('marksGridSaved') });
    } catch (e) {
      // Chunks that already answered stay merged; this is only the one that threw.
      const key = paperTotalsFailureKey(e);
      let text = key === 'marksGridSaveFailed' ? apiErrorMessage(e, key, t) : t(key);
      if (saveOutcomeUncertain(e)) {
        // A timeout does not mean nothing saved. Re-save is idempotent, so read
        // back what the server holds and let the dots say what is left.
        try {
          const attempts = await listAttempts(id);
          setRows(prev => (prev ? refreshStoredMarks(prev, attempts) : prev));
          text = `${text} ${t('marksGridCheckedAfterFailure')}`;
        } catch {
          /* still unreachable: the rows stay as typed and a retry is safe */
        }
      }
      setNotice({ kind: 'error', text });
    } finally {
      setBusy(null);
      // «صُحّح N من M» on the exam lists counts from the server.
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      // The results dashboard reads the same marks; without this it shows the old ones until its stale time runs out.
      void queryClient.invalidateQueries({ queryKey: ['evaluationResults', id] });
    }
  };

  const onToggleRelease = async () => {
    if (!id || !evaluation || busy) return;
    const release = !released;
    if (release) {
      const ok = await confirm({
        title: t('releaseResultsBtn'),
        message: t('releaseResultsConfirm'),
        confirmLabel: t('releaseResultsBtn'),
        cancelLabel: t('cancel'),
      });
      if (!ok) return;
    }
    setBusy('release');
    setNotice(null);
    try {
      setEvaluation(await setResultsReleased(id, release));
      await queryClient.invalidateQueries({ queryKey: ['evaluation', id] });
    } catch {
      setNotice({ kind: 'error', text: t('releaseResultsFailed') });
    } finally {
      setBusy(null);
    }
  };

  const title = evaluation ? (lang === 'ar' ? evaluation.titleAr || evaluation.title : evaluation.title || evaluation.titleAr) : '';
  const holdRelease = !released && ((summary?.dirty ?? 0) > 0 || (summary?.invalid ?? 0) > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + SPACE.md }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.headerTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{t('marksGridTitle')}</Text>
        {title ? (
          <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>
            {title}
          </Text>
        ) : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: insets.bottom + SPACE.page, gap: SPACE.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
      >
        {loadError ? (
          <View style={[styles.banner, { borderColor: colors.destructive, flexDirection: rowDir }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={{ flex: 1, color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>{loadError}</Text>
            <Pressable onPress={() => void load()} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textDecorationLine: 'underline' }}>{t('retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {blocker ? (
          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align }}>
            {t(MARKS_BLOCKER_KEY[blocker])}
          </Text>
        ) : null}

        {!blocker && !loadError && rows === null ? <ActivityIndicator color={ACCENT} style={{ marginTop: SPACE.page }} /> : null}

        {rows && !blocker ? (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
              {t('marksGridHint', max)}
            </Text>
            {rows.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: align }}>{t('marksGridEmptyClass')}</Text>
            ) : null}
            {rows.map(row => (
              <MarkRow
                key={row.studentId}
                row={row}
                max={maxMarks}
                locked={busy !== null}
                onChange={text => setRows(prev => (prev ? editRow(prev, row.studentId, text) : prev))}
                colors={colors}
                isRTL={isRTL}
                t={t}
              />
            ))}

            {summary && showGridSummary(summary) ? (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                {[t('marksGridEntered', String(summary.entered), String(summary.total)), summary.dirty ? t('marksGridUnsaved', String(summary.dirty)) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}

            {notice ? (
              <Text accessibilityLiveRegion="polite" style={{ color: notice.kind === 'error' ? colors.destructive : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, textAlign: align }}>
                {notice.text}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void onSave()}
              disabled={busy !== null || !summary?.dirty}
              aria-disabled={busy !== null || !summary?.dirty}
              accessibilityRole="button"
              style={[styles.primary, { backgroundColor: ACCENT_FILL, opacity: busy !== null || !summary?.dirty ? 0.5 : 1 }]}
            >
              {busy === 'save' ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>{t('marksGridSaveAll')}</Text>
              )}
            </Pressable>

            <View style={[styles.releaseBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={{ color: released ? palette.warning : colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label, lineHeight: 22, textAlign: align }}>
                {t(released ? 'marksGridReleasedWarning' : 'marksGridNotReleased')}
              </Text>
              {holdRelease ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>{t('marksGridSaveFirst')}</Text>
              ) : null}
              <Pressable
                onPress={() => void onToggleRelease()}
                disabled={busy !== null || holdRelease}
                aria-disabled={busy !== null || holdRelease}
                accessibilityRole="button"
                style={[styles.secondary, { borderColor: released ? colors.border : ACCENT, opacity: busy !== null || holdRelease ? 0.5 : 1, flexDirection: rowDir }]}
              >
                <Ionicons name={released ? 'eye-off-outline' : 'megaphone-outline'} size={18} color={released ? colors.mutedForeground : ACCENT} />
                <Text style={{ color: released ? colors.mutedForeground : ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body }}>
                  {t(released ? 'hideResultsBtn' : 'releaseResultsBtn')}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MarkRow({
  row, max, locked, onChange, colors, isRTL, t,
}: {
  row: GridRow;
  max: number;
  /** A save or a release is in flight: the boxes wait. */
  locked: boolean;
  onChange: (text: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const align = isRTL ? 'right' : 'left';
  const state = rowState(row, max);
  const maxText = formatMark(max);
  const code = rowProblemCode(row, max);
  const problem = code ? paperTotalErrorText(t, code, max) : null;
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: problem ? colors.destructive : colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <View style={{ flex: 1, gap: SPACE.xxs }}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{row.name}</Text>
        {problem ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 19, textAlign: align }}>{problem}</Text>
        ) : null}
      </View>
      <TextInput
        value={row.text}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        editable={!locked}
        maxLength={6}
        accessibilityLabel={t('marksGridMarkLabel', row.name)}
        style={[styles.input, { color: colors.foreground, borderColor: problem ? colors.destructive : colors.border, backgroundColor: colors.background, opacity: locked ? 0.6 : 1 }]}
      />
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.label }}>{`\u2066/ ${maxText}\u2069`}</Text>
      <View style={styles.mark}>
        {state.dirty ? (
          <View accessible accessibilityLabel={t('marksGridUnsaved', '1')}>
            <Ionicons name="ellipse" size={10} color={palette.warning} />
          </View>
        ) : row.status.kind === 'saved' ? (
          <View accessible accessibilityLabel={t('marksGridSaved')}>
            <Ionicons name="checkmark-circle" size={20} color={palette.success} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, gap: SPACE.sm },
  headerTitle: { fontSize: TYPE.headline, color: '#fff' },
  banner: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md },
  row: { alignItems: 'center', gap: SPACE.md, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md },
  input: { width: SPACE.hero + SPACE.xxl, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.sm, fontSize: TYPE.bodyLg, textAlign: 'center', writingDirection: 'ltr' },
  mark: { width: SPACE.xxl, alignItems: 'center' },
  primary: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  secondary: { alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, borderRadius: RADIUS.md, borderWidth: 1.5 },
  releaseBox: { gap: SPACE.sm, padding: SPACE.lg, borderRadius: RADIUS.md, borderWidth: 1, marginTop: SPACE.sm },
});
