/**
 * The library (المكتبة) — ready-made resources per grade, in one place.
 *
 * Three shelves: what Iqrra staff upload per grade/subject/lesson, grouped by
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
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isStudentRole, isTeacherRole, useAuth } from '@/context/AuthContext';
import { getMyExams, getMyGradeIds } from '@/services/studentExam';
import { actionableCount } from '@/services/myExams';
import { narrowSubjectsForGrade, narrowToSelection, preferredGrade } from '@/services/teacherCatalogFilter';
import { listLibrary, type LibraryItem } from '@/services/libraryApi';
import { getLessonById } from '@/services/knowledgeBase';
import { openExternal } from '@/services/externalLinks';
import { buildWorksheetHTML, exportAsPDF } from '@/services/share';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import { getVideoFrameThumbnail } from '@/services/videoThumbnail';
import { videoCoverFromUrl } from '@/services/resourceThumbnail';
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
import { cellWidthPercent, isVisualKind, libraryColumns, previewCount } from '@/services/libraryLayout';
import { palette } from '@/constants/colors';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

type Cols = 1 | 2 | 3;

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

function itemThumbnail(item: ResourceItem): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (!item.url) return null;
  if (item.kind === 'video') return videoCoverFromUrl(item.url);
  if (item.kind === 'image') return item.url;
  return null;
}
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

/**
 * What a Pressable's style callback receives. React Native types only
 * `pressed`; on the web `hovered` and `focused` arrive too, and are the whole
 * reason a mouse or keyboard user can tell which card they are on.
 */
type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };

/**
 * Interaction states shared by every pressable in the library: a teal border
 * on hover or focus, a focus ring for keyboard users, and a small press-down
 * instead of a 25% fade. The web-only keys are cast, as the cursor already was.
 */
function interactionStyle(state: PressState, restBorder: string) {
  const lit = !!(state.hovered || state.focused);
  return {
    borderColor: lit ? ACCENT : restBorder,
    opacity: state.pressed ? 0.92 : 1,
    transform: state.pressed ? [{ scale: 0.985 }] : [],
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transitionProperty: 'border-color, transform',
          transitionDuration: '120ms',
          ...(state.focused
            ? { outlineStyle: 'solid', outlineWidth: 3, outlineColor: ACCENT, outlineOffset: 2 }
            : {}),
        } as object)
      : {}),
  };
}

/**
 * One result. `showKind` is off inside a single-kind section: a heading that
 * already says «أوراق عمل» does not need every row underneath repeating it.
 *
 * Three shapes, by what the item is and how much room there is:
 *  - a **card** — 16:9 cover over the text — for videos, infographics and
 *    photos in a multi-column track, because those are things you recognise by
 *    their picture;
 *  - a **row with a 16:9 thumbnail** for the same kinds on a phone, where a
 *    full-width cover per item would make a long list very long;
 *  - the plain **row** for everything without a picture.
 */
