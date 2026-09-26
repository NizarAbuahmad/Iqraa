/**
 * The library (المكتبة) — ready-made resources per grade, in one place.
 *
 * Three shelves: what Iqraa staff upload per grade/subject/lesson, grouped by
 * category (infographics, videos, audio, games, worksheets, templates…); the
 * ready-made practice sheets; and the QR codes printed in the NCCD books.
 * Filterable by grade, subject, category and lesson, because a teacher is
 * preparing ONE lesson. Nothing here opens a generator — since 2026-09-25 the
 * library is ready-made material only. A system_admin sees «إضافة مورد»,
 * which opens `/admin/library`.
 *
 * **Student-reachable with no gating change.** `isNonTeacherRoute` matches by
 * prefix and `/curriculum` is already on the allowlist, so this route is
 * reachable the moment the file exists. A new tab would have cost an allowlist
 * entry, a role-gated tab, two icons and a locale pair for the same result.
 *
 * **Answer keys are visible to students, and that is a decision.** The
 * pre-made sheets carry their answer keys, and nothing here hides them from a
 * student who opens this screen. That was chosen deliberately (2026-09-15):
 * these sheets are practice, not assessment. Anything whose answer must stay
 * hidden belongs in an exam, which is handed out through `/take/:code` and
 * never renders its key. To reverse this later, gate the `answerKey` field
 * alone — not the row, and not the screen.
 *
 * Book-QR rows open in the browser and cannot become inline players — see
 * `services/bookQrLinks.ts` for why the ministry's own https host is unusable
 * and what that forces. The note under each insecure row says so per row: on a
 * list where one link is insecure and the rest are not, a single header note
 * tells a student nothing about the one they are about to tap.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { narrowSubjectsForGrade, narrowToSelection } from '@/services/teacherCatalogFilter';
import { listLibrary, type LibraryItem } from '@/services/libraryApi';
import { getLessonById } from '@/services/knowledgeBase';
import { openExternal } from '@/services/externalLinks';
import { buildWorksheetHTML, exportAsPDF } from '@/services/share';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import {
  buildResourceCatalog,
  filterResources,
  groupIntoShelves,
  type ResourceItem,
  type ResourceKind,
  type Shelf,
} from '@/services/resourceCatalog';
import { allPremade } from '@workspace/curriculum/premade';
import { getSubjectsForGrade, getVisibleGrades } from '@workspace/curriculum';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';
import { palette } from '@/constants/colors';

const KIND_LABEL: Record<ResourceKind, TranslationKey> = {
  infographic: 'libraryCatInfographic',
  video: 'libraryCatVideo',
  audio: 'libraryCatAudio',
  game: 'libraryCatGame',
  worksheet: 'libraryCatWorksheet',
  template: 'libraryCatTemplate',
  presentation: 'libraryCatPresentation',
  document: 'libraryCatDocument',
  image: 'qrKindImage',
  page: 'qrKindPage',
};

const KIND_ICON: Record<ResourceKind, React.ComponentProps<typeof Ionicons>['name']> = {
  infographic: 'bar-chart-outline',
  video: 'play-circle-outline',
  audio: 'musical-notes-outline',
  game: 'game-controller-outline',
  worksheet: 'document-text-outline',
  template: 'copy-outline',
  presentation: 'easel-outline',
  document: 'document-outline',
  image: 'image-outline',
  page: 'globe-outline',
};

/** One tile per shelf: its plural name, icon and colour. */
const SHELF_LABEL: Record<Shelf, TranslationKey> = {
  infographic: 'librarySecInfographic',
  image: 'librarySecImage',
  video: 'librarySecVideo',
  audio: 'librarySecAudio',
  game: 'librarySecGame',
  worksheet: 'librarySecWorksheet',
  template: 'librarySecTemplate',
  presentation: 'librarySecPresentation',
  document: 'librarySecDocument',
  'book-qr': 'qrLibraryTitle',
};

