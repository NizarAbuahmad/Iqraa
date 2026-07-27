import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

interface ToolDef {
  id: string;
  titleKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  routeParams?: Record<string, string>;
  badgeKey?: string;
}

const TOOLS: ToolDef[] = [
  {
    id: 'lesson-plan',
    titleKey: 'toolLessonPlanTitle',
    descKey: 'toolLessonPlanDesc',
    icon: 'document-text-outline',
    color: '#1B6B62',
    route: '/ai-tools/lesson-plan',
    badgeKey: 'popularBadge',
  },
  {
    id: 'worksheet',
    titleKey: 'toolWorksheetTitle',
    descKey: 'toolWorksheetDesc',
    icon: 'list-outline',
    color: '#8B5CF6',
    route: '/ai-tools/worksheet',
  },
  {
    id: 'quiz',
    titleKey: 'toolQuizTitle',
    descKey: 'toolQuizDesc',
    icon: 'help-circle-outline',
    color: '#F59E0B',
    route: '/ai-tools/quiz',
    badgeKey: 'newBadge',
  },
  {
    id: 'homework',
    titleKey: 'toolHomeworkTitle',
    descKey: 'toolHomeworkDesc',
    icon: 'home-outline',
    color: '#3B82F6',
    route: '/ai-tools/coming-soon',
    routeParams: { tool: 'homework' },
  },
  {
    id: 'exam',
    titleKey: 'toolExamTitle',
    descKey: 'toolExamDesc',
    icon: 'school-outline',
    color: '#EF4444',
    route: '/ai-tools/coming-soon',
    routeParams: { tool: 'exam' },
  },
  {
    id: 'parent-msg',
    titleKey: 'toolParentMsgTitle',
    descKey: 'toolParentMsgDesc',
    icon: 'chatbubble-outline',
    color: '#10B981',
    route: '/ai-tools/coming-soon',
    routeParams: { tool: 'parent-msg' },
  },
];

export default function AIToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiTools')}
        </Text>
        <View style={[styles.aiBadge, { backgroundColor: colors.primary + '18', borderRadius: 20, alignSelf: isRTL ? 'flex-end' : 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={[styles.aiBadgeText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            {t('poweredByAI')}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiToolsSubtitle')}
        </Text>
      </View>

      <View style={styles.list}>
        {TOOLS.map(tool => (
          <Pressable
            key={tool.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: tool.route as any, params: tool.routeParams });
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: tool.color + '1A', borderRadius: 14 }]}>
              <Ionicons name={tool.icon} size={28} color={tool.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={[styles.titleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
                  {t(tool.titleKey as any)}
                </Text>
                {tool.badgeKey && (
                  <View style={[styles.badge, { backgroundColor: tool.color + '22' }]}>
                    <Text style={[styles.badgeText, { color: tool.color, fontFamily: 'Inter_600SemiBold' }]}>
                      {t(tool.badgeKey as any)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                {t(tool.descKey as any)}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>

      <View style={[styles.note, { backgroundColor: colors.muted, borderRadius: colors.radius, marginHorizontal: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
        <Text style={[styles.noteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('aiToolsNote')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, marginBottom: 8 },
  aiBadge: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  aiBadgeText: { fontSize: 12 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  list: { padding: 20, gap: 12 },
  card: { alignItems: 'center', padding: 18, borderWidth: 1, gap: 14 },
  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10 },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  note: { alignItems: 'flex-start', gap: 8, padding: 14, marginBottom: 20 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
