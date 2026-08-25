import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  askAboutResourceMessage,
  buildLessonShelf,
  type ShelfGroup,
} from '@/services/lessonShelf';
import { displayTitle, kindLabel, type SupportResource } from '@/services/mathSupportResources';

type Props = {
  lessonId: string;
  /** The subject colour the rest of the lesson page is themed with. */
  accent: string;
};

/**
 * What the library holds for this lesson.
 *
 * The rest of the lesson page is what the curriculum says. This is what is on
 * file: eight worksheets and two question banks on الدائرة, by name, by author.
 * Until the two source catalogs were merged the app could not have drawn this
 * — every past paper and every practice sheet shared one `quiz` type, so
 * "three worksheets and two past papers" was not a sentence the data could say.
 *
 * **It does not claim to hand over the PDFs.** They are gitignored and not
 * shipped, so the only honest action on a row is to take it to chat, which
 * already grounds its reply on these titles. Saying so once, under the header,
 * is better than a download button that fails.
 */
export function LessonShelfPanel({ lessonId, accent }: Props) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const [showSemester, setShowSemester] = useState(false);

  const shelf = useMemo(
    () => buildLessonShelf(lessonId, lang as 'ar' | 'en'),
    [lessonId, lang],
  );

  if (!shelf) return null;

  // Named so the toggle and the header add up on screen: the pill counts the
  // whole shelf, the unit heading counts what is listed, and this counts what
  // is behind the fold. 11 + 24 = 35, visibly.
  const semesterCount = shelf.semester.reduce((n, g) => n + g.items.length, 0);

  const ask = (r: SupportResource) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(tabs)/iqra',
      params: {
        initialMessage: askAboutResourceMessage(r, shelf.topic, lang as 'ar' | 'en'),
        lessonId,
        subjectColor: accent,
      },
    } as any);
  };

  const row = (r: SupportResource) => (
    <Pressable
      key={r.id}
      onPress={() => ask(r)}
      accessibilityRole="button"
      accessibilityLabel={`${displayTitle(r)} — ${t('shelfAsk')}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View style={[styles.kindPill, { backgroundColor: accent + '15', borderColor: accent + '30' }]}>
        <Text style={[styles.kindText, { color: accent, fontFamily: 'Cairo_500Medium' }]}>
          {kindLabel(r.kind, lang as 'ar' | 'en')}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text
          numberOfLines={2}
          style={[styles.rowTitle, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
        >
          {displayTitle(r)}
        </Text>
        {r.authorAr ? (
          <Text
            numberOfLines={1}
            style={[styles.rowAuthor, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
          >
            {lang === 'ar' ? `أ. ${r.authorAr}` : r.authorAr}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.mutedForeground} />
    </Pressable>
  );

  const groups = (list: ShelfGroup[]) =>
    list.map(g => <View key={g.kind} style={styles.group}>{g.items.map(row)}</View>);

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="library-outline" size={16} color={accent} />
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
          {t('shelfTitle')}
        </Text>
        {shelf.total > 0 ? (
          <View style={[styles.countPill, { backgroundColor: accent + '15' }]}>
            <Text style={[styles.countText, { color: accent, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('shelfCount', shelf.total)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {shelf.total === 0 ? (
          <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('shelfEmpty')}
          </Text>
        ) : (
          <>
            <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('shelfNotInApp')}
            </Text>
            {shelf.referenceOnly > 0 ? (
              <Text style={[styles.note, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {t('shelfReferenceOnly', shelf.referenceOnly)}
              </Text>
            ) : null}

            {shelf.unit.length > 0 ? (
              <>
                <Text style={[styles.groupLabel, { color: accent, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('shelfUnitScoped', shelf.unit.reduce((n, g) => n + g.items.length, 0))}
                </Text>
                {groups(shelf.unit)}
              </>
            ) : null}

            {/* Semester-wide material is collapsed by default. It is the same
                twenty-odd files on every lesson in the semester — real, but it
                would bury the handful that are about this lesson. */}
            {shelf.semester.length > 0 ? (
              <>
                <Pressable
                  onPress={() => setShowSemester(v => !v)}
                  accessibilityRole="button"
                  style={[styles.toggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons
                    name={showSemester ? 'chevron-down' : isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={14}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.toggleText, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium' }]}>
                    {showSemester
                      ? t('shelfHideSemester', semesterCount)
                      : t('shelfShowSemester', semesterCount)}
                  </Text>
                </Pressable>
                {showSemester ? groups(shelf.semester) : null}
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  sectionHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15 },
  countPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  countText: { fontSize: 11 },
  sectionBody: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  note: { fontSize: 12, lineHeight: 18 },
  groupLabel: { fontSize: 12.5, marginTop: 6 },
  group: { gap: 8 },
  row: { alignItems: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 12.5, lineHeight: 18 },
  rowAuthor: { fontSize: 11 },
  kindPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  kindText: { fontSize: 10.5 },
  toggle: { alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 4 },
  toggleText: { fontSize: 12.5 },
});
