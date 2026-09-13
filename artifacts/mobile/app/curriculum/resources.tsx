/**
 * The library — what the books point a student at, made tappable.
 *
 * Every NCCD student book prints QR codes in its margins: a video for the
 * lesson, a recording, a supporting document. A student with the printed book
 * scans them. A student with this app could not reach them at all, because the
 * decoded manifest sat unread in `knowledge-base/`. This screen is that
 * manifest, grouped by the book that prints each code.
 *
 * **Student-reachable with no gating change.** `isNonTeacherRoute` matches by
 * prefix and `/curriculum` is already on the allowlist, so this route is
 * reachable the moment the file exists. A new tab would have cost an allowlist
 * entry, a role-gated tab, two icons and a locale pair for the same result.
 *
 * Rows open in the browser and cannot become inline players — see
 * `services/bookQrLinks.ts` for why the ministry's own https host is unusable
 * and what that forces. The note under the header says so to the student
 * rather than leaving a broken-looking link unexplained.
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
import {
  qrResourcesForGrade,
  type QrResource,
  type QrResourceKind,
} from '@/services/bookQrLinks';
import type { TranslationKey } from '@/services/i18n';

const KIND_LABEL: Record<QrResourceKind, TranslationKey> = {
  audio: 'qrKindAudio',
  video: 'qrKindVideo',
  document: 'qrKindDocument',
  image: 'qrKindImage',
  page: 'qrKindPage',
};

const KIND_ICON: Record<QrResourceKind, React.ComponentProps<typeof Ionicons>['name']> = {
  audio: 'musical-notes-outline',
  video: 'play-circle-outline',
  document: 'document-text-outline',
  image: 'image-outline',
  page: 'globe-outline',
};

/** The order the filter chips appear in — audio first, because it is the rarest. */
const KIND_ORDER: QrResourceKind[] = ['audio', 'video', 'document', 'image', 'page'];

const ACCENT = '#1B6B62';

function ResourceRow({ resource, accent }: { resource: QrResource; accent: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const page = lang === 'ar' ? resource.pdfPage.toLocaleString('ar-EG') : String(resource.pdfPage);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void openExternal(resource.url);
      }}
      accessibilityRole="link"
      accessibilityLabel={`${t(KIND_LABEL[resource.kind])} — ${t('qrOnPage', page)}`}
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
        <Ionicons name={KIND_ICON[resource.kind]} size={14} color={accent} />
        <Text style={[styles.kindText, { color: accent, fontFamily: 'Cairo_500Medium' }]}>
          {t(KIND_LABEL[resource.kind])}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowTitle,
            { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {t('qrOnPage', page)}
        </Text>
        {/* Named per row, not once per screen. A student tapping the one
            insecure link on a screen of secure ones deserves to know which. */}
        {resource.isHttp ? (
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
      <Ionicons name="open-outline" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { gradeId, gradeName } = useLocalSearchParams<{ gradeId: string; gradeName?: string }>();
  const [kind, setKind] = useState<QrResourceKind | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  const books = useMemo(() => qrResourcesForGrade(gradeId ?? ''), [gradeId]);

  // Which chips to offer, and how many each would leave. Derived rather than
  // fixed: offering a filter that empties the screen is a worse affordance
  // than not offering it.
  const kindCounts = useMemo(() => {
    const counts = new Map<QrResourceKind, number>();
    for (const book of books) {
      for (const r of book.resources) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    }
    return counts;
  }, [books]);

  const shown = useMemo(
    () =>
      books
        .map(b => ({ ...b, resources: kind ? b.resources.filter(r => r.kind === kind) : b.resources }))
        .filter(b => b.resources.length > 0),
    [books, kind],
  );

  const total = shown.reduce((n, b) => n + b.resources.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: ACCENT, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.heroTitle, { fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('qrLibraryTitle')}
        </Text>
        <Text style={[styles.heroMeta, { fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {gradeName ? `${gradeName} · ` : ''}
          {t('qrLibraryCount', total)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.intro,
            { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
          ]}
        >
          {t('qrLibraryIntro')}
        </Text>

        {kindCounts.size > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipRow, isRTL && { flexDirection: 'row-reverse' }]}
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

        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={36} color={colors.mutedForeground} />
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}
            >
              {t('qrLibraryEmpty')}
            </Text>
          </View>
        ) : (
          shown.map(book => {
            // Collapsed by default. One book can print 45 codes, and a student
            // arrives looking for their own subject, not a list of everything.
            const expanded = openBook === book.title;
            const count = lang === 'ar'
              ? book.resources.length.toLocaleString('ar-EG')
              : String(book.resources.length);
            return (
              <View key={book.title} style={styles.bookBlock}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setOpenBook(expanded ? null : book.title);
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
                    {book.title}
                  </Text>
                  <View style={[styles.countPill, { backgroundColor: ACCENT + '15' }]}>
                    <Text style={[styles.countText, { color: ACCENT, fontFamily: 'Cairo_600SemiBold' }]}>
                      {count}
                    </Text>
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={styles.rows}>
                    {book.resources.map(r => (
                      <ResourceRow key={`${r.url}-${r.pdfPage}`} resource={r} accent={ACCENT} />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 18, gap: 6 },
  backBtn: { padding: 4, marginBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 22 },
  heroMeta: { color: '#ffffffcc', fontSize: 13 },
  intro: { fontSize: 12.5, lineHeight: 20, paddingHorizontal: 20, paddingTop: 14 },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipText: { fontSize: 12.5 },
  bookBlock: { paddingHorizontal: 20, marginBottom: 10, gap: 8 },
  bookHeader: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 12 },
  bookTitle: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11.5 },
  rows: { gap: 8 },
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
  rowTitle: { fontSize: 13 },
  rowNote: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
