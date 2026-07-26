import React from 'react';
import { FlatList, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { UNITS, LESSONS, Unit, Lesson, getUnitsForBook, getLessonsForUnit } from '@/services/curriculumData';

export default function LessonsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookId, bookTitle, subjectColor } = useLocalSearchParams<{ bookId: string; bookTitle: string; subjectColor: string }>();
  const color = subjectColor ?? colors.primary;

  const units = getUnitsForBook(bookId);
  const sections = units.map(u => ({ unit: u, lessons: getLessonsForUnit(u.id) }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.bookTitle, { color: '#fff', fontFamily: 'Inter_700Bold' }]} numberOfLines={2}>{bookTitle}</Text>
        <Text style={[styles.bookSub, { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' }]}>
          {units.length} unit{units.length !== 1 ? 's' : ''} · {sections.reduce((s, x) => s + x.lessons.length, 0)} lessons
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
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>No units or lessons yet</Text>
          </View>
        }
        renderSectionHeader={({ section: { title: unit } }) => (
          <View style={[styles.unitHeader, { backgroundColor: colors.background }]}>
            <View style={[styles.unitBadge, { backgroundColor: color + '1A' }]}>
              <Text style={[styles.unitNum, { color, fontFamily: 'Inter_600SemiBold' }]}>Unit {unit.order}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.unitName, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>{unit.name}</Text>
              <Text style={[styles.unitDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]} numberOfLines={1}>{unit.description}</Text>
            </View>
          </View>
        )}
        renderItem={({ item: lesson }) => (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/curriculum/lesson-detail', params: { lessonId: lesson.id, subjectColor: color } });
            }}
            style={({ pressed }) => [
              styles.lessonCard,
              { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.lessonDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.lessonTitle, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]} numberOfLines={2}>
                {lesson.title}
              </Text>
              <View style={styles.lessonMeta}>
                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.lessonTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {lesson.estimatedDuration} min
                </Text>
                <Text style={[{ color: colors.border }]}>·</Text>
                <Text style={[styles.lessonTime, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                  {lesson.objectives.length} objectives
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
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
  unitHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  unitBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  unitNum: { fontSize: 12 },
  unitName: { fontSize: 15, marginBottom: 2 },
  unitDesc: { fontSize: 12 },
  lessonCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, gap: 12, overflow: 'hidden' },
  lessonDot: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0 },
  lessonTitle: { fontSize: 14, marginBottom: 4, paddingLeft: 4 },
  lessonMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4 },
  lessonTime: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14 },
});
