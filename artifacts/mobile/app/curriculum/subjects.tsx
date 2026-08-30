import React from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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

function DownloadChip({ label, url, icon, color }: {
  label: string; url: string; icon: 'download-outline' | 'school-outline'; color: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Linking.openURL(url);
      }}
      style={({ pressed }) => [
        styles.downloadChip,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.downloadChipText, { color: colors.foreground, fontFamily: 'Almarai_400Regular' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

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

  // Math/Chem/Finlit have one book per semester, so "Semester 1" alone tells
  // them apart. English has several different books (different school
  // tracks — Commerce, Agriculture, Hospitality, Industrial — the way
  // different Jordanian private schools use different English series) that
  // all happen to be Semester 1. Showing "Semester 1" on every card there
  // would make four cards read identically. Fall back to the book's own
  // title whenever more than one book on this screen shares a semester.
  const semesterCounts = new Map<number, number>();
  for (const b of books) {
    const s = b.semester ?? -1;
    semesterCounts.set(s, (semesterCounts.get(s) ?? 0) + 1);
  }

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
          // Every mobile role is teacher-or-admin (UserRole has no 'student'),
          // so the teacher-guide chip renders unconditionally here.
          const guideUrl = book.guidePdfUrl;
          const units = getUnitsForBook(book.id);
          const lessonCount = units.reduce((n, u) => n + getLessonsForUnit(u.id).length, 0);
          const semesterLabel = getSemesterLabel(book, lang);
          const semesterNum = book.semester;
          const hasSameSemesterSiblings = (semesterCounts.get(book.semester ?? -1) ?? 0) > 1;
          const bookName = lang === 'ar' ? (book.titleAr || book.title) : book.title;
          const cardTitle = hasSameSemesterSiblings ? bookName : semesterLabel;
          const cardMeta = hasSameSemesterSiblings
            ? `${semesterLabel} · ${t('unitsAndLessons', units.length, lessonCount)}`
            : t('unitsAndLessons', units.length, lessonCount);

          return (
            <View style={{ gap: 8 }}>
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
                    semesterLabel: cardTitle,
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
                  {cardTitle}
                </Text>
                <Text style={[styles.semesterMeta, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {cardMeta}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
            </Pressable>

            {/* The printed book teachers actually hold — NCCD PDFs, or the
                book's own hosted copy when NCCD doesn't publish it (then
                downloadNote replaces the NCCD source line). */}
            {(book.pdfUrl || guideUrl) && (
              <View style={{ gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <View style={[styles.downloadRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {book.pdfUrl && (
                    <DownloadChip label={t('downloadBook')} url={book.pdfUrl} icon="download-outline" color={color} />
                  )}
                  {guideUrl && (
                    <DownloadChip label={t('downloadTeacherGuide')} url={guideUrl} icon="school-outline" color={color} />
                  )}
                </View>
                <Text style={[styles.downloadNote, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {(lang === 'ar' ? book.downloadNoteAr : book.downloadNote)
                    ?? book.downloadNote
                    ?? t('downloadSourceNccd', book.academicYear)}
                </Text>
              </View>
            )}
            </View>
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
  downloadRow: { gap: 8, flexWrap: 'wrap' },
  downloadChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderRadius: 20,
  },
  downloadChipText: { fontSize: 12 },
  downloadNote: { fontSize: 11, paddingHorizontal: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
});
