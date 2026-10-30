/**
 * «مشروع الواجب» — a student's project for a homework that is handed in as one: up to six photos and an
 * optional note, then «سلّم». Opened from the School tab's homework row (never for a parent, and never for
 * a homework that is not a project — the API answers both with 404, which ends here in the error state).
 *
 * What may change is the server's decision (api-server `routes/homeworkSubmissions.ts`): a photo is stored
 * the moment it is uploaded, a removal deletes it there too, and after the due day the project is
 * `locked` and read-only. This screen holds only the note's draft; it is saved on blur (so leaving the
 * screen does not lose it) and again by the hand-in when it changed.
 *
 * Traps this screen exists to avoid:
 * - A failed load is an error with a retry, never an empty project. The client refuses a 2xx with no
 *   usable submission (homeworkSubmissionApi.ts), and a view without a real due day is refused here.
 * - Signed photo URLs live ten minutes, so the project is read again on every focus.
 * - An upload that timed out may have been stored: the view is read again before the student can retry,
 *   so a retry does not add a second copy of a photo they can already see.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { homeworkSubmissionApi } from '@/services/homeworkSubmissionApi.default';
import { pickHomeworkPhoto, type HomeworkPhotoPick } from '@/services/homeworkPhotoPick';
import {
  NOTE_MAX,
  canAddPhoto,
  canHandIn,
  noteChanged,
  stateLabelKey,
  type SubmissionPhoto,
  type SubmissionState,
  type SubmissionView,
} from '@/services/homeworkSubmission';
import { formatDueDate, isValidYmd } from '@/services/homework';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { confirm } from '@/services/confirm';
import { justCompleted } from '@/services/celebration';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { Toast } from '@/components/ui/Toast';
import { ImageViewerModal } from '@/components/ui/ImageViewer';
import { Celebrate } from '@/components/ui/Celebrate';

/** A photo slot's edge. Six fit in two rows of three on a 360-point phone. */
const SLOT = 104;

const STATUS_ICON: Record<SubmissionState, keyof typeof Ionicons.glyphMap> = {
  none: 'ellipse-outline',
  submitted: 'checkmark-circle',
  late: 'time',
};

type Busy = 'pick' | 'upload' | 'remove' | 'handIn' | null;
type Failure = { message: string; final: boolean };

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

/** No answer (offline, a timeout), or the server or a proxy failed after the write: the photo may be stored. */
function mayHaveStored(e: unknown): boolean {
  const status = statusOf(e);
  return typeof status !== 'number' || status >= 500;
}

/** The project changed under the screen (locked, emptied, a photo already gone): read it again. */
function isStale(e: unknown): boolean {
  const status = statusOf(e);
  return status === 409 || status === 404;
}

