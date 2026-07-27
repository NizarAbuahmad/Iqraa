import React from 'react';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getUnitsForBook, getLessonsForUnit } from '@/services/curriculumData';

export default function LessonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { bookId, bookTitle, bookTitleAr, subjectColor } = useLocalSearchParams<{
    bookId: string; bookTitle: string; bookTitleAr?: string; subjectColor: string;
  }>();
  const color = subjectColor ?? colors.primary;

  const units = getUnitsForBook(bookId);
  const sections = units.map(u => ({ unit: u, lessons: getLessonsForUnit(u.id) }));
  const totalLessons = sections.reduce((s, x) => s + x.lessons.length, 0);

  const displayBookTitle = lang === 'ar' ? (bookTitleAr || bookTitle) : bookTitle;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.bookTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
          {displayBookTitle}
        </Text>
        <Text style={[styles.bookSub, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {units.length} {t('units')} · {totalLessons} {t('lessons')}
        </Text>
      </View>

      <SectionList
        sections={sections.map(s => ({ title: s.unit, data: s.lessons }))}
        keyExtractor={l => l.id}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {t('noUnitsOrLessons')}
            </Text>
          </View>
        }
        renderSectionHeader={({ section: { title: unit } }) => {
          const unitName = lang === 'ar' ? (unit.nameAr || unit.name) : unit.name;
          const unitDesc = lang === 'ar' ? (unit.descriptionAr || unit.description) : unit.description;
          return (
            <View style={[styles.unitHeader, { backgroundColor: colors.background, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.unitBadge, { backgroundColor: color + '1A' }]}>
                <Text style={[styles.unitNum, { color, fontFamily: 'Inter_600SemiBold' }]}>
                  {t('unitLabel')} {unit.order}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.unitName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {unitName}
                </Text>
                <Text style={[styles.unitDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {unitDesc}
                </Text>
              </View>
            </View>
          );
        }}
        renderItem={({ item: lesson }) => {
          const lessonTitle = lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title;
          const objectivesArr = lang === 'ar' ? (lesson.objectivesAr || lesson.objectives) : lesson.objectives;
          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/curriculum/lesson-detail', params: { lessonId: lesson.id, subjectColor: color } });
              }}
              style={({ pressed }) => [
                styles.lessonCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  marginHorizontal: 16,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.lessonDot, { backgroundColor: color, [isRTL ? 'right' : 'left']: 0 }]} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.lessonTitle,
                    {
                      color: colors.foreground,
                      fontFamily: 'Inter_500Medium',
                      textAlign: isRTL ? 'right' : 'left',
                      paddingLeft: isRTL ? 0 : 4,
                      paddingRight: isRTL ? 4 : 0,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {lessonTitle}
                </Text>
                <View style={[styles.lessonMeta, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingLeft: isRTL ? 0 : 4, paddingRight: isRTL ? 4 : 0 }]}>
                  <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.lessonTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {lesson.estimatedDuration} {t('min')}
                  </Text>
                  <Text style={{ color: colors.border }}>·</Text>
                  <Text style={[styles.lessonTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {t('objectivesCount', objectivesArr.length)}
                  </Text>
                </View>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
            </Pressable>
          );
        }}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 8, marginHorizontal: 16 }} />}
        renderSectionFooter={() => <View style={{ height: 16 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { marginBottom: 12, width: 40, height: 40, justifyContent: 'center' },
  bookTitle: { fontSize: 22, marginBottom: 4 },
  bookSub: { fontSize: 13 },
  unitHeader: { alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  unitBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  unitNum: { fontSize: 12 },
  unitName: { fontSize: 15, marginBottom: 2 },
  unitDesc: { fontSize: 12 },
  lessonCard: { alignItems: 'center', padding: 14, borderWidth: 1, gap: 12, overflow: 'hidden' },
  lessonDot: { width: 4, height: '100%', borderRadius: 2, position: 'absolute' },
  lessonTitle: { fontSize: 14, marginBottom: 4 },
  lessonMeta: { alignItems: 'center', gap: 5 },
  lessonTime: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14 },
});
