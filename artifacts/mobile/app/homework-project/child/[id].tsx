/**
 * «مشروع الواجب» as a parent reads it: their child's handed-in project for one homework — the state and when it was
 * handed in, the photos (tap to enlarge), the note. Read-only; nothing here writes. Opened from a project row of
 * «المدرسة» (`/homework-project/child/<homework>?child=<key>&title=<homework title>`), which shows the link only once
 * the child has handed in.
 *
 * The server (`GET /parent/homework/:id/submissions`) answers one entry per child of this account in the homework's
 * class, and never a draft: a child who has not handed in reads as `none`. `child` picks the one «المدرسة» was showing;
 * a key that matches nobody shows every child in the answer (`childrenToShow`), never an empty screen.
 *
 * Under `/homework-project` on purpose: that prefix is already open to parents (`routeGating.ts`) and already kept out
 * of analytics (`screenTracking.ts`), since it shows a minor's photos. A student who reaches this path gets the
 * server's 403, shown as «no longer available».
 *
 * The photo grid and the viewer are the teacher's detail screen's wiring
 * (`app/homework-submissions/[homeworkId]/[studentId].tsx`) without its delete:
 * - A failed load is an error with a retry, never an empty project. A 404 or 403 cannot be retried away: a neutral
 *   «no longer available» with a way back.
 * - Signed photo URLs live ten minutes, so the project is read again on every focus. A photo whose link fails while the
 *   screen stays open is drawn as the «not available» placeholder and cannot be opened (`failedPhotos`, emptied by
 *   every successful read).
 */
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { parentProjectApi } from '@/services/parentProjectApi.default';
import { childrenToShow, type ChildProject } from '@/services/parentProjectApi';
import { firstParam, formatHandedInAt } from '@/services/teacherSubmissions';
import { stateLabelKey } from '@/services/homeworkSubmission';
import { photoSlotSize, submissionLook, type SubmissionLook } from '@/services/homeworkProject';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { Toast } from '@/components/ui/Toast';
import { ImageViewerModal } from '@/components/ui/ImageViewer';

/** `neutral`: not an error but a project that is not there for this account (a 404 or 403). */
type Failure = { message: string; final: boolean; neutral: boolean };

/** No photo has failed to load. One shared set, so resetting to it is not a render when nothing failed. */
const NO_FAILED_PHOTOS: ReadonlySet<string> = new Set();

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

