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
import { useLanguage } from '@/context/LanguageContext';

const TYPE_COLORS: Record<string, string> = {
  'Lesson Plan': '#1B6B62',
  'خطة الدرس': '#1B6B62',
  'Worksheet': '#8B5CF6',
  'ورقة العمل': '#8B5CF6',
  'Quiz': '#F59E0B',
  'اختبار': '#F59E0B',
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  const firstName = user?.name?.split(' ')[0] ?? t('teacher');

  const QUICK_ACTIONS = [
    { id: 'lesson-plan', labelKey: 'lessonPlan' as const, icon: 'document-text-outline' as const, color: '#1B6B62', route: '/ai-tools/lesson-plan' },
    { id: 'worksheet',   labelKey: 'worksheet'   as const, icon: 'list-outline'          as const, color: '#8B5CF6', route: '/ai-tools/worksheet' },
    { id: 'quiz',        labelKey: 'quiz'         as const, icon: 'help-circle-outline'   as const, color: '#F59E0B', route: '/ai-tools/quiz' },
    { id: 'curriculum',  labelKey: 'curriculum'   as const, icon: 'library-outline'       as const, color: '#10B981', route: '/(tabs)/curriculum' },
  ];

  const RECENT_MATERIALS = isRTL
    ? [
        { id: '1', title: 'خطة درس: الروابط الكيميائية', type: 'خطة الدرس', subject: 'الكيمياء', grade: 'الصف العاشر', time: 'منذ ساعتين' },
        { id: '2', title: 'ورقة عمل: كثيرات الحدود', type: 'ورقة العمل', subject: 'الرياضيات', grade: 'الصف العاشر', time: 'منذ يوم' },
        { id: '3', title: 'اختبار: الاحتمال', type: 'اختبار', subject: 'الرياضيات', grade: 'الصف العاشر', time: 'منذ يومين' },
      ]
    : [
        { id: '1', title: 'Chemical Bonding Lesson Plan', type: 'Lesson Plan', subject: 'Chemistry', grade: 'Grade 10', time: '2h ago' },
        { id: '2', title: 'Polynomial Functions Worksheet', type: 'Worksheet', subject: 'Mathematics', grade: 'Grade 10', time: '1d ago' },
        { id: '3', title: 'Probability Quiz', type: 'Quiz', subject: 'Mathematics', grade: 'Grade 10', time: '2d ago' },
      ];

  const STATS = [
    { label: isRTL ? 'موادي' : 'Materials', value: '12', icon: 'document-text-outline' as const, color: colors.primary },
    { label: isRTL ? 'دروس الأسبوع' : 'This week', value: '8',  icon: 'calendar-outline'  as const, color: colors.accent },
    { label: isRTL ? 'المواد'   : 'Subjects',  value: (user?.subjects?.length ?? 2).toString(), icon: 'library-outline'   as const, color: '#8B5CF6' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.headerTop, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
              {greeting}
            </Text>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {firstName} 👋
            </Text>
          </View>
          {/* iQra quick-chat button */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/iqra'); }}
            style={({ pressed }) => [styles.iqraBtn, { backgroundColor: colors.primary, borderRadius: 20, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.primaryForeground} />
            <Text style={[styles.iqraBtnText, { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold' }]}>
              {t('tabIqra')}
            </Text>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {STATS.map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: colors.muted, borderRadius: 14 }]}>
              <Ionicons name={s.icon} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ─── Quick Actions ─────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quickActions')}
        </Text>
        <View style={[styles.actionsGrid, isRTL && { flexDirection: 'row-reverse' }]}>
          {QUICK_ACTIONS.map(a => (
            <Pressable
              key={a.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(a.route as any); }}
              style={({ pressed }) => [styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '18', borderRadius: 14 }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: 'center' }]}>
                {t(a.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── Recent Materials ──────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
          {t('recentMaterials')}
        </Text>
        <View style={{ gap: 10 }}>
          {RECENT_MATERIALS.map(m => {
            const typeColor = TYPE_COLORS[m.type] ?? colors.primary;
            return (
              <Pressable
                key={m.id}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                style={({ pressed }) => [styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.materialIcon, { backgroundColor: typeColor + '18', borderRadius: 12 }]}>
                  <Ionicons name="document-text-outline" size={20} color={typeColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.materialTitle, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <View style={[styles.materialMeta, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.typePill, { backgroundColor: typeColor + '18', borderRadius: 8 }]}>
                      <Text style={[styles.typeText, { color: typeColor, fontFamily: 'Inter_500Medium' }]}>{m.type}</Text>
                    </View>
                    <Text style={[styles.gradeText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.grade}</Text>
                    <Text style={[styles.timeText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.time}</Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ─── Knowledge Base Banner ─────────────────────────────── */}
      <View style={[styles.section]}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/iqra'); }}
          style={({ pressed }) => [styles.kbBanner, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={[styles.kbBannerContent, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.kbIcon, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14 }]}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kbTitle, { color: '#fff', fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL ? 'اسأل إقرأ الآن' : 'Ask iQra Now'}
              </Text>
              <Text style={[styles.kbSub, { color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL
                  ? 'كيمياء ورياضيات الصف العاشر — إجابات من الكتاب مباشرة'
                  : 'Grade 10 Chemistry & Math — answers straight from the book'}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="rgba(255,255,255,0.8)" />
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  greeting: { fontSize: 13, marginBottom: 2 },
  name: { fontSize: 24 },
  iqraBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  iqraBtnText: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, alignItems: 'center', padding: 14, gap: 4 },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 11 },
  section: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  sectionTitle: { fontSize: 17 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { width: '47%', padding: 18, borderWidth: 1, alignItems: 'center', gap: 10 },
  actionIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13 },
  materialCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, gap: 12 },
  materialIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  materialTitle: { fontSize: 14, marginBottom: 4 },
  materialMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 11 },
  gradeText: { fontSize: 11 },
  timeText: { fontSize: 11 },
  kbBanner: { padding: 18 },
  kbBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  kbIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kbTitle: { fontSize: 16, marginBottom: 3 },
  kbSub: { fontSize: 12, lineHeight: 18 },
});
