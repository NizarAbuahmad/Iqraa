import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { pickLessonFiles, pickLessonPhotos } from '@/services/lessonMediaPick';
import {
  listLibrary, saveLibraryLink, uploadLessonMedia, type LessonMediaItem,
} from '@/services/lessonMediaApi';
import { classifyMediaUrl, videoCaption, type AttachedResource } from '@/services/classMedia';
import { bookFigureRefsForLesson } from '@/services/bookFigureUri';
import { searchDeckPhotos, markPhotoUsed, type DeckPhoto } from '@/services/unsplashImage';
import { searchDeckVideos, type DeckVideo } from '@/services/youtubeVideo';
import { getItems, type SavedMaterial } from '@/services/workspace';

const TEAL = '#1B6B62';

type Tab = 'library' | 'book' | 'search' | 'games';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * The lesson being planned. Drives the book-figures tab and pins anything
   * uploaded here to that lesson as well as filing it in the library. Empty
   * when the topic is not a grounded lesson — the book tab then has nothing
   * to show and hides itself.
   */
  lessonId?: string;
  /** Seeds the search box, e.g. with the lesson title. */
  defaultQuery?: string;
  /** Chosen media, ready for `insertLessonResources`. */
  onPick: (items: AttachedResource[]) => void;
  /**
   * Chosen game. Omit and the games tab is hidden — a host that cannot merge
   * another deck's slides should not offer to.
   */
  onPickGame?: (material: SavedMaterial) => void;
};

/**
 * Everything a teacher can drop into a lesson, in one sheet.
 *
 * Four sources, deliberately not merged into one list: they have genuinely
 * different properties and a teacher chooses between them knowingly.
 *
 *   مكتبتي  — their own uploads and saved links, reusable across every lesson.
 *   الكتاب  — figures from the curriculum book, bundled in the app. No network.
 *   بحث     — Unsplash and YouTube. Nothing is stored; picking saves a link.
 *   ألعاب   — games they have already built, as whole decks.
 *
 * Everything leaves through `AttachedResource`, the shape
 * `insertLessonResources` already consumes, so no caller learns a new type.
 * Items that came from the library carry their `id` so a saved deck can be
 * re-signed later — see `refreshDeckMedia`.
 */
