/**
 * «مشاريع الطلبة» — a teacher's list of who handed in a homework's project: one row per student on the
 * homework's class roster, with the state (not handed in, handed in, handed in late) and how many photos. A row
 * with a project opens it (`/homework-submissions/<homework>/<student>`, the detail screen); a row without one
 * is plain text. Reached from the «سلّم X من Y» button on a homework card in the class page.
 *
 * Traps this screen exists to avoid:
 * - A student who has only started (a draft) is invisible to the teacher by design, and that is the SERVER's
 *   guarantee, not this screen's: `listForTeacher` (api-server `lib/homeworkSubmission.ts`) joins only handed-in
 *   rows and reports a draft as `none` with no photos, which `homeworkSubmission.db.test.ts` pins. The screen
 *   adds a second layer (no photo count and no way in for a row without a hand-in, `rowOpensDetail`) but must
 *   not be what a draft's privacy rests on.
 * - «X of Y» is the card's: Y is `trackableCount` (the records with a student account), not the number of rows.
 *   A record without an account cannot hand in, so it reads «no account», never «not handed in yet».
 * - A failed load is an error with a retry, never an empty class. A 404 or 403 (not this teacher's homework, or
 *   not a project) cannot be retried away, so it has no retry. A reload that fails while a list is shown keeps
 *   that list and says so.
 * - Counts change on the detail screen (a project cleared), so the list is read again on every focus.
 * - The path carries a homework id and, on the detail screen, a minor's id: both stay out of analytics
 *   (`screenTracking.ts`).
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { teacherSubmissionsApi } from '@/services/teacherSubmissionsApi.default';
import {
  firstParam,
  rowOpensDetail,
  rowState,
  takeSubmissionsFlash,
  type TeacherSubmissionList,
  type TeacherSubmissionRow,
} from '@/services/teacherSubmissions';
import { stateLabelKey } from '@/services/homeworkSubmission';
import { submissionLook, type SubmissionLook } from '@/services/homeworkProject';
import { formatDueDate, projectSubmittedText } from '@/services/homework';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { Toast } from '@/components/ui/Toast';

/** `neutral`: not an error but a homework that is no longer there to list (a 404). */
type Failure = { message: string; final: boolean; neutral: boolean };
type ChipLook = { icon: React.ComponentProps<typeof Ionicons>['name']; tone: SubmissionLook['tone'] };
/** Neutral, and its own icon: a record that cannot hand in is not a student who has not yet. */
const NO_ACCOUNT_LOOK: ChipLook = { icon: 'person-remove-outline', tone: 'muted' };

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

