/**
 * The resources tab — everything supplementary, in one place.
 *
 * This began as the book-QR library: every NCCD student book prints QR codes
 * in its margins, and the decoded manifest sat unread in `knowledge-base/`.
 * That shelf is still here, and it is now one of four. A teacher preparing a
 * lesson also gets the ready-made practice sheets, the classroom activity
 * formats, and the licensed third-party media — browsable together, filterable
 * by kind and by lesson, because a teacher is preparing ONE lesson and does
 * not want four separate screens to check.
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
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { openExternal } from '@/services/externalLinks';
import { qrResourcesForGrade } from '@/services/bookQrLinks';
import { ACTIVITY_CARDS } from '@/services/classroomRouting';
import {
  buildResourceCatalog,
  filterResources,
  groupBySource,
  type ResourceItem,
  type ResourceKind,
  type ResourceSource,
} from '@/services/resourceCatalog';
import { allPremade } from '@workspace/curriculum/premade';
import { EXTERNAL_RESOURCES } from '@workspace/curriculum';
import type { TranslationKey } from '@/services/i18n';
import { goBack } from '@/services/navigation';

const KIND_LABEL: Record<ResourceKind, TranslationKey> = {
  worksheet: 'resourceKindWorksheet',
  game: 'resourceKindGame',
  text: 'resourceKindText',
  audio: 'qrKindAudio',
  video: 'qrKindVideo',
  document: 'qrKindDocument',
  image: 'qrKindImage',
  page: 'qrKindPage',
};

const KIND_ICON: Record<ResourceKind, React.ComponentProps<typeof Ionicons>['name']> = {
  worksheet: 'document-text-outline',
  game: 'game-controller-outline',
  text: 'reader-outline',
  audio: 'musical-notes-outline',
  video: 'play-circle-outline',
  document: 'document-text-outline',
  image: 'image-outline',
  page: 'globe-outline',
};

/** The order the filter chips appear in — audio first, because it is the rarest. */
const KIND_ORDER: ResourceKind[] = [
  'worksheet',
  'game',
  'audio',
  'video',
  'document',
  'image',
  'text',
  'page',
];

const SECTION_LABEL: Record<ResourceSource, TranslationKey> = {
  'premade-sheet': 'sectionPremadeSheets',
  activity: 'sectionActivities',
  'curriculum-media': 'sectionCuratedMedia',
  'book-qr': 'qrLibraryTitle',
};

const ACCENT = '#007C74';

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
    if (item.url) {
      void openExternal(item.url);
      return;
    }
    // An activity is built and run in the classroom hub. Sheets get their own
    // actions in the row below rather than a whole-row press.
    if (item.source === 'activity') router.push('/ai-tools/classroom');
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
        {/* Rendered verbatim wherever the item appears — a licence term, not a
            caption the layout may drop when space is tight. */}
        {item.attribution ? (
          <Text
            style={[
              styles.rowNote,
              { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {item.attribution}
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
  const { gradeId, gradeName } = useLocalSearchParams<{ gradeId: string; gradeName?: string }>();
  const [kind, setKind] = useState<ResourceKind | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const grade = gradeId ?? '';

  const items = useMemo(
    () =>
      buildResourceCatalog({
        premade: allPremade().filter(sheet => sheet.gradeId === grade),
        // The cards carry i18n keys, not titles, so they are resolved here and
        // the catalog module stays free of i18n.
        activities: ACTIVITY_CARDS.filter(card => card.available).map(card => ({
          id: card.id,
          titleAr: t(card.titleKey as TranslationKey),
          titleEn: t(card.titleKey as TranslationKey),
        })),
        // Not grade-filtered: an ExternalResource carries lessonIds, not a
        // grade, and deriving one would mean resolving every id against the KB
        // on every render. The lesson and kind chips are what narrow this.
        external: EXTERNAL_RESOURCES,
        qr: qrResourcesForGrade(grade),
      }),
    [grade, t],
  );

  // Which chips to offer, and how many each would leave. Derived rather than
  // fixed: offering a filter that empties the screen is a worse affordance
  // than not offering it.
  const kindCounts = useMemo(() => {
    const counts = new Map<ResourceKind, number>();
    for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return counts;
  }, [items]);

  /** Lessons that actually have something attached, so no chip empties the list. */
  const lessons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (item.lessonId && !seen.has(item.lessonId)) seen.set(item.lessonId, item.titleAr);
    }
    return [...seen.entries()];
  }, [items]);

  const shown = useMemo(
    () =>
      filterResources(items, {
        kinds: kind ? [kind] : undefined,
        lessonId: lessonId ?? undefined,
      }),
    [items, kind, lessonId],
  );

  const sections = useMemo(() => groupBySource(shown), [shown]);
  const total = shown.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
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
                        color: active ? '#fff' : colors.mutedForeground,
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
                        color: active ? '#fff' : colors.mutedForeground,
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
            <View key={section.source} style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' },
                ]}
              >
                {t(SECTION_LABEL[section.source])}
              </Text>
              {section.source === 'book-qr' ? (
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
  heroMeta: { color: '#ffffffcc', fontSize: 13, lineHeight: 21 },
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
