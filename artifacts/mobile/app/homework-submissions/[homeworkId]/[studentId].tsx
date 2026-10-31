/**
 * «مشروع الطالب» — one student's handed-in project as the teacher reads it: the state and when it was handed in,
 * the photos (tap to enlarge), the note, and «حذف المشروع». Opened from a handed-in row of the list screen
 * (`/homework-submissions/<homework>/<student>`); a row without a hand-in has no way here, and the server answers
 * 404 for a draft, a missing project or a student outside the teacher's class.
 *
 * Read-only apart from the one delete. The photo grid and the viewer are the student screen's wiring
 * (`app/homework-project/[id].tsx`) without its controls; that screen is deliberately not shared or touched.
 *
 * Deleting is the server's `DELETE /homework/:id/submissions/:studentId` (teacherSubmissionsApi `clear`, whose doc
 * comment states the outcomes this screen branches on). It asks first, says the photos and note go for good, that the
 * student's done tick is removed and that the student can start again, and only then calls the server:
 * - success: back to the list, which reloads on focus, with a «deleted» note the list shows (the Toast outlives the
 *   navigation through `rememberSubmissionsFlash`, because this screen is gone by the time a Toast would draw);
 * - 404: the project is already gone (a repeat of a clear that went through, a clear from another device). That is
 *   not a failure: back to the list with a neutral note;
 * - anything else (a 5xx, no network, a 2xx that does not say it cleared): «couldn't delete», stay, and read the
 *   project again, which shows what is really there (a clear that did go through ends as «already gone», a half
 *   clear shows photos that no longer load as placeholders). The same button sends the delete again.
 *
 * Traps this screen exists to avoid:
 * - A failed load is an error with a retry, never an empty project. A 404 or 403 cannot be retried away: a neutral
 *   «no longer available» with a way back (the project may have been cleared meanwhile), and no loop.
 * - Signed photo URLs live ten minutes, so the project is read again on every focus.
 * - A double tap on the button must not open two dialogs or send two deletes: a ref claims the handler before the
 *   dialog opens and releases it when everything is over.
 * - The path carries a homework id and a minor's id: both stay out of analytics (`screenTracking.ts`).
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { teacherSubmissionsApi } from '@/services/teacherSubmissionsApi.default';
import {
  firstParam,
  formatHandedInAt,
  rememberSubmissionsFlash,
  type SubmissionsFlash,
  type TeacherSubmissionDetail,
} from '@/services/teacherSubmissions';
import { stateLabelKey } from '@/services/homeworkSubmission';
import { photoSlotSize, submissionLook, type SubmissionLook } from '@/services/homeworkProject';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { confirm } from '@/services/confirm';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { Toast } from '@/components/ui/Toast';
import { ImageViewerModal } from '@/components/ui/ImageViewer';

/** `neutral`: not an error but a project that is no longer there (a 404). */
type Failure = { message: string; final: boolean; neutral: boolean };

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

