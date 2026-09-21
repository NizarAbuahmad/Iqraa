/**
 * The teacher's active grade, subject and lesson, opening the same
 * change-lesson sheet iQra chat already owns. Two layouts of one thing:
 * `bar` is a toolbar above the tab content on phones; `card` sits at the top
 * of the desktop sidebar, where the lesson reads as the workspace the nav
 * belongs to rather than a caption in the window's top edge. Before this the
 * bar was a 34px strip in card-on-card white — teachers did not see it as a
 * control, or at all.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPickerGrades, getPickerSubjects } from '@/services/curriculumData';
import type { HomeLessonPick } from '@/services/lessonContext';
import type { TranslationKey } from '@/services/i18n';

type Colors = {
  background: string;
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  radius: number;
};

type Props = {
  layout: 'bar' | 'card';
  pick: HomeLessonPick | null;
  lang: 'ar' | 'en';
  isRTL: boolean;
  colors: Colors;
  /** Only the bar sits under the status bar; the card is inside the sidebar's own inset. */
  topInset?: number;
  t: (k: TranslationKey) => string;
  onPress: () => void;
};

export function GlobalLessonBar({ layout, pick, lang, isRTL, colors, topInset = 0, t, onPress }: Props) {
  const isAr = lang === 'ar';
  const grade = pick?.gradeId ? getPickerGrades().find(g => g.id === pick.gradeId) : undefined;
  const subject = pick?.subjectId ? getPickerSubjects().find(s => s.id === pick.subjectId) : undefined;
  const gradeLabel = grade ? (isAr ? grade.nameAr : grade.name) : (isAr ? 'الصف العاشر' : 'Grade 10');
  const subjectLabel = subject ? (isAr ? subject.nameAr : subject.name) : (isAr ? 'الرياضيات' : 'Mathematics');
  const topic = pick?.topic || t('setTeachingContext');
  const rowDir = isRTL ? 'row-reverse' as const : 'row' as const;
  const align = isRTL ? 'right' as const : 'left' as const;
  const onPrimary = colors.primaryForeground || '#fff';

  const changeButton = (
    <View style={[styles.changeBtn, { flexDirection: rowDir, backgroundColor: colors.primary }]}>
      <Ionicons name="swap-horizontal" size={14} color={onPrimary} />
      <Text numberOfLines={1} style={[styles.changeBtnText, { color: onPrimary }]}>
        {t('changeLesson')}
      </Text>
    </View>
  );

  if (layout === 'card') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('changeLesson')}
      >
        <View style={[styles.cardHeader, { flexDirection: rowDir }]}>
          <Ionicons name="school-outline" size={14} color={colors.primary} />
          <Text style={[styles.cardLabel, { color: colors.primary, textAlign: align, flex: 1 }]}>
            {t('teachingContextLabel')}
          </Text>
        </View>
        <Text numberOfLines={2} style={[styles.cardTopic, { color: colors.foreground, textAlign: align }]}>
          {topic}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
          {subjectLabel} • {gradeLabel}
        </Text>
        {changeButton}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: topInset + 10, backgroundColor: colors.card, borderBottomColor: colors.border },
        styles.barWrap,
        { paddingTop: topInset + 8, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pill,
          {
            flexDirection: rowDir,
            backgroundColor: colors.secondary,
          styles.barPill,
          {
            flexDirection: rowDir,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('changeLesson')}
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.card }]}>
          <Ionicons name="school-outline" size={15} color={colors.primary} />
        <View style={[styles.iconBubble, { backgroundColor: colors.secondary }]}>
          <Ionicons name="school-outline" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground, textAlign: align }]}>
            {subjectLabel} • {gradeLabel}
          </Text>
          <Text numberOfLines={1} style={[styles.barTopic, { color: colors.foreground, textAlign: align }]}>
            {topic}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.primary} />
        {changeButton}
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
  barWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  barPill: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barTopic: { fontFamily: 'Cairo_700Bold', fontSize: 15, lineHeight: 21 },
  card: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
    marginBottom: 8,
  },
  cardHeader: { alignItems: 'center', gap: 6 },
  cardLabel: { fontFamily: 'Cairo_600SemiBold', fontSize: 11 },
  cardTopic: { fontFamily: 'Cairo_700Bold', fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: 'Almarai_400Regular', fontSize: 11 },
  changeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    flexShrink: 0,
    marginTop: 2,
  },
  changeBtnText: { fontFamily: 'Cairo_600SemiBold', fontSize: 12 },
});
