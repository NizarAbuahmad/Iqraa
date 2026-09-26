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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { narrowSubjectsForGrade, narrowToSelection } from '@/services/teacherCatalogFilter';
import { listLibrary, type LibraryCategory, type LibraryItem } from '@/services/libraryApi';
import { getLessonById } from '@/services/knowledgeBase';
import { openExternal } from '@/services/externalLinks';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import {
  buildResourceCatalog,
  filterResources,
  groupIntoSections,
  type ResourceItem,
  type ResourceKind,
  type ResourceSection,
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

/** The order the category chips appear in. */
const KIND_ORDER: ResourceKind[] = [
  'infographic',
  'image',
  'video',
  'audio',
  'game',
  'worksheet',
  'template',
  'presentation',
  'document',
  'page',
];

/** Plural section headings for the uploaded categories. */
const CATEGORY_SECTION_LABEL: Record<LibraryCategory, TranslationKey> = {
  infographic: 'librarySecInfographic',
  video: 'librarySecVideo',
  audio: 'librarySecAudio',
  game: 'librarySecGame',
  worksheet: 'librarySecWorksheet',
  template: 'librarySecTemplate',
  presentation: 'librarySecPresentation',
  document: 'librarySecDocument',
  image: 'librarySecImage',
};

function sectionLabel(section: ResourceSection): TranslationKey {
  if (section.type === 'category') return CATEGORY_SECTION_LABEL[section.category];
  return section.source === 'premade-sheet' ? 'sectionPremadeSheets' : 'qrLibraryTitle';
}

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;

function ResourceRow({ item, accent }: { item: ResourceItem; accent: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const page =
    item.page === undefined
      ? null
      : lang === 'ar'
        ? item.page.toLocaleString('ar-EG')
        : String(item.page);

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.url) void openExternal(item.url);
  };

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
        <Text style={[styles.kindText, { color: accent, fontFamily: 'Cairo_500Medium' }]}>
          {t(KIND_LABEL[item.kind])}
        </Text>
      </View>
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
      <Ionicons
        name={item.url ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={colors.mutedForeground}
      />
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
  const [kind, setKind] = useState<ResourceKind | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const gradeInfo = getVisibleGrades().find(g => g.id === grade);
  const gradeName = gradeInfo ? (lang === 'ar' ? gradeInfo.nameAr : gradeInfo.name) : '';

  const pickGrade = (id: string) => {
    setGrade(id);
    // Lessons and subjects belong to a grade; carrying them over empties the list.
    setSubjectId(null);
    setLessonId(null);
    setKind(null);
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

  // Which chips to offer, and how many each would leave. Derived rather than
  // fixed: offering a filter that empties the screen is a worse affordance
  // than not offering it.
  const kindCounts = useMemo(() => {
    const counts = new Map<ResourceKind, number>();
    for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return counts;
  }, [items]);

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
    () =>
      filterResources(items, {
        kinds: kind ? [kind] : undefined,
        lessonId: lessonId ?? undefined,
      }),
    [items, kind, lessonId],
  );

  const sections = useMemo(() => groupIntoSections(shown), [shown]);
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

        {kindCounts.size > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // minWidth fills the track so row-reverse packs the chips against
            // the right edge; without it a short list hugs the left in RTL.
            contentContainerStyle={[styles.chipRow, isRTL && { flexDirection: 'row-reverse', minWidth: '100%' }]}
          >
            {[null, ...KIND_ORDER.filter(k => kindCounts.has(k))].map(k => {
              const active = k === kind;
              const label = k === null ? t('qrKindAll') : `${t(KIND_LABEL[k])} · ${kindCounts.get(k)}`;
              return (
                <Pressable
                  key={k ?? 'all'}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setKind(k);
                  }}
                  style={[styles.chip, { backgroundColor: active ? ACCENT : colors.muted }]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
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

        {sections.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={36} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
            >
              {t('resourcesEmpty')}
            </Text>
          </View>
        ) : (
          sections.map(section => (
            <View key={section.id} style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t(sectionLabel(section))}
              </Text>
              {section.type === 'source' && section.source === 'book-qr' ? (
                <BookShelf items={section.items} openBook={openBook} setOpenBook={setOpenBook} />
              ) : (
                <View style={styles.rows}>
                  {section.items.map(item => (
                    <ResourceRow key={item.key} item={item} accent={ACCENT} />
                  ))}
                </View>
              )}
            </View>
          ))
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
  sectionTitle: { fontSize: 15, paddingHorizontal: 20 },
  bookBlock: { paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  bookHeader: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 12 },
  bookTitle: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11.5 },
  rows: { gap: 8, paddingHorizontal: 20 },
  row: { alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
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
