import React, { useState } from 'react';
import {
  FlatList, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import {
  Grade, Subject,
  getVisibleGrades, getSubjectsForGrade,
} from '@/services/curriculumData';
import { qrResourceCountForGrade } from '@/services/bookQrLinks';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { narrowToSelection } from '@/services/teacherCatalogFilter';

const SUBJECT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  arabic:      'text',
  english:     'language',
  mathematics: 'calculator',
  science:     'flask',
  physics:     'nuclear',
  chemistry:   'beaker',
  biology:     'leaf',
  islamic:     'moon',
  social:      'globe',
  computer:    'laptop-outline',
  'financial-literacy': 'wallet-outline',
};

function SubjectCard({ subject, onPress, isRTL }: { subject: Subject; onPress: () => void; isRTL: boolean }) {
  const colors = useColors();
  const { lang } = useLanguage();
  const name = lang === 'ar' ? subject.nameAr : subject.name;
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.subjectCard,
        {
          backgroundColor: hovered ? colors.muted : colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.subjectIcon, { backgroundColor: subject.color + '22', borderRadius: 14 }]}>
        <Ionicons name={SUBJECT_ICONS[subject.id] ?? 'book-outline'} size={26} color={subject.color} />
      </View>
      <Text style={[styles.subjectName, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: 'center' }]} numberOfLines={2}>
        {name}
      </Text>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={14} color={colors.mutedForeground} style={{ marginTop: 4 }} />
    </Pressable>
  );
}

export default function CurriculumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  // A teacher who has picked grades/subjects on /setup-subjects sees only
  // those by default here — the whole point of asking at signup. Anyone else
  // (no selection yet, or not a teacher) sees the full catalog, unchanged.
  const visibleGrades = narrowToSelection(getVisibleGrades(), isTeacherRole(user?.role) ? user?.gradeIds : undefined);
  const [selectedGrade, setSelectedGrade] = useState<Grade>(visibleGrades[0]);
  const [search, setSearch] = useState('');

  const subjects = narrowToSelection(
    getSubjectsForGrade(selectedGrade.id),
    isTeacherRole(user?.role) ? user?.subjectIds : undefined,
  ).filter(s => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.nameAr.includes(search)
    );
  });

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);
  const showGradePicker = visibleGrades.length > 1;

  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const numColumns = isDesktop ? 4 : 2;
  /** Centred column on desktop web; full-bleed on phones. */
  const centered = { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };

  // Hidden rather than shown-and-empty: grades 6, 7 and 8 have no printed codes
  // at all, so on those an entry row would be a promise with nothing behind it.
  const qrCount = qrResourceCountForGrade(selectedGrade.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={centered}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('curriculumTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('jordanCurriculum')}
        </Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.muted, borderRadius: colors.radius }, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={t('searchSubjects')}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}

          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
        </View>
      </View>

      {/* ─── Grade selector (hidden when only one grade is exposed) ── */}
      {showGradePicker ? (
      <View style={[styles.gradeBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.gradeScroll, isRTL && { flexDirection: 'row-reverse' }]}
        >
          {visibleGrades.map(g => {
            const isActive = g.id === selectedGrade.id;
            const gradeName = lang === 'ar' ? g.nameAr : g.name;
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedGrade(g);
                  setSearch('');
                }}
                style={[
                  styles.gradeChip,
                  { backgroundColor: isActive ? colors.primary : colors.muted, borderRadius: 20 },
                ]}
              >
                <Text
                  style={[
                    styles.gradeChipText,
                    {
                      color: isActive ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: isActive ? 'Cairo_600SemiBold' : 'Almarai_400Regular',
                    },
                  ]}
                >
                  {gradeName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      ) : (
        <View style={[styles.gradeBar, styles.gradeFixed, { borderBottomColor: colors.border, backgroundColor: colors.card }, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={[styles.gradeChip, { backgroundColor: colors.primary, borderRadius: 20 }]}>
            <Text style={[styles.gradeChipText, { color: colors.primaryForeground, fontFamily: 'Cairo_600SemiBold' }]}>
              {lang === 'ar' ? selectedGrade.nameAr : selectedGrade.name}
            </Text>
          </View>
        </View>
      )}

      {/* ─── Subjects grid ─────────────────────────────────────── */}
      <FlatList
        key={numColumns}
        data={subjects}
        keyExtractor={s => s.id}
        numColumns={numColumns}
        contentContainerStyle={[styles.grid, centered]}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* The library of what this grade's books point at. Above the
                subject grid because it is the one thing here that is not the
                curriculum restated — it is material a student can open now. */}
            {qrCount > 0 ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/curriculum/resources',
                    params: {
                      gradeId: selectedGrade.id,
                      gradeName: lang === 'ar' ? selectedGrade.nameAr : selectedGrade.name,
                    },
                  });
                }}
                style={({ pressed }) => [
                  styles.libraryRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="library-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.libraryTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('qrLibraryEntry')}
                  </Text>
                  <Text style={[styles.libraryMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('qrLibraryCount', qrCount)}
                  </Text>
                </View>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
            <View style={[styles.gradeLabelRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.gradeLabel, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left', flex: 1 }]}>
                {t('subjects_count', subjects.length)} · {lang === 'ar' ? selectedGrade.nameAr : selectedGrade.name}
              </Text>
              {isTeacherRole(user?.role) ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/setup-subjects', params: { mode: 'edit' } } as any);
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.gradeLabel, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>
                    {t('editTeachingTitle')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('noSubjectsFound')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SubjectCard
            subject={item}
            isRTL={isRTL}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/curriculum/subjects',
                params: {
                  gradeId: selectedGrade.id,
                  gradeName: lang === 'ar' ? selectedGrade.nameAr : selectedGrade.name,
                  subjectId: item.id,
                  subjectName: lang === 'ar' ? item.nameAr : item.name,
                  subjectColor: item.color,
                },
              });
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  title: { fontSize: 28, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  gradeBar: { borderBottomWidth: 1 },
  gradeFixed: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row' },
  gradeScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  gradeChip: { paddingHorizontal: 14, paddingVertical: 7 },
  gradeChipText: { fontSize: 13 },
  grid: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  gradeLabelRow: { alignItems: 'center', gap: 10, marginBottom: 12 },
  gradeLabel: { fontSize: 12 },
  libraryRow: { alignItems: 'center', gap: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  libraryTitle: { fontSize: 14 },
  libraryMeta: { fontSize: 11.5, marginTop: 2 },
  subjectCard: { flex: 1, padding: 18, borderWidth: 1, alignItems: 'center', gap: 8 },
  subjectIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 14 },
});
