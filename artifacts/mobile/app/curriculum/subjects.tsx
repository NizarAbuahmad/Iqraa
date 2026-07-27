import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { BOOKS, Book } from '@/services/curriculumData';

export default function SubjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { gradeId, gradeName, subjectId, subjectName, subjectColor } = useLocalSearchParams<{
    gradeId: string; gradeName: string;
    subjectId: string; subjectName: string; subjectColor: string;
  }>();

  const books = BOOKS.filter(b => b.subjectId === subjectId && b.gradeId === gradeId);
  const color = subjectColor ?? colors.primary;
  // curriculum.tsx already passes the translated name based on current lang
  const displaySubject = subjectName;
  const displayGrade = gradeName;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <View style={[styles.heroContent, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.heroGrade, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {displayGrade}
          </Text>
          <Text style={[styles.heroTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {displaySubject}
          </Text>
          <Text style={[styles.heroSub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('booksAvailable', books.length)}
          </Text>
        </View>
      </View>

      <FlatList
        data={books}
        keyExtractor={b => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
              {t('noBooks')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center' }]}>
              {t('noBooksDesc', displaySubject, displayGrade)}
            </Text>
          </View>
        }
        renderItem={({ item: book }) => {
          const bookTitle = lang === 'ar' ? (book.titleAr || book.title) : book.title;
          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/curriculum/lessons',
                  params: { bookId: book.id, bookTitle: book.title, bookTitleAr: book.titleAr, subjectColor: color },
                });
              }}
              style={({ pressed }) => [
                styles.bookCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.bookIcon, { backgroundColor: color + '1A', borderRadius: 12 }]}>
                <Ionicons name="book-outline" size={24} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {bookTitle}
                </Text>
                <View style={[styles.bookMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.pill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.pillText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{book.academicYear}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.pillText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{book.language}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.pillText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>Ed. {book.edition}</Text>
                  </View>
                </View>
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
  heroSub: { fontSize: 13, marginTop: 2 },
  bookCard: { alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  bookIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookTitle: { fontSize: 15, marginBottom: 8 },
  bookMeta: { gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14 },
});
