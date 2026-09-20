/**
 * Slim always-on strip above the tab content, showing the active grade,
 * subject and lesson and opening the same change-lesson sheet iQra chat
 * already owns. Before this, that context only appeared on the iQra tab
 * (buried inside CurrentLessonCard) — landing on Curriculum, AI Tools,
 * Messages or Profile gave a teacher no way to see or change it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import type { HomeLessonPick } from '@/services/lessonContext';
import type { TranslationKey } from '@/services/i18n';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  secondary: string;
  radius: number;
};

type Props = {
  pick: HomeLessonPick | null;
  lang: 'ar' | 'en';
  isRTL: boolean;
  colors: Colors;
  topInset: number;
  t: (k: TranslationKey) => string;
  onPress: () => void;
};

export function GlobalLessonBar({ pick, lang, isRTL, colors, topInset, t, onPress }: Props) {
  const isAr = lang === 'ar';
  const grade = pick?.gradeId ? getPickerGrades().find(g => g.id === pick.gradeId) : undefined;
  const subject = pick?.subjectId ? getPickerSubjects().find(s => s.id === pick.subjectId) : undefined;
  const gradeLabel = grade ? (isAr ? grade.nameAr : grade.name) : (isAr ? 'الصف العاشر' : 'Grade 10');
  const subjectLabel = subject ? (isAr ? subject.nameAr : subject.name) : (isAr ? 'الرياضيات' : 'Mathematics');
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: topInset + 10, backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          {
            flexDirection: rowDir,
            backgroundColor: colors.secondary,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('changeLesson')}
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.card }]}>
          <Ionicons name="school-outline" size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
            {subjectLabel} • {gradeLabel}
          </Text>
          <Text numberOfLines={1} style={[styles.topic, { color: colors.foreground, textAlign: align }]}>
            {pick?.topic || t('setTeachingContext')}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  pill: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontFamily: 'Almarai_400Regular', fontSize: 10.5 },
  topic: { fontFamily: 'Cairo_600SemiBold', fontSize: 13 },
});