function ResourceRow({
  item,
  accent,
  showKind = true,
  cols = 1,
}: {
  item: ResourceItem;
  accent: string;
  showKind?: boolean;
  /** Cards per row in the surrounding track. */
  cols?: Cols;
}) {
  const thumb = itemThumbnail(item);
  // A self-hosted (non-YouTube) video has no cover of its own — extract one
  // from the file itself rather than leaving it on the icon tile forever.
  const [generatedThumb, setGeneratedThumb] = useState<string | null>(null);
  useEffect(() => {
    if (thumb || item.kind !== 'video' || !item.url) return;
    let cancelled = false;
    void getVideoFrameThumbnail(item.url).then(uri => {
      if (!cancelled) setGeneratedThumb(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [thumb, item.kind, item.url]);
  const effectiveThumb = thumb ?? generatedThumb;
  // A cover URL can be present but dead (wrong link, expired share, a page
  // instead of a direct image) — fall back to the icon tile rather than the
  // blank gap `<Image>` leaves behind when it fails to load.
  const [thumbFailed, setThumbFailed] = useState(false);
  const showThumb = effectiveThumb && !thumbFailed;
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
  const sheet = printable ? allPremade().find(s => s.id === item.nativeId) : undefined;
  const questionCount = sheet?.content.sections.reduce((n, s) => n + s.questions.length, 0) ?? 0;
  // A sheet's note says what a teacher gets before printing; a title alone
  // does not tell «12 questions with a key» from «a blank page».
  const note = item.description ?? (sheet ? t('premadeSheetMeta', questionCount) : null);

  // A frozen sheet has no URL: it is rendered on the spot and handed to the
  // print/share sheet, the same path the worksheet generator's PDF export takes.
  const printSheet = () => {
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

  // A picture-first kind inside a single-kind section. Book-QR rows (showKind
  // on) keep the plain row: their "image" is a code target, not a cover.
  const visual = !showKind && isVisualKind(item.kind);
  const asCard = visual && cols >= 2;
  const isVideo = item.kind === 'video';

  // Subject, not kind, is what tells two videos in one shelf apart.
  const subject =
    !showKind && item.subjectId
      ? getSubjectsForGrade(item.gradeId ?? '').find(s => s.id === item.subjectId)
      : undefined;
  const subjectName = subject ? (isAr ? subject.nameAr : subject.name) : null;

  const noteStyle = [
    styles.rowNote,
    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' } as const,
  ];
  const titleText = (
    <Text
      numberOfLines={2}
      style={[
        styles.rowTitle,
        { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
      ]}
    >
      {page ? t('qrOnPage', page) : title}
    </Text>
  );
  const notes = (
    <>
      {note ? <Text numberOfLines={2} style={noteStyle}>{note}</Text> : null}
      {item.insecure ? <Text numberOfLines={2} style={noteStyle}>{t('qrInsecureRow')}</Text> : null}
    </>
  );

  /**
   * The cover: the picture when there is one, otherwise a neutral tile — not a
   * red-tinted one, which read as an error state next to the teal. A video
   * always carries a play badge over it, so the tile says "video" once.
   */
  const cover = (large: boolean) => (
    <View
      style={[
        large ? styles.coverLarge : styles.coverSmall,
        { backgroundColor: colors.muted },
      ]}
    >
      {showThumb ? (
        <Image
          source={{ uri: effectiveThumb }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityElementsHidden
          onError={() => setThumbFailed(true)}
        />
      ) : !isVideo ? (
        <Ionicons name={KIND_ICON[item.kind]} size={large ? 36 : 24} color={accent} />
      ) : null}
      {isVideo ? (
        <View style={[styles.playBadge, large ? styles.playBadgeLarge : styles.playBadgeSmall, { backgroundColor: ACCENT_FILL }]}>
          <Ionicons name="play" size={large ? 20 : 14} color="#fff" style={{ marginStart: large ? 2 : 1 }} />
        </View>
      ) : null}
    </View>
  );

  const actionLabel = isVideo ? t('resourceActionWatch') : t('resourceActionOpen');
  const forwardIcon = isRTL ? 'arrow-back' : 'arrow-forward';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={item.url ? 'link' : 'button'}
      accessibilityLabel={`${t(KIND_LABEL[item.kind])} — ${page ? t('qrOnPage', page) : (title ?? '')}`}
      android_ripple={{ color: ACCENT + '22' }}
      style={state => [
        styles.row,
        cols > 1 && { width: cellWidthPercent(cols) } as const,
        asCard && styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          flexDirection: asCard ? 'column' : isRTL ? 'row-reverse' : 'row',
        },
        interactionStyle(state as PressState, colors.border),
      ]}
    >
      {asCard ? cover(true) : null}

      {asCard ? (
        <View style={styles.cardBody}>
          {titleText}
          {notes}
          <View style={[styles.cardFooter, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {subjectName ? (
              <View style={[styles.subjectChip, { backgroundColor: ACCENT + '14' }]}>
                <Text style={[styles.subjectText, { color: ACCENT, fontFamily: 'Almarai_400Regular' }]} numberOfLines={1}>
                  {subjectName}
                </Text>
              </View>
            ) : (
              <View />
            )}
            {printable ? (
              <View style={[styles.actionPill, { backgroundColor: accent, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name={opensSheet ? 'eye-outline' : 'print-outline'} size={14} color={palette.primaryForeground} />
                <Text style={[styles.actionText, { color: palette.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {t(opensSheet ? 'resourceActionOpen' : 'resourceActionPrint')}
                </Text>
              </View>
            ) : (
              <View style={[styles.actionLink, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.actionLinkText, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>{actionLabel}</Text>
                <Ionicons name={isVideo ? forwardIcon : 'open-outline'} size={16} color={ACCENT} />
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          {showKind ? (
            <View style={[styles.kindPill, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
              <Ionicons name={KIND_ICON[item.kind]} size={14} color={accent} />
              <Text style={[styles.kindText, { color: accent, fontFamily: 'ReadexPro_500Medium' }]}>
                {t(KIND_LABEL[item.kind])}
              </Text>
            </View>
          ) : null}
          {visual ? (
            cover(false)
          ) : showThumb ? (
            <Image
              source={{ uri: effectiveThumb }}
              style={styles.thumb}
              contentFit="cover"
              accessibilityElementsHidden
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.muted }]}>
              <Ionicons name={KIND_ICON[item.kind]} size={22} color={accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {titleText}
            {notes}
            {visual && subjectName ? (
              <Text style={[styles.rowNote, { color: ACCENT, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {subjectName}
              </Text>
            ) : null}
          </View>
          {printable ? (
            <View style={[styles.actionPill, { backgroundColor: accent, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name={opensSheet ? 'eye-outline' : 'print-outline'} size={14} color={palette.primaryForeground} />
              <Text style={[styles.actionText, { color: palette.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t(opensSheet ? 'resourceActionOpen' : 'resourceActionPrint')}
              </Text>
            </View>
          ) : item.url ? (
            <Ionicons
              name={isVideo ? forwardIcon : 'open-outline'}
              size={18}
              color={isVideo ? ACCENT : colors.mutedForeground}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/**
 * `asTab`: rendered as the «المكتبة» tab (see `(tabs)/curriculum.tsx`) — no
 * back arrow, and room under the list for the tab bar. Without it this is
 * the same screen pushed from the Tools card and the chat «+» menu.
 */
export function LibraryScreen({ asTab = false }: { asTab?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  // Cards per row come from the width of the content track, measured below:
  // the window width ignores the desktop sidebar and CONTENT_MAX_WIDTH. Until
  // the first measurement, assume the window (capped) so nothing jumps much.
  const windowWidth = useWindowDimensions().width;
  const [trackWidth, setTrackWidth] = useState(0);
  const cols: Cols = libraryColumns(trackWidth || Math.min(windowWidth, CONTENT_MAX_WIDTH));
  const isTeacher = isTeacherRole(user?.role);
  // «اختباراتي» is a student's way back to their exams; the tile says how many
  // are waiting. Best-effort: a failed count shows the plain description, and
  // the screen behind the tile reports its own errors.
  const isStudent = isStudentRole(user?.role);
  const [waitingExams, setWaitingExams] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!isStudent) return;
      let cancelled = false;
      getMyExams()
        .then(list => { if (!cancelled) setWaitingExams(actionableCount(list)); })
        .catch(() => { if (!cancelled) setWaitingExams(null); });
      return () => { cancelled = true; };
    }, [isStudent]),
  );
  const isStaff = user?.role === 'system_admin';
  const { gradeId } = useLocalSearchParams<{ gradeId?: string; gradeName?: string }>();
  // Opened from the Tools card there is no grade param: start on the
  // teacher's own first grade, the same narrowing the curriculum tab does.
  const grades = useMemo(
    () => narrowToSelection(getVisibleGrades(), isTeacher ? user?.gradeIds : undefined),
    [isTeacher, user?.gradeIds],
  );
  const [grade, setGrade] = useState<string>(gradeId || grades[0]?.id || '');
  // A student has no grade picker of their own, so with no grade param the
  // library opened on the catalog's first grade — Grade 10 for a Grade 9
  // student. Start on the grade their class is in, unless they (or a param)
  // already chose one.
  useEffect(() => {
    if (!isStudent || gradeId) return;
    const initial = grades[0]?.id || '';
    let cancelled = false;
    void getMyGradeIds().then(ids => {
      const own = preferredGrade(grades, ids);
      if (!cancelled && own) setGrade(prev => (prev === initial ? own.id : prev));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, gradeId]);
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
  // A filter can empty the open shelf; fall back to the overview rather than a blank list.
  const openShelf = shelf ? shelves.find(g => g.shelf === shelf) ?? null : null;
  const total = shown.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        {asTab ? null : (
          <Pressable
            onPress={() => goBack()} hitSlop={10}
            style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
        )}
        {/* Title block and the staff button share a row: the band used to
            stack title, meta and button, and cost ~165px to say three things. */}
        <View style={[styles.heroRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('resourcesTitle')}
            </Text>
            <Text style={[styles.heroMeta, { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {gradeName ? `${gradeName} · ` : ''}
              {t('resourcesCount', total)}
            </Text>
          </View>
          {isStaff ? (
            <Pressable
              onPress={() => router.push({ pathname: '/admin/library' as never, params: { gradeId: grade } })}
              accessibilityRole="button"
              style={[styles.addBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="add-circle-outline" size={18} color={ACCENT_FILL} />
              <Text style={[styles.addBtnText, { color: ACCENT_FILL, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t('libraryAddResource')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: asTab ? 120 : 48, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={e => setTrackWidth(Math.round(e.nativeEvent.layout.width))}>
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
            {[null, ...lessons.map(([id]) => id)].map(id => (
              <FilterChip
                key={id ?? 'all-lessons'}
                label={id === null ? t('resourcesAllLessons') : (lessons.find(([l]) => l === id)?.[1] ?? id)}
                on={id === lessonId}
                maxWidth={220}
                onPress={() => setLessonId(id)}
              />
            ))}
          </ScrollView>
        ) : null}

        {shelves.length > 0 ? (
          <ShelfTabs
            shelves={shelves}
            active={openShelf ? openShelf.shelf : null}
            total={total}
            onPick={setShelf}
          />
        ) : null}

        {openShelf ? (
          // The tab above already names the shelf and counts it, so the list
          // starts straight away: there is no separate shelf page to get out of.
          <View style={styles.section}>
            {openShelf.shelf === 'book-qr' ? (
              <BookShelf items={openShelf.items} openBook={openBook} setOpenBook={setOpenBook} cols={cols} />
            ) : (
              <View style={[styles.rows, cols > 1 && styles.rowsGrid, cols > 1 && isRTL && { flexDirection: 'row-reverse' }]}>
                {openShelf.items.map(item => (
                  <ResourceRow key={item.key} item={item} accent={SHELF_COLOR[openShelf.shelf]} showKind={false} cols={cols} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
          <View style={[styles.tiles, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {/* The curriculum itself — the books, by grade, subject, unit and
                lesson — is the library's first tile. It opens the browser
                rather than a shelf, so it is not in `shelves`. */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/curriculum/browse' as never, params: { gradeId: grade } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('curriculumTitle')}, ${t('libraryCurriculumDesc')}`}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: ACCENT + '1F' }]}>
                <Ionicons name="book" size={26} color={ACCENT} />
              </View>
              <Text numberOfLines={2} style={[styles.tileLabel, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t('curriculumTitle')}
              </Text>
              <Text numberOfLines={2} style={[styles.tileCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                {t('libraryCurriculumDesc')}
              </Text>
            </Pressable>
            {isStudent ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/my-exams' as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('myExamsTitle')}, ${waitingExams ? t('myExamsTileCount', waitingExams) : t('myExamsTileDesc')}`}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.tileIcon, { backgroundColor: ACCENT + '1F' }]}>
                  <Ionicons name="document-text" size={26} color={ACCENT} />
                </View>
                <Text numberOfLines={2} style={[styles.tileLabel, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {t('myExamsTitle')}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.tileCount,
                    {
                      color: waitingExams ? ACCENT : colors.mutedForeground,
                      fontFamily: waitingExams ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
                      textAlign: 'center',
                    },
                  ]}
                >
                  {waitingExams ? t('myExamsTileCount', waitingExams) : t('myExamsTileDesc')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {/* The overview: every shelf, a preview of each, and a way into it.
              This replaces the grid of shelf tiles, which led to a page of its
              own and a «back» button to get out of it. */}
          {shelves.map(({ shelf: id, items: rows }) => {
            const preview = id === 'book-qr' ? [] : rows.slice(0, previewCount(cols, isVisualKind(id)));
            return (
              <View key={id} style={styles.section}>
                <View style={[styles.shelfHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.shelfTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name={SHELF_ICON[id]} size={20} color={SHELF_COLOR[id]} />
                    <Text style={[styles.sectionTitle, { paddingHorizontal: 0, color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>
                      {t(SHELF_LABEL[id])} · {rows.length}
                    </Text>
                  </View>
                  {rows.length > preview.length ? (
                    <Pressable
                      onPress={() => { Haptics.selectionAsync(); setShelf(id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('libraryViewAll')}: ${t(SHELF_LABEL[id])}`}
                      hitSlop={8}
                      style={[styles.viewAll, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    >
                      <Text style={[styles.viewAllText, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>
                        {t('libraryViewAll')}
                      </Text>
                      <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={16} color={ACCENT} />
                    </Pressable>
                  ) : null}
                </View>
                {preview.length > 0 ? (
                  <View style={[styles.rows, cols > 1 && styles.rowsGrid, cols > 1 && isRTL && { flexDirection: 'row-reverse' }]}>
                    {preview.map(item => (
                      <ResourceRow key={item.key} item={item} accent={SHELF_COLOR[id]} showKind={false} cols={cols} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
          {shelves.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={36} color={colors.mutedForeground} />
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
              >
                {t('resourcesEmpty')}
              </Text>
            </View>
          ) : null}
          </>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * One filter chip. At least 44px tall (the touch minimum — they were ~31px),
 * with the same hover, focus and press states as a card.
 */
function FilterChip({
  label,
  on,
  onPress,
  maxWidth,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  maxWidth?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      aria-selected={on}
      style={state => [
        styles.chip,
        { backgroundColor: on ? ACCENT : colors.muted },
        interactionStyle(state as PressState, on ? ACCENT : 'transparent'),
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.chipText,
          {
            maxWidth,
            color: on ? palette.primaryForeground : colors.mutedForeground,
            fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Filter chips that wrap onto further lines instead of scrolling sideways: a
 * clipped row hides options, and a grade or subject list is short enough that
 * wrapping costs one extra line at most. `null` is the "all" chip.
 */
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
  return (
    <View style={[styles.chipRow, styles.chipRowWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {options.map(o => (
        <FilterChip key={o.id ?? 'all'} label={o.label} on={o.id === active} onPress={() => onPick(o.id)} />
      ))}
    </View>
  );
}

/**
 * The shelves as tabs, each with its count, above the results. The first tab
 * is the overview. Wraps rather than scrolls, like the chips.
 */
function ShelfTabs({
  shelves,
  active,
  total,
  onPick,
}: {
  shelves: Array<{ shelf: Shelf; items: ResourceItem[] }>;
  active: Shelf | null;
  total: number;
  onPick: (shelf: Shelf | null) => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const num = (n: number) => (lang === 'ar' ? n.toLocaleString('ar-EG') : String(n));
  const tab = (id: Shelf | null, label: string, count: number, icon?: React.ComponentProps<typeof Ionicons>['name'], iconColor?: string) => {
    const on = id === active;
    return (
      <Pressable
        key={id ?? 'all'}
        onPress={() => {
          Haptics.selectionAsync();
          onPick(id);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        aria-selected={on}
        accessibilityLabel={`${label}, ${count}`}
        style={state => [
          styles.tab,
          {
            backgroundColor: on ? ACCENT : colors.card,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          },
          interactionStyle(state as PressState, on ? ACCENT : colors.border),
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={on ? palette.primaryForeground : iconColor} /> : null}
        <Text
          style={[
            styles.tabText,
            { color: on ? palette.primaryForeground : colors.foreground, fontFamily: on ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular' },
          ]}
        >
          {label}
        </Text>
        <View style={[styles.tabCount, { backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.muted }]}>
          <Text style={[styles.countText, { color: on ? palette.primaryForeground : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {num(count)}
          </Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.chipRow, styles.chipRowWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
    >
      {tab(null, t('libraryTabAll'), total)}
      {shelves.map(({ shelf: id, items }) => tab(id, t(SHELF_LABEL[id]), items.length, SHELF_ICON[id], SHELF_COLOR[id]))}
    </View>
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
  cols,
}: {
  items: ResourceItem[];
  openBook: string | null;
  setOpenBook: (title: string | null) => void;
  cols: Cols;
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
                  { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {title}
              </Text>
              <View style={[styles.countPill, { backgroundColor: ACCENT + '15' }]}>
                <Text style={[styles.countText, { color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }]}>
                  {count}
                </Text>
              </View>
            </Pressable>
            {expanded ? (
              <View style={[styles.rows, cols > 1 && styles.rowsGrid, cols > 1 && isRTL && { flexDirection: 'row-reverse' }]}>
                {rows.map(row => (
                  <ResourceRow key={row.key} item={row} accent={ACCENT} cols={cols} />
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
  hero: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  heroRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  backBtn: { padding: 4 },
  heroTitle: { color: '#fff', fontSize: 24, lineHeight: 34 },
  heroMeta: { color: 'rgba(255,255,255,0.95)', fontSize: 15, lineHeight: 24 },
  addBtn: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 14 },
  intro: { fontSize: 15, lineHeight: 23, paddingHorizontal: 20, paddingTop: 14 },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chipRowWrap: { flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
  },
  chipText: { fontSize: 14 },
  tab: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  tabText: { fontSize: 14 },
  tabCount: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10 },
  viewAll: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  viewAllText: { fontSize: 14 },
  section: { paddingTop: 14, gap: 10 },
  tiles: { flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  tile: { flexGrow: 1, flexBasis: '30%', minWidth: 104, maxWidth: 220, alignItems: 'center', gap: 6, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 8 },
  tileIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 14, textAlign: 'center' },
  tileCount: { fontSize: 13 },
  shelfHeader: { alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, flexWrap: 'wrap' },
  shelfTitleRow: { alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, paddingHorizontal: 20 },
  bookBlock: { paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  bookHeader: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 12 },
  bookTitle: { flex: 1, fontSize: 14, lineHeight: 20 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 13 },
  rows: { gap: 10, paddingHorizontal: 20 },
  rowsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  row: { alignItems: 'center', gap: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  // The card: a 16:9 cover over the text, nothing between the cover and the edge.
  card: { flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, overflow: 'hidden' },
  cardBody: { padding: 14, gap: 4 },
  cardFooter: { alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  coverLarge: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverSmall: { width: 112, height: 63, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  playBadge: { alignItems: 'center', justifyContent: 'center' },
  playBadgeLarge: { width: 48, height: 48, borderRadius: 24 },
  playBadgeSmall: { width: 30, height: 30, borderRadius: 15 },
  subjectChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, flexShrink: 1 },
  subjectText: { fontSize: 13 },
  actionLink: { alignItems: 'center', gap: 6 },
  actionLinkText: { fontSize: 14 },
  thumb: { width: 64, height: 48, borderRadius: 6, flexShrink: 0 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  actionPill: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: 13 },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kindText: { fontSize: 12 },
  rowTitle: { fontSize: 16, lineHeight: 25 },
  rowNote: { fontSize: 14, lineHeight: 22, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 40 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 23 },
});

export default LibraryScreen;