export default function ChildProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { width } = useWindowDimensions();
  // The grid's width: the window (capped), less the page's and the card's padding on both sides, and a dark card's
  // 1-point borders. Three slots to a row where that allows (photoSlotSize).
  const slot = photoSlotSize(Math.min(width, CONTENT_MAX_WIDTH) - 4 * SPACE.lg - 2, SPACE.sm);
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const params = useLocalSearchParams<{ id?: string | string[]; child?: string | string[]; title?: string | string[] }>();
  const homeworkId = firstParam(params.id);
  const childKey = firstParam(params.child);
  const title = firstParam(params.title);

  const [children, setChildren] = useState<ChildProject[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [toast, setToast] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  /** Photos whose link failed to load, by id; emptied by every successful read. */
  const [failedPhotos, setFailedPhotos] = useState<ReadonlySet<string>>(NO_FAILED_PHOTOS);

  /** A newer load wins over an older one still in flight. */
  const loadSeq = useRef(0);
  /** A project is on screen (read by `load`, which outlives a render). */
  const hasData = useRef(false);

  const load = useCallback(async () => {
    if (!homeworkId) {
      setFailure({ message: t('errNotFound'), final: true, neutral: true });
      return;
    }
    const seq = ++loadSeq.current;
    try {
      const next = await parentProjectApi.get(homeworkId);
      if (seq !== loadSeq.current) return;
      hasData.current = true;
      setChildren(next);
      setFailure(null);
      setFailedPhotos(NO_FAILED_PHOTOS);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      const status = statusOf(e);
      // Not a project of this account's children, archived meanwhile (404), or not a parent (403): a retry cannot change that.
      const final = status === 404 || status === 403;
      const message = final ? t('errNotFound') : apiErrorMessage(e, 'projectLoadFailed', t);
      // A reload that fails while the project is shown keeps it, with the reason in a note.
      if (hasData.current && !final) {
        setToast(message);
        return;
      }
      hasData.current = false;
      setChildren(null);
      setFailure({ message, final, neutral: final });
    }
  }, [homeworkId, t]);

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

  /** Back to «المدرسة»; with nothing to go back to (a refreshed web tab, a shared link) to the tab itself. */
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/school' as never);
  };

  // The same look as «المدرسة»'s chip (submissionLook): late is destructive, never amber.
  const toneColor = (tone: SubmissionLook['tone']) =>
    tone === 'primary' ? colors.primary : tone === 'destructive' ? colors.destructive : colors.mutedForeground;
  const body = { color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, lineHeight: 24, textAlign: align } as const;
  const muted = { ...body, color: colors.mutedForeground, fontSize: TYPE.caption, lineHeight: 20 } as const;
  const heading = { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: align } as const;

  const shown = children ? childrenToShow(children, childKey) : [];
  // Each child's name heads their section only when there is more than one: one child's name is already the subtitle.
  const named = shown.length > 1;

  const renderChild = (c: ChildProject) => {
    const sub = c.submission;
    const look = submissionLook(sub.status);
    const handedIn = formatHandedInAt(sub.submittedAt, lang);
    const slotSize = { width: slot, height: slot };
    return (
      <View key={c.key} style={{ gap: SPACE.md }}>
        {named ? <Text style={[heading, { fontFamily: 'ReadexPro_700Bold' }]}>{c.displayName}</Text> : null}
        <View style={[styles.card, surface]}>
          <View style={[styles.line, row]}>
            <Ionicons name={look.icon} size={ICON.lg} color={toneColor(look.tone)} />
            <Text style={[heading, { flex: 1 }]}>{t(stateLabelKey(sub.status))}</Text>
          </View>
          {handedIn ? <Text style={muted}>{t('subHandedInAt', handedIn)}</Text> : null}
          {sub.status === 'late' ? <Text style={muted}>{t('projectLateNote')}</Text> : null}
          {sub.status === 'none' ? <Text style={muted}>{t('childProjectNotHandedIn')}</Text> : null}
        </View>

        {sub.status === 'none' ? null : (
          <>
            <View style={[styles.card, surface]}>
              <View style={[styles.line, row]}>
                <Text style={[heading, { flex: 1 }]}>{t('projectPhotos')}</Text>
                <Text style={muted}>{t('projectPhotosCount', sub.photos.length)}</Text>
              </View>
              {sub.photos.length === 0 ? <Text style={muted}>{t('projectNoPhotos')}</Text> : null}
              <View style={[styles.grid, row]}>
                {sub.photos.map((photo, i) => {
                  // No link, or a link that failed to load: the placeholder, and nothing to open.
                  const url = photo.url && !failedPhotos.has(photo.id) ? photo.url : null;
                  return (
                    <View key={photo.id} style={slotSize}>
                      <PressableScale
                        onPress={() => (url ? setViewerUrl(url) : undefined)}
                        disabled={!url}
                        aria-disabled={!url}
                        accessibilityLabel={url ? t('projectOpenPhoto', i + 1) : t('projectPhotoUnavailable')}
                        style={[styles.thumb, { backgroundColor: colors.muted }]}
                      >
                        {url ? (
                          // The signed URL changes on every reload; the photo does not.
                          <Image
                            source={{ uri: url, cacheKey: photo.id }}
                            onError={() => setFailedPhotos(prev => (prev.has(photo.id) ? prev : new Set(prev).add(photo.id)))}
                            style={styles.thumbImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Ionicons name="image-outline" size={ICON.xl} color={colors.mutedForeground} />
                        )}
                      </PressableScale>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, surface]}>
              <Text style={heading}>{t('childProjectNote')}</Text>
              {sub.note.trim() ? (
                <Text selectable style={body}>
                  {sub.note}
                </Text>
              ) : (
                <Text style={muted}>{t('subNoNote')}</Text>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

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
    if (!children) return <ActivityIndicator color={colors.primary} style={{ marginTop: SPACE.page }} />;
    // The server answered, but with no child of this account in the class (a 2xx with an empty list): nothing to show.
    if (shown.length === 0) {
      return (
        <View style={styles.center}>
          <Ionicons name="information-circle" size={ICON.xl} color={colors.mutedForeground} />
          <Text style={[body, { textAlign: 'center' }]}>{t('errNotFound')}</Text>
          <Button label={t('back')} onPress={leave} variant="secondary" />
        </View>
      );
    }
    return shown.map(renderChild);
  };

  const subtitle = !named && shown[0]?.displayName ? shown[0].displayName : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.foreground} onPress={leave} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
        <Text accessibilityRole="header" numberOfLines={2} style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
          {title || t('projectTitle')}
        </Text>
        {subtitle ? <Text style={[muted, { fontSize: TYPE.body, marginTop: SPACE.xs }]}>{subtitle}</Text> : null}
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
  content: { padding: SPACE.lg, gap: SPACE.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  center: { alignItems: 'center', gap: SPACE.md, marginTop: SPACE.page, paddingHorizontal: SPACE.lg },
  card: { padding: SPACE.lg, gap: SPACE.md },
  line: { alignItems: 'center', gap: SPACE.sm },
  grid: { flexWrap: 'wrap', gap: SPACE.sm },
  thumb: { flex: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%', borderRadius: RADIUS.md },
});