const SHELF_ICON: Record<Shelf, React.ComponentProps<typeof Ionicons>['name']> = {
  infographic: 'bar-chart',
  image: 'images',
  video: 'play-circle',
  audio: 'headset',
  game: 'game-controller',
  worksheet: 'document-text',
  template: 'copy',
  presentation: 'easel',
  document: 'folder-open',
  'book-qr': 'qr-code',
};

/** Icon colours, each dark enough to read on its own 12% tint. */
const SHELF_COLOR: Record<Shelf, string> = {
  infographic: '#7C3AED',
  image: '#0E7490',
  video: '#DC2626',
  audio: '#B45309',
  game: '#15803D',
  worksheet: '#0E8F86',
  template: '#4F46E5',
  presentation: '#C2410C',
  document: '#475569',
  'book-qr': '#0369A1',
};

const ACCENT = palette.primary;

/** YouTube video ID → thumbnail URL, or null for non-YouTube URLs. */
function youtubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function itemThumbnail(item: ResourceItem): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (!item.url) return null;
  if (item.kind === 'video') return youtubeThumbnail(item.url);
  if (item.kind === 'image') return item.url;
  return null;
}
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

/**
 * One row. `showKind` is off inside a single-kind section: a heading that
 * already says «أوراق عمل» does not need every row underneath repeating it.
 */
