import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  getLessonsForUnit,
  getUnitById,
  isBrowserLessonTitleOnly,
  isCurriculumBookVisible,
} from '@/services/curriculumData';

export default function UnitLessonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { bookId, unitId, subjectColor, semesterLabel } = useLocalSearchParams<{
    bookId: string;
    unitId: string;
    subjectColor: string;
    semesterLabel?: string;
  }>();

  const color = subjectColor ?? colors.primary;
  const bookAllowed = isCurriculumBookVisible(bookId ?? '');
  const unit = unitId ? getUnitById(unitId) : undefined;

  useEffect(() => {
    if (!bookAllowed || !unit) router.replace('/(tabs)/curriculum');
  }, [bookAllowed, unit]);

  if (!bookAllowed || !unit) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const lessons = getLessonsForUnit(unit.id);
  const unitName = lang === 'ar' ? (unit.nameAr || unit.name) : unit.name;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.eyebrow, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {semesterLabel ? `${semesterLabel} · ` : ''}{t('unitLabel')} {unit.order}
        </Text>
        <Text style={[styles.title, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
          {unitName}
        </Text>
        <Text style={[styles.sub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('selectLesson')} · {t('lessonsCount', lessons.length)}
        </Text>
      </View>

      <FlatList
        data={lessons}
        keyExtractor={l => l.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 10 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              {t('noUnitsOrLessons')}
            </Text>
          </View>
        }
        renderItem={({ item: lesson }) => {
          const lessonTitle = lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title;
          const objectivesArr = lang === 'ar' ? (lesson.objectivesAr || lesson.objectives) : lesson.objectives;

          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/curriculum/lesson-detail',
                  params: { lessonId: lesson.id, subjectColor: color },
                });
              }}
              style={({ pressed }) => [
                styles.lessonCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.lessonAccent, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text
                    style={[
                      styles.lessonTitle,
                      {
                        color: colors.foreground,
                        fontFamily: 'Inter_500Medium',
                        textAlign: isRTL ? 'right' : 'left',
                        flex: 1,
                        marginBottom: 0,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {lessonTitle}
                  </Text>
                  {isBrowserLessonTitleOnly(lesson.id) ? (
                    <View style={[styles.prepBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.prepBadgeText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                        {t('curriculumTitleOnlyBadge')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.lessonMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
  lessonCard: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
  },
  lessonAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  lessonTitle: { fontSize: 14, marginBottom: 4 },
  lessonMeta: { alignItems: 'center', gap: 5 },
  lessonTime: { fontSize: 11 },
  prepBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, flexShrink: 0 },
  prepBadgeText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14 },
});
