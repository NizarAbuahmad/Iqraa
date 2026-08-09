import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  Book,
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getSemesterLabel,
  getUnitsForBook,
} from '@/services/curriculumData';

export default function SubjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const { gradeId, gradeName, subjectId, subjectName, subjectColor } = useLocalSearchParams<{
    gradeId: string; gradeName: string;
    subjectId: string; subjectName: string; subjectColor: string;
  }>();

  const books: Book[] = getBooksForSubjectGrade(
    subjectId ?? '',
    gradeId ?? '',
    user?.role,
  ).slice().sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99));

  const color = subjectColor ?? colors.primary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <View style={[styles.heroContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.heroGrade, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('jordanCurriculum')} · {gradeName}
          </Text>
          <Text style={[styles.heroTitle, { color: '#fff', fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {subjectName}
          </Text>
          <Text style={[styles.heroSub, { color: 'rgba(255,255,255,0.85)', fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('selectSemester')}
          </Text>
        </View>
      </View>

      <FlatList
        data={books}
        keyExtractor={b => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 14 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
              {t('noSemesters')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
              {t('noBooksDesc', subjectName ?? '', gradeName ?? '')}
            </Text>
          </View>
        }
        renderItem={({ item: book }) => {
          const units = getUnitsForBook(book.id);
          const lessonCount = units.reduce((n, u) => n + getLessonsForUnit(u.id).length, 0);
          const semesterLabel = getSemesterLabel(book, lang);
          const semesterNum = book.semester;

          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/curriculum/lessons',
                  params: {
                    bookId: book.id,
                    bookTitle: book.title,
                    bookTitleAr: book.titleAr,
                    subjectColor: color,
                    semesterLabel,
                  },
                });
              }}
              style={({ pressed }) => [
                styles.semesterCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.semesterBadge, { backgroundColor: color }]}>
                <Text style={[styles.semesterBadgeText, { fontFamily: 'Cairo_700Bold' }]}>
                  {semesterNum ?? '•'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.semesterTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {semesterLabel}
                </Text>
                <Text style={[styles.semesterMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('unitsAndLessons', units.length, lessonCount)}
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
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  backBtn: { marginBottom: 16, width: 40, height: 40, justifyContent: 'center' },
  heroContent: { gap: 4 },
  heroGrade: { fontSize: 13 },
  heroTitle: { fontSize: 28 },
  heroSub: { fontSize: 14, marginTop: 6 },
  semesterCard: { alignItems: 'center', padding: 18, borderWidth: 1, gap: 14 },
  semesterBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  semesterBadgeText: { fontSize: 20, color: '#fff' },
  semesterTitle: { fontSize: 17, marginBottom: 4 },
  semesterMeta: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
});