export default function HomeworkSubmissionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { width } = useWindowDimensions();
  // The grid's width: the window (capped), less the page's and the card's padding on both sides, and a
  // dark card's 1-point borders. Three slots to a row where that allows (photoSlotSize).
  const slot = photoSlotSize(Math.min(width, CONTENT_MAX_WIDTH) - 4 * SPACE.lg - 2, SPACE.sm);
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const params = useLocalSearchParams<{ homeworkId?: string | string[]; studentId?: string | string[] }>();
  const homeworkId = firstParam(params.homeworkId);
  const studentId = firstParam(params.studentId);

  const [detail, setDetail] = useState<TeacherSubmissionDetail | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  /** A newer load wins over an older one still in flight. */
  const loadSeq = useRef(0);
  /** A project is on screen (read by `load`, which outlives a render). */
  const hasDetail = useRef(false);
  /** The delete handler is running, from the tap to the end: a second tap does nothing. */
  const clearingRef = useRef(false);

  const say = (message: string) => setToast(message);

  const load = useCallback(async () => {
    if (!homeworkId || !studentId) {
      setFailure({ message: t('errNotFound'), final: true, neutral: true });
      return;
    }
    const seq = ++loadSeq.current;
    try {
      const next = await teacherSubmissionsApi.detail(homeworkId, studentId);
      if (seq !== loadSeq.current) return;
      hasDetail.current = true;
      setDetail(next);
      setFailure(null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      const status = statusOf(e);
      // Not this teacher's project, or cleared meanwhile (404), or not a teacher (403): retrying cannot change that.
      const final = status === 404 || status === 403;
      const message = status === 404 ? t('errNotFound') : apiErrorMessage(e, 'subDetailLoadFailed', t);
      // A reload that fails while the project is shown keeps it, with the reason in a note.
      if (hasDetail.current && !final) {
        say(message);
        return;
      }
      hasDetail.current = false;
      setDetail(null);
      setFailure({ message, final, neutral: status === 404 });
    }
  }, [homeworkId, studentId, t]);

  // On every focus, not once: a signed photo URL lives ten minutes.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = () => {
    setFailure(null);
    void load();
  };

  /** Back to the list; with nothing to go back to (a refreshed web tab, a shared link) to the list itself. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace((homeworkId ? `/homework-submissions/${encodeURIComponent(homeworkId)}` : '/') as never);
  };

  /** Leave a note for the list to show, then leave: this screen is gone before a Toast of its own could draw. */
  const leaveWith = (key: SubmissionsFlash) => {
    rememberSubmissionsFlash(key);
    leave();
  };

  /**
   * After a delete that did not end cleanly: read the project again. Nothing there (404) means the delete went
   * through after all, so it is «already gone»; a project still there is shown as it is now.
   */
  const recheck = async () => {
    const seq = ++loadSeq.current;
    try {
      const next = await teacherSubmissionsApi.detail(homeworkId, studentId);
      if (seq !== loadSeq.current) return;
      hasDetail.current = true;
      setDetail(next);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (statusOf(e) === 404) leaveWith('subAlreadyGone');
    }
  };

  const clearProject = async () => {
    if (clearingRef.current || !homeworkId || !studentId) return;
    clearingRef.current = true;
    try {
      const ok = await confirm({
        title: t('subDeleteTitle'),
        message: t('subDeleteBody'),
        confirmLabel: t('subDeleteProject'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
      setClearing(true);
      await teacherSubmissionsApi.clear(homeworkId, studentId);
      leaveWith('subDeleted');
    } catch (e) {
      // Nothing left to clear: it is already gone, which is what the teacher wanted, not a failure.
      if (statusOf(e) === 404) {
        leaveWith('subAlreadyGone');
        return;
      }
      say(t('subDeleteFailed'));
      await recheck();
    } finally {
      clearingRef.current = false;
      setClearing(false);
    }
  };

  // The same look as the list's chip (submissionLook): late is destructive, never amber.
  const toneColor = (tone: SubmissionLook['tone']) =>
    tone === 'primary' ? colors.primary : tone === 'destructive' ? colors.destructive : colors.mutedForeground;
  const body = { color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align } as const;
  const muted = { ...body, color: colors.mutedForeground, fontSize: TYPE.caption, lineHeight: 20 } as const;
  const heading = { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align } as const;

  const renderBody = () => {
    if (failure) {
      return (
        <View style={styles.center} accessibilityRole="alert">
          <Ionicons
            name={failure.neutral ? 'information-circle' : 'cloud-offline-outline'}
            size={ICON.xl}
            color={failure.neutral ? colors.mutedForeground : colors.destructive}
          />
          <Text style={[body, { color: failure.neutral ? colors.foreground : colors.destructive, textAlign: 'center' }]}>{failure.message}</Text>
          {failure.final ? (
            <Button label={t('back')} onPress={leave} variant="secondary" />
          ) : (
            <Button label={t('retry')} onPress={retry} variant="secondary" />
          )}
        </View>
      );
    }
    if (!detail) return <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.page }} />;

    const slotSize = { width: slot, height: slot };
    const look = submissionLook(detail.submission.status);
    const handedIn = formatHandedInAt(detail.submission.submittedAt, lang);
    return (
      <>
        <View style={[styles.card, surface]}>
          <View style={[styles.line, row]}>
            <Ionicons name={look.icon} size={ICON.lg} color={toneColor(look.tone)} />
            <Text style={[heading, { flex: 1 }]}>{t(stateLabelKey(detail.submission.status))}</Text>
          </View>
          {handedIn ? <Text style={muted}>{t('subHandedInAt', handedIn)}</Text> : null}
          {detail.submission.status === 'late' ? <Text style={muted}>{t('projectLateNote')}</Text> : null}
        </View>

        <View style={[styles.card, surface]}>
          <View style={[styles.line, row]}>
            <Text style={[heading, { flex: 1 }]}>{t('projectPhotos')}</Text>
            <Text style={muted}>{t('projectPhotosCount', detail.submission.photos.length)}</Text>
          </View>
          {detail.submission.photos.length === 0 ? <Text style={muted}>{t('projectNoPhotos')}</Text> : null}
          <View style={[styles.grid, row]}>
            {detail.submission.photos.map((photo, i) => (
              <View key={photo.id} style={slotSize}>
                <PressableScale
                  onPress={() => (photo.url ? setViewerUrl(photo.url) : undefined)}
                  disabled={!photo.url}
                  aria-disabled={!photo.url}
                  accessibilityLabel={photo.url ? t('projectOpenPhoto', i + 1) : t('projectPhotoUnavailable')}
                  style={[styles.thumb, { backgroundColor: colors.muted }]}
                >
                  {photo.url ? (
                    // The signed URL changes on every reload; the photo does not.
                    <Image source={{ uri: photo.url, cacheKey: photo.id }} style={styles.thumbImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={ICON.xl} color={colors.mutedForeground} />
                  )}
                </PressableScale>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, surface]}>
          <Text style={heading}>{t('subNote')}</Text>
          {detail.submission.note.trim() ? (
            <Text selectable style={body}>
              {detail.submission.note}
            </Text>
          ) : (
            <Text style={muted}>{t('subNoNote')}</Text>
          )}
        </View>

        <Button
          label={t('subDeleteProject')}
          onPress={() => void clearProject()}
          variant="destructive"
          loading={clearing}
          fullWidth
        />
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} onPress={leave} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text accessibilityRole="header" numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {detail?.student.displayName || t('subDetailTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.page }]}>{renderBody()}</ScrollView>

      <ImageViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />
      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.xl, paddingBottom: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { padding: SPACE.xs, marginBottom: SPACE.sm },
  content: { padding: SPACE.lg, gap: SPACE.md, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center: { alignItems: 'center', gap: SPACE.md, marginTop: SPACE.page, paddingHorizontal: SPACE.lg },
  card: { padding: SPACE.lg, gap: SPACE.md },
  line: { alignItems: 'center', gap: SPACE.sm },
  grid: { flexWrap: 'wrap', gap: SPACE.sm },
  thumb: { flex: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
});