export default function HomeworkProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const { id } = useLocalSearchParams<{ id: string }>();

  const [view, setView] = useState<SubmissionView | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusyState] = useState<Busy>(null);
  const [toast, setToast] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // Read by the handlers, which outlive a render (a blur save runs after the screen has left).
  const viewRef = useRef<SubmissionView | null>(null);
  const draftRef = useRef('');
  /** The note the server holds, or null before the first load. */
  const savedNoteRef = useRef<string | null>(null);
  const busyRef = useRef<Busy>(null);
  const noteSave = useRef<Promise<void> | null>(null);
  /** A newer load, or a change made here, wins over an older load still in flight. */
  const loadSeq = useRef(0);

  const setBusy = (next: Busy) => {
    busyRef.current = next;
    setBusyState(next);
  };
  const say = (message: string) => setToast(message);

  const setDraftBoth = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  /** Take a view from the server. The draft follows it only while the student has not changed it. */
  const applyView = useCallback((next: SubmissionView) => {
    const saved = savedNoteRef.current;
    if (saved === null || !noteChanged(saved, draftRef.current)) {
      draftRef.current = next.note;
      setDraft(next.note);
    }
    savedNoteRef.current = next.note;
    viewRef.current = next;
    setView(next);
  }, []);

  /** A change made on this screen: any load already in flight is older than it. */
  const patchView = (fn: (v: SubmissionView) => SubmissionView) => {
    loadSeq.current++;
    const current = viewRef.current;
    if (!current) return;
    const next = fn(current);
    viewRef.current = next;
    setView(next);
  };

  /** `quiet`: a failure while a view is shown says nothing (the caller already said why). */
  const load = useCallback(
    async (quiet = false) => {
      if (!id) {
        setFailure({ message: t('errNotFound'), final: true });
        return;
      }
      const seq = ++loadSeq.current;
      try {
        const next = await homeworkSubmissionApi.get(id);
        if (seq !== loadSeq.current) return;
        if (!isValidYmd(next.dueDate)) throw new Error('A project without a due day');
        setDueDate(next.dueDate);
        applyView(next.submission);
        setFailure(null);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        const status = statusOf(e);
        // A 404 (not a project, not this student's class) or a 403 (not a student) cannot be retried away.
        const final = status === 404 || status === 403;
        const message = status === 404 ? t('errNotFound') : apiErrorMessage(e, 'projectLoadFailed', t);
        if (viewRef.current && !final) {
          if (!quiet) say(message);
          return;
        }
        viewRef.current = null;
        setView(null);
        setFailure({ message, final });
      }
    },
    [id, t, applyView],
  );

  /** Saves a changed note. One at a time; the hand-in waits for it and saves any later edit itself. */
  const saveDraft = () => {
    const current = viewRef.current;
    if (!id || !current || current.locked || noteSave.current || busyRef.current === 'handIn') return;
    if (!noteChanged(savedNoteRef.current ?? '', draftRef.current)) return;
    noteSave.current = homeworkSubmissionApi
      .saveNote(id, draftRef.current)
      .then(next => {
        // Only the note: an upload that finished meanwhile must not be dropped by an older photo list.
        savedNoteRef.current = next.note;
        patchView(v => ({ ...v, note: next.note }));
      })
      .catch(e => {
        say(apiErrorMessage(e, 'projectSaveFailed', t));
        if (isStale(e)) void load(true);
      })
      .finally(() => {
        noteSave.current = null;
      });
  };
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // On every focus, not once: a signed photo URL lives ten minutes. Leaving saves the note.
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => saveDraftRef.current();
    }, [load]),
  );

  const retry = () => {
    setFailure(null);
    void load();
  };

  const addPhoto = async () => {
    const current = viewRef.current;
    if (!id || !current || busyRef.current !== null || !canAddPhoto(current)) return;
    setBusy('pick');
    let pick: HomeworkPhotoPick;
    try {
      pick = await pickHomeworkPhoto();
    } catch {
      setBusy(null);
      say(t('projectPickFailed'));
      return;
    }
    if (pick.kind === 'cancelled') {
      setBusy(null);
      return;
    }
    if (pick.kind === 'denied') {
      setBusy(null);
      say(t('projectPermissionDenied'));
      return;
    }
    if (pick.kind === 'unsupported') {
      setBusy(null);
      say(t('errBadImage'));
      return;
    }
    setBusy('upload');
    try {
      const { photo } = await homeworkSubmissionApi.uploadPhoto(id, pick.dataUrl);
      // A reload that landed meanwhile may already list it.
      patchView(v => (v.photos.some(p => p.id === photo.id) ? v : { ...v, photos: [...v.photos, photo] }));
    } catch (e) {
      say(apiErrorMessage(e, 'projectUploadFailed', t));
      // Read the project again before the student can retry, so a stored photo shows instead of uploading twice.
      if (mayHaveStored(e) || isStale(e)) await load(true);
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (photo: SubmissionPhoto) => {
    const current = viewRef.current;
    if (!id || !current || current.locked || busyRef.current !== null) return;
    const ok = await confirm({
      title: t('projectRemoveConfirmTitle'),
      message: t('projectRemoveConfirmBody'),
      confirmLabel: t('projectRemovePhoto'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok || busyRef.current !== null) return;
    setBusy('remove');
    try {
      await homeworkSubmissionApi.removePhoto(id, photo.id);
      patchView(v => ({ ...v, photos: v.photos.filter(p => p.id !== photo.id) }));
    } catch (e) {
      say(apiErrorMessage(e, 'projectRemoveFailed', t));
      if (isStale(e) || mayHaveStored(e)) await load(true);
    } finally {
      setBusy(null);
    }
  };

  const handIn = async () => {
    const before = viewRef.current;
    if (!id || !before || busyRef.current !== null || !canHandIn(before, draftRef.current)) return;
    setBusy('handIn');
    try {
      if (noteSave.current) await noteSave.current;
      const next = await homeworkSubmissionApi.handIn(id, savedNoteRef.current ?? '', draftRef.current);
      const crossed = justCompleted({ key: id, complete: before.status !== 'none' }, { key: id, complete: next.status !== 'none' });
      loadSeq.current++;
      applyView(next);
      // Celebrated once, on the crossing made here; a late hand-in is acknowledged, not celebrated.
      if (crossed && next.status === 'submitted') setCelebrate(true);
      else say(t('projectHandedIn'));
    } catch (e) {
      say(apiErrorMessage(e, 'projectHandInFailed', t));
      if (isStale(e)) await load(true);
    } finally {
      setBusy(null);
    }
  };

  const statusColor = (s: SubmissionState) => (s === 'submitted' ? colors.success : s === 'late' ? colors.warning : colors.mutedForeground);
  const body = { color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align } as const;
  const muted = { ...body, color: colors.mutedForeground, fontSize: TYPE.caption, lineHeight: 20 } as const;
  const heading = { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align } as const;

  const renderBody = () => {
    if (failure) {
      return (
        <View style={styles.center} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={ICON.xl} color={colors.destructive} />
          <Text style={[body, { color: colors.destructive, textAlign: 'center' }]}>{failure.message}</Text>
          {failure.final ? null : <Button label={t('projectRetry')} onPress={retry} variant="secondary" />}
        </View>
      );
    }
    if (!view) return <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.page }} />;

    const inFlight = busy !== null;
    const showNote = !view.locked || view.note.trim() !== '';
    return (
      <>
        <View style={[styles.card, surface]}>
          <View style={[styles.line, row]}>
            <Ionicons name={STATUS_ICON[view.status]} size={ICON.lg} color={statusColor(view.status)} />
            <Text style={[heading, { flex: 1 }]}>{t(stateLabelKey(view.status))}</Text>
          </View>
          {view.status === 'late' ? <Text style={muted}>{t('projectLateNote')}</Text> : null}
          {view.locked ? (
            <View style={[styles.line, row]}>
              <Ionicons name="lock-closed-outline" size={ICON.md} color={colors.mutedForeground} />
              <Text style={[muted, { flex: 1 }]}>{t('projectLocked')}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, surface]}>
          <View style={[styles.line, row]}>
            <Text style={[heading, { flex: 1 }]}>{t('projectPhotos')}</Text>
            <Text style={muted}>{t('projectPhotosCount', view.photos.length)}</Text>
          </View>
          {view.locked && view.photos.length === 0 ? <Text style={muted}>{t('projectNoPhotos')}</Text> : null}
          <View style={[styles.grid, row]}>
            {view.photos.map((photo, i) => (
              <View key={photo.id} style={styles.slot}>
                <PressableScale
                  onPress={() => (photo.url ? setViewerUrl(photo.url) : undefined)}
                  disabled={!photo.url}
                  aria-disabled={!photo.url}
                  accessibilityLabel={photo.url ? t('projectOpenPhoto', i + 1) : t('projectPhotoUnavailable')}
                  style={[styles.thumb, { backgroundColor: colors.muted }]}
                >
                  {photo.url ? (
                    <Image source={{ uri: photo.url }} style={styles.thumbImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={ICON.xl} color={colors.mutedForeground} />
                  )}
                </PressableScale>
                {view.locked ? null : (
                  <Pressable
                    onPress={() => void removePhoto(photo)}
                    disabled={inFlight}
                    aria-disabled={inFlight}
                    accessibilityRole="button"
                    accessibilityLabel={t('projectRemovePhoto')}
                    style={[styles.remove, isRTL ? { left: 0 } : { right: 0 }]}
                  >
                    <View style={[styles.removeDot, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="trash-outline" size={ICON.md} color={colors.destructive} />
                    </View>
                  </Pressable>
                )}
              </View>
            ))}
            {canAddPhoto(view) ? (
              <PressableScale
                onPress={() => void addPhoto()}
                disabled={inFlight}
                aria-disabled={inFlight}
                aria-busy={busy === 'pick' || busy === 'upload'}
                accessibilityLabel={busy === 'upload' ? t('projectUploading') : t('projectAddPhoto')}
                style={[styles.slot, styles.add, { backgroundColor: colors.secondary, borderColor: colors.primary }]}
              >
                {busy === 'upload' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons name="add" size={ICON.xl} color={colors.primary} />
                )}
                <Text style={[styles.addLabel, { color: colors.secondaryForeground }]}>
                  {busy === 'upload' ? t('projectUploading') : t('projectAddPhoto')}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </View>

        {showNote ? (
          <View style={[styles.card, surface]}>
            <Input
              label={t('projectNote')}
              isRTL={isRTL}
              value={draft}
              onChangeText={setDraftBoth}
              onBlur={() => saveDraft()}
              multiline
              maxLength={NOTE_MAX}
              editable={!view.locked}
              placeholder={t('projectNotePlaceholder')}
              textAlignVertical="top"
              style={styles.noteInput}
            />
            {view.locked ? null : <Text style={[muted, styles.counter]}>{t('projectNoteCounter', draft.length)}</Text>}
          </View>
        ) : null}

        {view.locked ? null : (
          <Button
            label={view.status === 'none' ? t('projectHandIn') : t('projectReplace')}
            onPress={() => void handIn()}
            disabled={!canHandIn(view, draft) || inFlight}
            loading={busy === 'handIn'}
            fullWidth
          />
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {t('projectTitle')}
        </Text>
        {dueDate ? <Text style={[muted, { marginTop: SPACE.xs }]}>{t('projectDue', formatDueDate(dueDate))}</Text> : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.page }]}
      >
        {renderBody()}
      </ScrollView>

      <ImageViewerModal url={viewerUrl} onClose={() => setViewerUrl(null)} />
      <Toast visible={!!toast} message={toast} onHide={() => setToast('')} />
      <Celebrate visible={celebrate} message={t('projectHandedIn')} onDone={() => setCelebrate(false)} />
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
  slot: { width: SLOT, height: SLOT },
  thumb: { flex: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
  // 44 points to tap, a smaller dot to see, in the slot's top corner.
  remove: { position: 'absolute', top: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeDot: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: { borderRadius: RADIUS.md, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, padding: SPACE.xs },
  addLabel: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption, textAlign: 'center' },
  noteInput: { minHeight: 120, paddingTop: SPACE.md },
  counter: { marginTop: -SPACE.md },
});
