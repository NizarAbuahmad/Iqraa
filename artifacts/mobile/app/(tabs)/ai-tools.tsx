import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  badge?: string;
}

const TOOLS: Tool[] = [
  {
    id: 'lesson-plan',
    title: 'Lesson Plan',
    description: 'Generate a complete, structured lesson plan with objectives, activities, and assessment strategies.',
    icon: 'document-text-outline',
    color: '#1B6B62',
    route: '/ai-tools/lesson-plan',
    badge: 'Popular',
  },
  {
    id: 'worksheet',
    title: 'Worksheet',
    description: 'Create differentiated worksheets with multiple question types for any topic or grade.',
    icon: 'list-outline',
    color: '#8B5CF6',
    route: '/ai-tools/worksheet',
  },
  {
    id: 'quiz',
    title: 'Quiz',
    description: 'Build auto-graded quizzes with multiple choice, true/false, and short answer questions.',
    icon: 'help-circle-outline',
    color: '#F59E0B',
    route: '/ai-tools/quiz',
    badge: 'New',
  },
  {
    id: 'homework',
    title: 'Homework',
    description: 'Design meaningful homework assignments that reinforce classroom learning.',
    icon: 'home-outline',
    color: '#3B82F6',
    route: '/ai-tools/lesson-plan',
  },
  {
    id: 'exam',
    title: 'Exam Paper',
    description: 'Generate complete exam papers aligned with Jordanian curriculum standards.',
    icon: 'school-outline',
    color: '#EF4444',
    route: '/ai-tools/lesson-plan',
  },
  {
    id: 'parent-msg',
    title: 'Parent Message',
    description: 'Draft professional parent communication in Arabic or English in seconds.',
    icon: 'chatbubble-outline',
    color: '#10B981',
    route: '/ai-tools/lesson-plan',
  },
];

function ToolCard({ tool }: { tool: Tool }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(tool.route as any);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: tool.color + '1A', borderRadius: 14 }]}>
        <Ionicons name={tool.icon} size={28} color={tool.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            {tool.title}
          </Text>
          {tool.badge && (
            <View style={[styles.badge, { backgroundColor: tool.color + '22' }]}>
              <Text style={[styles.badgeText, { color: tool.color, fontFamily: 'Inter_600SemiBold' }]}>{tool.badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]} numberOfLines={2}>
          {tool.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function AIToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>AI Tools</Text>
        <View style={[styles.aiBadge, { backgroundColor: colors.primary + '18', borderRadius: 20 }]}>
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={[styles.aiBadgeText, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            Powered by AI
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          Generate teaching materials tailored to the Jordanian curriculum in seconds.
        </Text>
      </View>

      <View style={styles.list}>
        {TOOLS.map(t => <ToolCard key={t.id} tool={t} />)}
      </View>

      <View style={[styles.note, { backgroundColor: colors.muted, borderRadius: colors.radius, marginHorizontal: 20 }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
        <Text style={[styles.noteText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
          AI generation currently uses sample outputs. Full AI integration with curriculum intelligence is coming in Stage 3.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  title: { fontSize: 28, marginBottom: 8 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginBottom: 10 },
  aiBadgeText: { fontSize: 12 },
  subtitle: { fontSize: 13, lineHeight: 20 },
  list: { padding: 20, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1, gap: 14 },
  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10 },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, marginBottom: 20 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
