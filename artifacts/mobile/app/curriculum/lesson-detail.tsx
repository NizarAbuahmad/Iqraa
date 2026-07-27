import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/curriculumData';

const BLOOMS_COLORS: Record<string, string> = {
  Remember: '#6366F1',
  Understand: '#3B82F6',
  Apply: '#10B981',
  Analyze: '#F59E0B',
  Evaluate: '#F97316',
  Create: '#EF4444',
};

export default function LessonDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId, subjectColor } = useLocalSearchParams<{ lessonId: string; subjectColor: string }>();
  const lesson = getLessonById(lessonId);
  const color = subjectColor ?? colors.primary;

  if (!lesson) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>{t('lessonNotFound')}</Text>
      </View>
    );
  }

  const lessonTitle = lang === 'ar' ? (lesson.titleAr || lesson.title) : lesson.title;
  const objectivesArr = lang === 'ar' ? (lesson.objectivesAr || lesson.objectives) : lesson.objectives;
  const keywordsArr = lang === 'ar' ? (lesson.keywordsAr || lesson.keywords) : lesson.keywords;
  const noteText = lang === 'ar' ? (lesson.teacherNotesAr || lesson.teacherNotes) : lesson.teacherNotes;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.heroTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {lessonTitle}
        </Text>
        <View style={[styles.heroMeta, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="time-outline" size={12} color="#fff" />
            <Text style={[styles.heroPillText, { color: '#fff', fontFamily: 'Inter_400Regular' }]}>
              {lesson.estimatedDuration} {t('min')}
            </Text>
          </View>
          <View style={[styles.heroPill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="school-outline" size={12} color="#fff" />
            <Text style={[styles.heroPillText, { color: '#fff', fontFamily: 'Inter_400Regular' }]}>
              {lesson.outcomes.length} {t('outcomes')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Action buttons row */}
        <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: '/ai-tools/lesson-plan', params: { topic: lesson.title } });
            }}
            style={[styles.aiBtn, { backgroundColor: color, borderRadius: colors.radius, flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={[styles.aiBtnText, { color: '#fff', fontFamily: 'Inter_600SemiBold' }]}>
              {t('generateAILesson')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const msgText = lang === 'ar'
                ? `ما الذي يجب أن أعرفه قبل تدريس: ${lessonTitle}؟`
                : `What should I know before teaching: ${lessonTitle}?`;
              router.push({
                pathname: '/(tabs)/iqra',
                params: { initialMessage: msgText, lessonId: lessonId, subjectColor: color },
              } as any);
            }}
            style={[styles.askIqraBtn, { backgroundColor: colors.card, borderColor: color, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={color} />
            <Text style={[styles.askIqraBtnText, { color, fontFamily: 'Inter_600SemiBold' }]}>
              {t('askIqra')}
            </Text>
          </Pressable>
        </View>

        {/* Objectives */}
        <Section title={t('learningObjectives')} icon="checkmark-circle-outline" color={color} isRTL={isRTL}>
          {objectivesArr.map((obj, i) => (
            <View key={i} style={[styles.bullet, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.bulletDot, { backgroundColor: color }]} />
              <Text style={[styles.bulletText, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {obj}
              </Text>
            </View>
          ))}
        </Section>

        {/* Keywords */}
        <Section title={t('keyTerms')} icon="pricetag-outline" color={color} isRTL={isRTL}>
          <View style={[styles.keywords, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {keywordsArr.map(k => (
              <View key={k} style={[styles.keyword, { backgroundColor: color + '15', borderColor: color + '30', borderRadius: 8 }]}>
                <Text style={[styles.keywordText, { color, fontFamily: 'Inter_500Medium' }]}>{k}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Teacher Notes */}
        <Section title={t('teacherNotes')} icon="clipboard-outline" color={color} isRTL={isRTL}>
          <Text style={[styles.noteText, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {noteText}
          </Text>
        </Section>

        {/* Learning Outcomes */}
        <Section title={t('learningOutcomes')} icon="trophy-outline" color={color} isRTL={isRTL}>
          {lesson.outcomes.map(o => {
            const bloomColor = BLOOMS_COLORS[o.bloomsLevel] ?? color;
            const outcomeDesc = lang === 'ar' ? (o.descriptionAr || o.description) : o.description;
            return (
              <View key={o.id} style={[styles.outcomeCard, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
                <View style={[styles.outcomeTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.bloomsBadge, { backgroundColor: bloomColor + '20' }]}>
                    <Text style={[styles.bloomsText, { color: bloomColor, fontFamily: 'Inter_600SemiBold' }]}>{o.bloomsLevel}</Text>
                  </View>
                </View>
                <Text style={[styles.outcomeDesc, { color: colors.foreground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                  {outcomeDesc}
                </Text>
                <View style={[styles.skills, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {o.skills.map(s => (
                    <View key={s} style={[styles.skillPill, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 6 }]}>
                      <Text style={[styles.skillText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Section>
      </View>
    </ScrollView>
  );
}

function Section({ title, icon, color, isRTL, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; isRTL: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {title}
        </Text>
      </View>
      <View style={[styles.sectionBody, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 12 }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 10 },
  heroTitle: { fontSize: 22, lineHeight: 30, marginBottom: 12 },
  heroMeta: { gap: 8 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroPillText: { fontSize: 12 },
  body: { padding: 20 },
  actionRow: { gap: 10, marginBottom: 24 },
  aiBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  aiBtnText: { fontSize: 14 },
  askIqraBtn: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderWidth: 1.5 },
  askIqraBtnText: { fontSize: 13 },
  section: { marginBottom: 20 },
  sectionHeader: { alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 15 },
  sectionBody: { padding: 16, borderWidth: 1 },
  bullet: { gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 21 },
  keywords: { flexWrap: 'wrap', gap: 8 },
  keyword: { paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  keywordText: { fontSize: 12 },
  noteText: { fontSize: 14, lineHeight: 21 },
  outcomeCard: { padding: 14, marginBottom: 10 },
  outcomeTop: { marginBottom: 8 },
  bloomsBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  bloomsText: { fontSize: 11 },
  outcomeDesc: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  skills: { flexWrap: 'wrap', gap: 6 },
  skillPill: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  skillText: { fontSize: 11 },
});
