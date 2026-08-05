import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  getBookById,
  getLessonsForUnit,
  getSemesterLabel,
  getUnitsForBook,
  isBrowserUnitTitleOnly,
  isCurriculumBookVisible,
} from '@/services/curriculumData';

/** Unit picker for a selected semester (book). */
export default function LessonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const {
    bookId,
    bookTitle,
    bookTitleAr,
    subjectColor,
    semesterLabel: semesterLabelParam,
  } = useLocalSearchParams<{
    bookId: string;
    bookTitle: string;
    bookTitleAr?: string;
    subjectColor: string;
    semesterLabel?: string;
  }>();

  const color = subjectColor ?? colors.primary;
  const bookAllowed = isCurriculumBookVisible(bookId ?? '');
  const book = getBookById(bookId ?? '');

  useEffect(() => {
    if (!bookAllowed) router.replace('/(tabs)/curriculum');
  }, [bookAllowed]);

  if (!bookAllowed) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const semesterLabel =
    semesterLabelParam ||
    (book ? getSemesterLabel(book, lang) : (lang === 'ar' ? bookTitleAr || bookTitle : bookTitle));

  const units = getUnitsForBook(bookId ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.eyebrow, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {semesterLabel}
        </Text>
        <Text style={[styles.title, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('selectUnit')}
        </Text>
        <Text style={[styles.sub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('unitsAvailable', units.length)}
        </Text>
      </View>

      <FlatList
        data={units}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {t('noUnitsOrLessons')}
            </Text>
          </View>
        }
        renderItem={({ item: unit }) => {
          const unitName = lang === 'ar' ? (unit.nameAr || unit.name) : unit.name;
          const unitDesc = lang === 'ar' ? (unit.descriptionAr || unit.description) : unit.description;
          const lessonCount = getLessonsForUnit(unit.id).length;

          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/curriculum/unit',
                  params: {
                    bookId,
                    unitId: unit.id,
                    subjectColor: color,
                    semesterLabel,
                  },
                });
              }}
              style={({ pressed }) => [
                styles.unitCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.unitBadge, { backgroundColor: color + '1A' }]}>
                <Text style={[styles.unitNum, { color, fontFamily: 'Inter_700Bold' }]}>
                  {unit.order}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={[styles.unitName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left', flex: 1, marginBottom: 0 }]}>
                    {unitName}
                  </Text>
                  {isBrowserUnitTitleOnly(unit.id) ? (
                    <View style={[styles.prepBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.prepBadgeText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                        {t('curriculumTitleOnlyBadge')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.unitDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
                  numberOfLines={2}
                >
                  {unitDesc}
                </Text>
                <Text style={[styles.unitMeta, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('lessonsCount', lessonCount)}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { marginBottom: 12, width: 40, height: 40, justifyContent: 'center' },
  eyebrow: { fontSize: 13, marginBottom: 4 },
  title: { fontSize: 22, marginBottom: 4 },
  sub: { fontSize: 13 },
  unitCard: { alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  unitBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unitNum: { fontSize: 16 },
  unitName: { fontSize: 16, marginBottom: 4 },
  unitDesc: { fontSize: 12, marginBottom: 6, lineHeight: 18 },
  unitMeta: { fontSize: 12 },
  prepBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, flexShrink: 0 },
  prepBadgeText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14 },
});