export default function HomeworkSubmissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const params = useLocalSearchParams<{ homeworkId: string | string[] }>();
  const homeworkId = firstParam(params.homeworkId);

  const [data, setData] = useState<TeacherSubmissionList | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [toast, setToast] = useState('');
  /** A newer load wins over an older one still in flight. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!homeworkId) {
      setFailure({ message: t('errNotFound'), final: true, neutral: true });
      return;
    }
    const seq = ++loadSeq.current;
    try {
      const next = await teacherSubmissionsApi.list(homeworkId);
      if (seq !== loadSeq.current) return;
      setData(next);
      setFailure(null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      const status = statusOf(e);
      // Not this teacher's homework, or not a project (404), or not a teacher (403): retrying cannot change that.
      const final = status === 404 || status === 403;
      const message = status === 404 ? t('errNotFound') : apiErrorMessage(e, 'subListLoadFailed', t);
      // A final answer drops the list; a reload that fails otherwise keeps the one already shown, with the reason above it.
      if (final) setData(null);
      setFailure({ message, final, neutral: status === 404 });
    }
  }, [homeworkId, t]);

  // On every focus, not once: a project cleared on the detail screen changes this list's counts.
  useFocusEffect(
    useCallback(() => {
      void load();
      // The detail screen's «deleted» note, said here once, where it went back to.
      const flash = takeSubmissionsFlash(homeworkId);
      if (flash) setToast(t(flash));
    }, [load, t, homeworkId]),
  );

  const retry = () => {
    setFailure(null);
    void load();
  };

  const body = { color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align } as const;
  const muted = { ...body, color: colors.mutedForeground, fontSize: TYPE.caption, lineHeight: 20 } as const;
  const toneColor = (tone: SubmissionLook['tone']) =>
    tone === 'primary' ? colors.primary : tone === 'destructive' ? colors.destructive : colors.mutedForeground;

  const renderRow = ({ item: row }: { item: TeacherSubmissionRow }) => {
    const state = rowState(row);
    const look: ChipLook = state === 'noAccount' ? NO_ACCOUNT_LOOK : submissionLook(state);
    const opens = rowOpensDetail(row);
    const name = row.displayName || '—';
    const statusText = state === 'noAccount' ? t('subRowNoAccount') : t(stateLabelKey(state));
    const content = (
      <>
        <View style={styles.info}>
          <Text numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.label, textAlign: align }}>
            {name}
          </Text>
          {/* The state is an icon AND a word: never colour alone. */}
          <View style={[styles.chip, { flexDirection: rowDir, backgroundColor: colors.muted, alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={look.icon} size={ICON.md} color={toneColor(look.tone)} />
            <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption }}>{statusText}</Text>
          </View>
        </View>
        {opens ? (
          <>
            <View style={[styles.count, { flexDirection: rowDir }]}>
              <Ionicons name="images-outline" size={ICON.md} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>{row.photoCount}</Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={ICON.lg} color={colors.mutedForeground} />
          </>
        ) : null}
      </>
    );
    if (opens) {
      return (
        <PressableScale
          onPress={() => router.push(`/homework-submissions/${encodeURIComponent(homeworkId)}/${encodeURIComponent(row.studentId)}` as never)}
          accessibilityRole="button"
          aria-label={t('subRowOpenA11y', name, statusText, row.photoCount)}
          style={[styles.row, surface, { flexDirection: rowDir }]}
        >
          {content}
        </PressableScale>
      );
    }
    // No hand-in: nothing to open, so nothing that looks pressable and no way in.
    return (
      <View aria-disabled={true} style={[styles.row, surface, { flexDirection: rowDir }]}>
        {content}
      </View>
    );
  };

  // The card's own «X of Y» (clamped to Y, as the card does), so the two never disagree.
  const shown = data ? projectSubmittedText(data) : null;

  const renderList = () => {
    if (failure && (failure.final || !data)) {
      return (
        <View style={styles.center} accessibilityRole="alert">
          <Ionicons
            name={failure.neutral ? 'information-circle' : 'cloud-offline-outline'}
            size={ICON.xl}
            color={failure.neutral ? colors.mutedForeground : colors.destructive}
          />
          <Text style={[body, { color: failure.neutral ? colors.foreground : colors.destructive, textAlign: 'center' }]}>{failure.message}</Text>
          {failure.final ? null : <Button label={t('retry')} onPress={retry} variant="secondary" />}
        </View>
      );
    }
    if (!data) return <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.page }} />;
    return (
      <FlatList
        data={data.submissions}
        keyExtractor={row => row.studentId}
        renderItem={renderRow}
        ListHeaderComponent={
          failure ? (
            // A reload failed: the list below is the last one that loaded.
            <View style={[styles.notice, { flexDirection: rowDir }]} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={ICON.lg} color={colors.destructive} />
              <Text style={[muted, { flex: 1, color: colors.destructive }]}>{failure.message}</Text>
              <Button label={t('retry')} onPress={retry} variant="secondary" />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="people-outline" title={t('subListEmpty')} style={{ paddingTop: SPACE.xl, paddingHorizontal: 0 }} />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.page }]}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text accessibilityRole="header" style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {t('subListTitle')}
        </Text>
        {data && shown ? (
          <>
            {data.homework.title ? (
              <Text numberOfLines={2} style={[body, { marginTop: SPACE.xs }]}>
                {data.homework.title}
              </Text>
            ) : null}
            <View style={[styles.meta, { flexDirection: rowDir }]}>
              {data.homework.dueDate ? <Text style={muted}>{t('subListDue', formatDueDate(data.homework.dueDate))}</Text> : null}
              <Text style={[muted, { fontFamily: 'ReadexPro_500Medium' }]}>
                {t('hwSubmittedCount', shown.submitted, shown.of)}
              </Text>
            </View>
          </>
        ) : null}
      </View>
      {renderList()}
      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: SPACE.xs, marginBottom: SPACE.sm },
  meta: { flexWrap: 'wrap', alignItems: 'center', columnGap: SPACE.lg, rowGap: SPACE.xxs, marginTop: SPACE.xs },
  content: { padding: SPACE.lg, gap: SPACE.sm, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center: { alignItems: 'center', gap: SPACE.md, marginTop: SPACE.page, paddingHorizontal: SPACE.lg },
  row: { minHeight: 44, alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg },
  info: { flex: 1, gap: SPACE.xs },
  chip: { alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.xxs, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.pill },
  count: { alignItems: 'center', gap: SPACE.xs },
  notice: { alignItems: 'center', gap: SPACE.sm, paddingBottom: SPACE.md },
});
