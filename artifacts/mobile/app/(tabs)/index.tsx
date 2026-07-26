import React, { useState } from 'react';
import {
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

const QUICK_ACTIONS = [
  { id: 'lesson-plan', label: 'Lesson Plan', icon: 'document-text-outline' as const, route: '/ai-tools/lesson-plan' },
  { id: 'worksheet', label: 'Worksheet', icon: 'list-outline' as const, route: '/ai-tools/worksheet' },
  { id: 'quiz', label: 'Quiz', icon: 'help-circle-outline' as const, route: '/ai-tools/quiz' },
  { id: 'curriculum', label: 'Curriculum', icon: 'library-outline' as const, route: '/(tabs)/curriculum' },
];

const RECENT_MATERIALS = [
  { id: '1', title: 'Quadratic Functions Lesson Plan', type: 'Lesson Plan', subject: 'Mathematics', grade: 'Grade 10', time: '2h ago' },
  { id: '2', title: 'States of Matter Worksheet', type: 'Worksheet', subject: 'Science', grade: 'Grade 8', time: '1d ago' },
  { id: '3', title: 'English Grammar Quiz', type: 'Quiz', subject: 'English', grade: 'Grade 9', time: '2d ago' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name: string) {
  return name.split(' ')[0];
}

const TYPE_COLORS: Record<string, string> = {
  'Lesson Plan': '#1B6B62',
  'Worksheet': '#8B5CF6',
  'Quiz': '#F59E0B',
  'Homework': '#3B82F6',
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.primaryForeground + 'CC', fontFamily: 'Inter_400Regular' }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.userName, { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }]}>
              {user ? getFirstName(user.name) : 'Teacher'} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/notifications')}
            style={[styles.notifBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primaryForeground} />
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Materials', value: '12' },
            { label: 'Lessons', value: '8' },
            { label: 'Grades', value: (user?.grades?.length ?? 0).toString() },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Text style={[styles.statValue, { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.primaryForeground + 'BB', fontFamily: 'Inter_400Regular' }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
          AI Quick Actions
        </Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(a => (
            <Pressable
              key={a.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as any); }}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={a.icon} size={24} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium' }]}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Profile notice if incomplete */}
        {user && user.subjects.length === 0 && (
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.noticeBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '55', borderRadius: colors.radius }]}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
            <Text style={[styles.noticeText, { color: colors.foreground, fontFamily: 'Inter_400Regular' }]}>
              Complete your profile to unlock personalized lesson plans
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* Recent Materials */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]}>
            Recent Materials
          </Text>
          <Pressable>
            <Text style={[{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>See all</Text>
          </Pressable>
        </View>

        {RECENT_MATERIALS.map(m => {
          const typeColor = TYPE_COLORS[m.type] ?? colors.primary;
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.materialCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.materialAccent, { backgroundColor: typeColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.materialTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={1}>
                  {m.title}
                </Text>
                <View style={styles.materialMeta}>
                  <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
                    <Text style={[styles.typeText, { color: typeColor, fontFamily: 'Inter_500Medium' }]}>{m.type}</Text>
                  </View>
                  <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>
                    {m.subject} · {m.grade}
                  </Text>
                </View>
              </View>
              <Text style={[styles.time, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.time}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, marginBottom: 2 },
  userName: { fontSize: 26 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 11, marginTop: 2 },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 24 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionCard: { width: '47%', padding: 18, borderWidth: 1, alignItems: 'center', gap: 10 },
  actionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, textAlign: 'center' },
  noticeBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1, marginBottom: 8 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  materialCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginBottom: 10, padding: 14, gap: 12, overflow: 'hidden' },
  materialAccent: { width: 4, height: '100%', borderRadius: 2, position: 'absolute', left: 0, top: 0, bottom: 0 },
  materialTitle: { fontSize: 14, marginBottom: 6, paddingLeft: 4 },
  materialMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 11 },
  metaText: { fontSize: 12 },
  time: { fontSize: 11 },
});