export function MediaLibraryPicker({
  visible, onClose, lessonId = '', defaultQuery = '', onPick, onPickGame,
}: Props) {
  const colors = useColors();
  const { lang, isRTL } = useLanguage();
  const isAr = lang === 'ar';

  const [tab, setTab] = useState<Tab>('library');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [items, setItems] = useState<LessonMediaItem[]>([]);
  const [filter, setFilter] = useState('');

  const [query, setQuery] = useState(defaultQuery);
  const [photos, setPhotos] = useState<DeckPhoto[]>([]);
  const [videos, setVideos] = useState<DeckVideo[]>([]);
  const [searched, setSearched] = useState(false);

  const [games, setGames] = useState<SavedMaterial[]>([]);

  const figures = useMemo(
    () => (lessonId ? bookFigureRefsForLesson(lessonId, isAr) : []),
    [lessonId, isAr],
  );

  const reloadLibrary = useCallback(async (q: string) => {
    setBusy(true);
    setItems(await listLibrary({ q }));
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    void reloadLibrary('');
    setError('');
  }, [visible, reloadLibrary]);

  useEffect(() => {
    if (!visible || tab !== 'games' || !onPickGame) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      // A game is a deck, so it is saved as 'slides'; 'activity' rows are the
      // other thing a teacher may reasonably want to reuse whole.
      const [slides, activities] = await Promise.all([
        getItems({ type: 'slides' }),
        getItems({ type: 'activity' }),
      ]);
      if (!cancelled) {
        setGames([...slides, ...activities]);
        setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, tab, onPickGame]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError('');
    const [foundPhotos, foundVideos] = await Promise.all([
      searchDeckPhotos(q),
      searchDeckVideos(q, isAr ? 'ar' : 'en'),
    ]);
    setPhotos(foundPhotos);
    setVideos(foundVideos);
    setSearched(true);
    setBusy(false);
  };

  /** Upload, then hand the new item straight back — no second trip to the list. */
  const upload = async (pick: () => Promise<string[]>) => {
    setError('');
    const dataUrls = await pick();
    if (dataUrls.length === 0) return; // cancelled
    setBusy(true);
    const added: AttachedResource[] = [];
    let failures = 0;
    for (const dataUrl of dataUrls) {
      try {
        const item = await uploadLessonMedia(lessonId, dataUrl, '');
        if (item.url) added.push({ kind: item.kind, url: item.url, caption: item.caption, id: item.id });
      } catch (e) {
        failures += 1;
        setError(e instanceof Error ? e.message : isAr ? 'تعذّر الرفع' : 'Upload failed');
      }
    }
    setBusy(false);
    await reloadLibrary(filter);
    if (added.length > 0 && failures === 0) finish(added);
  };

  /**
   * Save a found photo/video as a library link, then return it.
   *
   * The caption carries the credit — photographer for Unsplash, title and
   * channel for YouTube — because attribution is a licence condition, and
   * `mediaCaption` is what reaches the projector, the PDF and the PPTX.
   */
  const saveAndPick = async (input: { url: string; caption: string }) => {
    const kind = classifyMediaUrl(input.url);
    if (!kind) {
      setError(isAr ? 'رابط غير مدعوم' : 'Unsupported link');
      return;
    }
    setBusy(true);
    try {
      const item = await saveLibraryLink({
        sourceUrl: input.url,
        kind,
        caption: input.caption,
        lessonId,
      });
      finish([{ kind, url: input.url, caption: input.caption, id: item.id }]);
    } catch {
      // Saving to the library is a convenience; failing it should not stop the
      // teacher putting the picture in the lesson they are building right now.
      finish([{ kind, url: input.url, caption: input.caption }]);
    } finally {
      setBusy(false);
    }
  };

  const finish = (picked: AttachedResource[]) => {
    onPick(picked);
    onClose();
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'library', label: isAr ? 'مكتبتي' : 'My library', icon: 'albums-outline' },
    ...(figures.length > 0
      ? [{ key: 'book' as Tab, label: isAr ? 'الكتاب' : 'Book', icon: 'book-outline' as const }]
      : []),
    { key: 'search', label: isAr ? 'بحث' : 'Search', icon: 'search-outline' },
    ...(onPickGame
      ? [{ key: 'games' as Tab, label: isAr ? 'ألعاب' : 'Games', icon: 'game-controller-outline' as const }]
      : []),
  ];

  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const text = { textAlign: isRTL ? 'right' : 'left' } as const;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, row]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {isAr ? 'إضافة وسائط' : 'Add media'}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={isAr ? 'إغلاق' : 'Close'}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={[styles.tabs, row]}>
            {tabs.map(tb => (
              <Pressable
                key={tb.key}
                onPress={() => setTab(tb.key)}
                style={[styles.tab, tab === tb.key && { borderBottomColor: TEAL, borderBottomWidth: 2 }]}
              >
                <Ionicons name={tb.icon} size={16} color={tab === tb.key ? TEAL : colors.mutedForeground} />
                <Text style={[styles.tabLabel, { color: tab === tb.key ? TEAL : colors.mutedForeground }]}>
                  {tb.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {error !== '' && <Text style={[styles.error, text]}>{error}</Text>}
          {busy && <ActivityIndicator color={TEAL} style={styles.spinner} />}

          {tab === 'library' && (
            <>
              <View style={[styles.toolbar, row]}>
                <TextInput
                  value={filter}
                  onChangeText={setFilter}
                  onSubmitEditing={() => void reloadLibrary(filter)}
                  placeholder={isAr ? 'ابحث في مكتبتك…' : 'Search your library…'}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, text, { color: colors.text, borderColor: colors.border }]}
                />
                <Pressable onPress={() => void upload(pickLessonPhotos)} style={styles.iconBtn}>
                  <Ionicons name="image-outline" size={20} color={TEAL} />
                </Pressable>
                <Pressable onPress={() => void upload(pickLessonFiles)} style={styles.iconBtn}>
                  <Ionicons name="document-outline" size={20} color={TEAL} />
                </Pressable>
              </View>
              <FlatList
                data={items}
                keyExtractor={i => i.id}
                numColumns={3}
                ListEmptyComponent={
                  busy ? null : (
                    <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                      {isAr
                        ? 'لا يوجد شيء بعد — ارفع صورة أو احفظ فيديو من تبويب البحث.'
                        : 'Nothing yet — upload a photo, or save a video from the Search tab.'}
                    </Text>
                  )
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.cell}
                    disabled={!item.url}
                    onPress={() =>
                      item.url &&
                      finish([{ kind: item.kind, url: item.url, caption: item.caption, id: item.id }])
                    }
                  >
                    {item.kind === 'image' && item.url ? (
                      <Image source={{ uri: item.url }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbFallback]}>
                        <Ionicons
                          name={
                            item.kind === 'video' ? 'logo-youtube'
                              : item.kind === 'audio' ? 'musical-notes-outline'
                                : 'document-text-outline'
                          }
                          size={22}
                          color={TEAL}
                        />
                      </View>
                    )}
                    <Text numberOfLines={2} style={[styles.caption, { color: colors.mutedForeground }]}>
                      {item.caption || (isAr ? 'بدون وصف' : 'Untitled')}
                    </Text>
                  </Pressable>
                )}
              />
            </>
          )}

          {tab === 'book' && (
            <FlatList
              data={figures}
              keyExtractor={f => f.uri}
              numColumns={3}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.cell}
                  // No `id`: a book figure is bundled in the app, not a library
                  // row, so there is nothing to re-sign later.
                  onPress={() => finish([{ kind: 'image', url: item.uri, caption: item.caption }])}
                >
                  <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="contain" />
                  <Text numberOfLines={2} style={[styles.caption, { color: colors.mutedForeground }]}>
                    {item.caption}
                  </Text>
                </Pressable>
              )}
            />
          )}

          {tab === 'search' && (
            <>
              <View style={[styles.toolbar, row]}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => void runSearch()}
                  placeholder={isAr ? 'ابحث عن صورة أو فيديو…' : 'Search images and videos…'}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, text, { color: colors.text, borderColor: colors.border }]}
                />
                <Pressable onPress={() => void runSearch()} style={styles.iconBtn}>
                  <Ionicons name="search" size={20} color={TEAL} />
                </Pressable>
              </View>
              <FlatList
                data={photos}
                keyExtractor={p => p.url}
                numColumns={3}
                ListEmptyComponent={
                  busy || !searched ? null : (
                    <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                      {isAr ? 'لا نتائج.' : 'No results.'}
                    </Text>
                  )
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.cell}
                    onPress={() => {
                      markPhotoUsed(item);
                      void saveAndPick({
                        url: item.url,
                        caption: `${item.photographer} — Unsplash`,
                      });
                    }}
                  >
                    <Image source={{ uri: item.thumbUrl }} style={styles.thumb} />
                    <Text numberOfLines={1} style={[styles.caption, { color: colors.mutedForeground }]}>
                      {item.photographer}
                    </Text>
                  </Pressable>
                )}
                ListFooterComponent={
                  videos.length === 0 ? null : (
                    <View>
                      <Text style={[styles.sectionLabel, text, { color: colors.text }]}>
                        {isAr ? 'فيديو' : 'Video'}
                      </Text>
                      {videos.map(v => (
                        <Pressable
                          key={v.videoId}
                          style={[styles.videoRow, row]}
                          onPress={() => void saveAndPick({ url: v.url, caption: videoCaption(v) })}
                        >
                          <Ionicons name="logo-youtube" size={20} color="#C4302B" />
                          <Text numberOfLines={2} style={[styles.videoTitle, text, { color: colors.text }]}>
                            {videoCaption(v)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )
                }
              />
            </>
          )}

          {tab === 'games' && onPickGame && (
            <FlatList
              data={games}
              keyExtractor={g => g.id}
              ListEmptyComponent={
                busy ? null : (
                  <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                    {isAr ? 'لم تبنِ أي لعبة بعد.' : 'No games built yet.'}
                  </Text>
                )
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.videoRow, row]}
                  onPress={() => { onPickGame(item); onClose(); }}
                >
                  <Ionicons name="game-controller-outline" size={20} color={TEAL} />
                  <View style={styles.grow}>
                    <Text numberOfLines={1} style={[styles.videoTitle, text, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.caption, text, { color: colors.mutedForeground }]}>
                      {item.topic}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { height: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  tabs: { marginBottom: 12, gap: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  toolbar: { alignItems: 'center', gap: 8, marginBottom: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  iconBtn: { padding: 8 },
  spinner: { marginVertical: 8 },
  error: { color: '#C4302B', fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  cell: { flex: 1 / 3, padding: 4 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 11, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  videoRow: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  videoTitle: { flex: 1, fontSize: 13 },
  grow: { flex: 1 },
});