function ResourceRow({ item, accent, showKind = true }: { item: ResourceItem; accent: string; showKind?: boolean }) {
  const thumb = itemThumbnail(item);
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const title = isAr ? item.titleAr : item.titleEn;
  const page =
    item.page === undefined
      ? null
      : isAr
        ? item.page.toLocaleString('ar-EG')
        : String(item.page);
  const printable = item.actions.includes('print');

  // A frozen sheet has no URL: it is rendered on the spot and handed to the
  // print/share sheet, the same path the worksheet generator's PDF export takes.
  const printSheet = () => {
    const sheet = allPremade().find(s => s.id === item.nativeId);
    if (!sheet) return;
    const grade = getVisibleGrades().find(g => g.id === sheet.gradeId);
    const subject = getSubjectsForGrade(sheet.gradeId).find(s => s.id === sheet.subjectId);
    const html = buildWorksheetHTML(
      sheet.content,
      title,
      {
        subject: subject ? (isAr ? subject.nameAr : subject.name) : '',
        grade: grade ? (isAr ? grade.nameAr : grade.name) : '',
      },
      isAr,
    );
    void exportAsPDF(html, `${title}.pdf`);
  };

  const { user } = useAuth();
  // A teacher opens the sheet first — the viewer shows it and prints, shares
  // or exports to Word from there. The viewer lives under /workspace, which is
  // teacher-only, so anyone else still gets the direct print.
  const opensSheet = printable && isTeacherRole(user?.role);
  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.url) void openExternal(item.url);
    else if (opensSheet) router.push({ pathname: '/workspace/view' as never, params: { premade: item.nativeId } });
    else if (printable) printSheet();
  };

  const trailingIcon = item.url
    ? 'open-outline'
    : opensSheet
      ? (isRTL ? 'chevron-back' : 'chevron-forward')
      : printable
        ? 'print-outline'
        : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={item.url ? 'link' : 'button'}
      accessibilityLabel={`${t(KIND_LABEL[item.kind])} — ${title}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.kindPill, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
        <Ionicons name={KIND_ICON[item.kind]} size={14} color={accent} />
        {showKind ? (
          <Text style={[styles.kindText, { color: accent, fontFamily: 'Cairo_500Medium' }]}>
            {t(KIND_LABEL[item.kind])}
          </Text>
        ) : null}
      </View>
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={styles.thumb}
          resizeMode="cover"
          accessibilityElementsHidden
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={[
            styles.rowTitle,
            { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {page ? t('qrOnPage', page) : title}
        </Text>
        {item.description ? (
          <Text
            style={[
              styles.rowNote,
              { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {item.description}
          </Text>
        ) : null}
        {item.insecure ? (
          <Text
            style={[
              styles.rowNote,
              { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('qrInsecureRow')}
          </Text>
        ) : null}
      </View>
      {trailingIcon ? <Ionicons name={trailingIcon} size={16} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const isTeacher = isTeacherRole(user?.role);
  const isStaff = user?.role === 'system_admin';
  const { gradeId } = useLocalSearchParams<{ gradeId?: string; gradeName?: string }>();
  // Opened from the Tools card there is no grade param: start on the
  // teacher's own first grade, the same narrowing the curriculum tab does.
  const grades = useMemo(
    () => narrowToSelection(getVisibleGrades(), isTeacher ? user?.gradeIds : undefined),
    [isTeacher, user?.gradeIds],
  );
  const [grade, setGrade] = useState<string>(gradeId || grades[0]?.id || '');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const gradeInfo = getVisibleGrades().find(g => g.id === grade);
  const gradeName = gradeInfo ? (lang === 'ar' ? gradeInfo.nameAr : gradeInfo.name) : '';

  const pickGrade = (id: string) => {
    setGrade(id);
    // Lessons and subjects belong to a grade; carrying them over empties the list.
    setSubjectId(null);
    setLessonId(null);
    setShelf(null);
  };

  // Staff uploads for this grade. Refetched on focus so an item added on the
  // upload screen is there on the way back.
  const [uploaded, setUploaded] = useState<LibraryItem[]>([]);
  const loadUploaded = useCallback(() => {
    let live = true;
    void listLibrary(grade).then(rows => { if (live) setUploaded(rows); });
    return () => { live = false; };
  }, [grade]);
  useFocusEffect(loadUploaded);
  useEffect(loadUploaded, [loadUploaded]);

  const allItems = useMemo(
    () =>
      buildResourceCatalog({
        uploaded,
        premade: allPremade().filter(sheet => sheet.gradeId === grade),
        qr: qrResourcesForGrade(grade),
      }),
    [grade, uploaded],
  );

  const inGrade = useMemo(() => filterResources(allItems, { gradeId: grade }), [allItems, grade]);

  // The grade's subjects, narrowed to what this teacher teaches.
  const gradeSubjects = useMemo(
    () =>
      isTeacher
        ? narrowSubjectsForGrade(getSubjectsForGrade(grade), grade, user?.teachingAssignments, user?.subjectIds)
        : getSubjectsForGrade(grade),
    [grade, isTeacher, user?.teachingAssignments, user?.subjectIds],
  );

  // Chips only for subjects with a subject-specific row: a chip that re-shows
  // just the gradeless rows is a filter that does nothing.
  const subjects = useMemo(() => {
    const withRows = new Set(inGrade.map(i => i.subjectId).filter(Boolean));
    return gradeSubjects.filter(s => withRows.has(s.id));
  }, [inGrade, gradeSubjects]);

  const items = useMemo(
    () => filterResources(inGrade, { subjectId: subjectId ?? undefined }),
    [inGrade, subjectId],
  );

  /**
   * Lessons that actually have something attached, so no chip empties the
   * list. Labelled with the lesson's own title from the KB, falling back to
   * the row's title when the KB doesn't know the id.
   */
  const lessons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.lessonId && !seen.has(item.lessonId)) {
        const lesson = getLessonById(item.lessonId);
        seen.set(item.lessonId, lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : item.titleAr);
      }
    }
    return [...seen.entries()];
  }, [items, lang]);

  const shown = useMemo(
    () => filterResources(items, { lessonId: lessonId ?? undefined }),
    [items, lessonId],
  );

  const shelves = useMemo(() => groupIntoShelves(shown), [shown]);
  // A filter can empty the open shelf; fall back to the tiles rather than a blank list.
  const openShelf = shelf ? shelves.find(g => g.shelf === shelf) ?? null : null;
  const total = shown.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => goBack()} hitSlop={10}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('resourcesTitle')}
        </Text>
        <Text style={[styles.heroMeta, { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {gradeName ? `${gradeName} · ` : ''}
          {t('resourcesCount', total)}
        </Text>
        {isStaff ? (
          <Pressable
            onPress={() => router.push({ pathname: '/admin/library' as never, params: { gradeId: grade } })}
            accessibilityRole="button"
            style={[styles.addBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="add-circle-outline" size={18} color={ACCENT_FILL} />
            <Text style={[styles.addBtnText, { color: ACCENT_FILL, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('libraryAddResource')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.intro,
            { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {t('resourcesIntro')}
        </Text>

        {grades.length > 1 ? (
          <ChipRow
            isRTL={isRTL}
            options={grades.map(g => ({ id: g.id, label: lang === 'ar' ? g.nameAr : g.name }))}
            active={grade}
            onPick={id => id && pickGrade(id)}
          />
        ) : null}

        {subjects.length > 1 ? (
          <ChipRow
            isRTL={isRTL}
            options={[
              { id: null, label: t('resourcesAllSubjects') },
              ...subjects.map(s => ({ id: s.id, label: lang === 'ar' ? s.nameAr : s.name })),
            ]}
            active={subjectId}
            onPick={id => {
              setSubjectId(id);
              setLessonId(null);
            }}
          />
        ) : null}

        {lessons.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // minWidth fills the track so row-reverse packs the chips against
            // the right edge; without it a short list hugs the left in RTL.
            contentContainerStyle={[styles.chipRow, isRTL && { flexDirection: 'row-reverse', minWidth: '100%' }]}
          >
            {/* The KB id is what is held in state; the title is only shown. */}
            {[null, ...lessons.map(([id]) => id)].map(id => {
              const active = id === lessonId;
              const label =
                id === null ? t('resourcesAllLessons') : (lessons.find(([l]) => l === id)?.[1] ?? id);
              return (
                <Pressable
                  key={id ?? 'all-lessons'}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLessonId(id);
                  }}
                  style={[styles.chip, { backgroundColor: active ? ACCENT : colors.muted }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.chipText,
                      {
                        maxWidth: 200,
                        color: active ? palette.primaryForeground : colors.mutedForeground,
                        fontFamily: active ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {shelves.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={36} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
            >
              {t('resourcesEmpty')}
            </Text>
          </View>
        ) : openShelf ? (
          <View style={styles.section}>
            <View style={[styles.shelfHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setShelf(null); }}
                accessibilityRole="button"
                hitSlop={8}
                style={[styles.backChip, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={14} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground, fontFamily: 'Cairo_600SemiBold' }]}>
                  {t('libraryAllShelves')}
                </Text>
              </Pressable>
              <View style={[styles.shelfTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name={SHELF_ICON[openShelf.shelf]} size={18} color={SHELF_COLOR[openShelf.shelf]} />
                <Text style={[styles.sectionTitle, { paddingHorizontal: 0, color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}>
                  {t(SHELF_LABEL[openShelf.shelf])} · {openShelf.items.length}
                </Text>
              </View>
            </View>
            {openShelf.shelf === 'book-qr' ? (
              <BookShelf items={openShelf.items} openBook={openBook} setOpenBook={setOpenBook} />
            ) : (
              <View style={styles.rows}>
                {openShelf.items.map(item => (
                  <ResourceRow key={item.key} item={item} accent={SHELF_COLOR[openShelf.shelf]} showKind={false} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.tiles, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {shelves.map(({ shelf: id, items: rows }) => (
              <Pressable
                key={id}
                onPress={() => { Haptics.selectionAsync(); setShelf(id); }}
                accessibilityRole="button"
                accessibilityLabel={`${t(SHELF_LABEL[id])}, ${rows.length}`}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.tileIcon, { backgroundColor: SHELF_COLOR[id] + '1F' }]}>
                  <Ionicons name={SHELF_ICON[id]} size={26} color={SHELF_COLOR[id]} />

                </View>
                <Text numberOfLines={2} style={[styles.tileLabel, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                  {t(SHELF_LABEL[id])}
                </Text>
                <Text style={[styles.tileCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                  {t('resourcesCount', rows.length)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** One horizontal row of filter chips; `null` is the "all" chip. */
function ChipRow({
  options,
  active,
  onPick,
  isRTL,
}: {
  options: Array<{ id: string | null; label: string }>;
  active: string | null;
  onPick: (id: string | null) => void;
  isRTL: boolean;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, isRTL && { flexDirection: 'row-reverse', minWidth: '100%' }]}
    >
      {options.map(o => {
        const on = o.id === active;
        return (
          <Pressable
            key={o.id ?? 'all'}
            onPress={() => {
              Haptics.selectionAsync();
              onPick(o.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? ACCENT : colors.muted }]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.chipText,
                {
                  color: on ? palette.primaryForeground : colors.mutedForeground,
                  fontFamily: on ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The book shelf keeps its own grouping.
 *
 * Collapsed by default: one book can print 45 codes, and a teacher arrives
 * looking for their own subject, not a list of everything.
 */
function BookShelf({
  items,
  openBook,
  setOpenBook,
}: {
  items: ResourceItem[];
  openBook: string | null;
  setOpenBook: (title: string | null) => void;
}) {
  const colors = useColors();
  const { isRTL, lang } = useLanguage();

  const books = useMemo(() => {
    const grouped = new Map<string, ResourceItem[]>();
    for (const item of items) {
      const list = grouped.get(item.titleAr) ?? [];
      list.push(item);
      grouped.set(item.titleAr, list);
    }
    return [...grouped.entries()];
  }, [items]);

  return (
    <>
      {books.map(([title, rows]) => {
        const expanded = openBook === title;
        const count = lang === 'ar' ? rows.length.toLocaleString('ar-EG') : String(rows.length);
        return (
          <View key={title} style={styles.bookBlock}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setOpenBook(expanded ? null : title);
              }}
              accessibilityRole="button"
              style={[
                styles.bookHeader,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <Ionicons
                name={expanded ? 'chevron-down' : isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.mutedForeground}
              />
              <Text
                numberOfLines={2}
                style={[
                  styles.bookTitle,
                  { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {title}
              </Text>
              <View style={[styles.countPill, { backgroundColor: ACCENT + '15' }]}>
                <Text style={[styles.countText, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
            {expanded ? (
              <View style={styles.rows}>
                {rows.map(row => (
                  <ResourceRow key={row.key} item={row} accent={ACCENT} />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  backBtn: { padding: 4, marginBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 22 },
  heroMeta: { color: 'rgba(255,255,255,0.95)', fontSize: 13, lineHeight: 21 },
  addBtn: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 6,
  },
  addBtnText: { fontSize: 13 },
  intro: { fontSize: 12.5, lineHeight: 20, paddingHorizontal: 20, paddingTop: 14 },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipText: { fontSize: 12.5 },
  section: { paddingTop: 14, gap: 8 },
  tiles: { flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 104, maxWidth: 220, alignItems: 'center', gap: 6, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 8 },
  tileIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, textAlign: 'center' },
  tileCount: { fontSize: 12 },
  shelfHeader: { alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, flexWrap: 'wrap' },
  shelfTitleRow: { alignItems: 'center', gap: 6 },
  backChip: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  sectionTitle: { fontSize: 15, paddingHorizontal: 20 },
  bookBlock: { paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  bookHeader: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 12 },
  bookTitle: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11.5 },
  rows: { gap: 8, paddingHorizontal: 20 },
  row: { alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  thumb: { width: 64, height: 48, borderRadius: 6, flexShrink: 0 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kindText: { fontSize: 11 },
  rowTitle: { fontSize: 13, lineHeight: 21 },
  rowNote: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
