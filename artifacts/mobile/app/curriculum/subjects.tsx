import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { BOOKS, Book } from '@/services/curriculumData';

export default function SubjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { gradeId, gradeName, subjectId, subjectName, subjectColor } = useLocalSearchParams<{
    gradeId: string; gradeName: string; subjectId: string; subjectName: string; subjectColor: string;
  }>();

  const books = BOOKS.filter(b => b.subjectId === subjectId && b.gradeId === gradeId);
  const color = subjectColor ?? colors.primary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.heroContent}>
          <Text style={[styles.heroGrade, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' }]}>{gradeName}</Text>
          <Text style={[styles.heroTitle, { color: '#fff', fontFamily: 'Inter_700Bold' }]}>{subjectName}</Text>
          <Text style={[styles.heroSub, { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' }]}>
            {books.length} book{books.length !== 1 ? 's' : ''} available
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
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>No books yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
              Books for {subjectName} in {gradeName} will appear here.
            </Text>
          </View>
        }
        renderItem={({ item: book }) => (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/curriculum/lessons', params: { bookId: book.id, bookTitle: book.title, subjectColor: color } });
            }}
            style={({ pressed }) => [
              styles.bookCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.bookIcon, { backgroundColor: color + '1A', borderRadius: 12 }]}>
              <Ionicons name="book-outline" size={24} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{book.title}</Text>
              <View style={styles.bookMeta}>
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
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
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
  bookCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, gap: 14 },
  bookIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookTitle: { fontSize: 15, marginBottom: 8 },
  bookMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
