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
import { GRADES, Grade, Subject, getSubjectsForGrade } from '@/services/curriculumData';

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
};

function SubjectCard({ subject, onPress, isRTL }: { subject: Subject; onPress: () => void; isRTL: boolean }) {
  const colors = useColors();
  const { lang } = useLanguage();
  const name = lang === 'ar' ? subject.nameAr : subject.name;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.subjectCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={[styles.subjectIcon, { backgroundColor: subject.color + '22', borderRadius: 14 }]}>
        <Ionicons name={SUBJECT_ICONS[subject.id] ?? 'book-outline'} size={26} color={subject.color} />
      </View>
      <Text style={[styles.subjectName, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' }]} numberOfLines={2}>
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
  const [selectedGrade, setSelectedGrade] = useState<Grade>(GRADES[9]); // Grade 10
  const [search, setSearch] = useState('');

  const subjects = getSubjectsForGrade(selectedGrade.id).filter(s => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.nameAr.includes(search)
    );
  });

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.card, paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('curriculumTitle')}
        </Text>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.muted, borderRadius: colors.radius }, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
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

      {/* ─── Grade selector ────────────────────────────────────── */}
      <View style={[styles.gradeBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.gradeScroll, isRTL && { flexDirection: 'row-reverse' }]}
        >
          {GRADES.map(g => {
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
                      fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular',
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

      {/* ─── Subjects grid ─────────────────────────────────────── */}
      <FlatList
        data={subjects}
        keyExtractor={s => s.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={[styles.gradeLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('subjects_count', subjects.length)} · {lang === 'ar' ? selectedGrade.nameAr : selectedGrade.name}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
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
  title: { fontSize: 28, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  gradeBar: { borderBottomWidth: 1 },
  gradeScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  gradeChip: { paddingHorizontal: 14, paddingVertical: 7 },
  gradeChipText: { fontSize: 13 },
  grid: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  gradeLabel: { fontSize: 12, marginBottom: 12 },
  subjectCard: { flex: 1, padding: 18, borderWidth: 1, alignItems: 'center', gap: 8 },
  subjectIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 14 },
});
