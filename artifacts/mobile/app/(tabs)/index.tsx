import React, { useState } from 'react';
import {
  Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { SavedMaterial, getItems, getRecentItems, seedDemoData } from '@/services/workspace';

const TYPE_COLOR: Record<string, string> = {
  lesson: '#1B6B62',
  worksheet: '#8B5CF6',
  quiz: '#F59E0B',
};
const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  lesson: 'document-text-outline',
  worksheet: 'list-outline',
  quiz: 'help-circle-outline',
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, lang, isRTL } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [recentItems,    setRecentItems]    = useState<SavedMaterial[]>([]);
  const [favoriteItems,  setFavoriteItems]  = useState<SavedMaterial[]>([]);
  const [continueItem,   setContinueItem]   = useState<SavedMaterial | null>(null);
  const [seeding,        setSeeding]        = useState(false);

  const loadData = useCallback(async () => {
    const [recent, favs] = await Promise.all([
      getRecentItems(3),
      getItems({ favoritesFirst: true }),
    ]);
    setRecentItems(recent);
    setFavoriteItems(favs.filter(i => i.isFavorite).slice(0, 3));
    setContinueItem(recent[0] ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await new Promise(r => setTimeout(r, 400));
    setRefreshing(false);
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    await seedDemoData();
    await loadData();
    setSeeding(false);
    Alert.alert('', lang === 'ar' ? 'تم تحميل المحتوى التجريبي!' : 'Sample content loaded!');
  };

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  const firstName = user?.name?.split(' ')[0] ?? t('teacher');

  const QUICK_ACTIONS = [
    { id: 'lesson-plan', labelKey: 'lessonPlan'      as const, icon: 'document-text-outline' as const, color: '#1B6B62', route: '/ai-tools/lesson-plan' },
    { id: 'worksheet',   labelKey: 'worksheet'        as const, icon: 'list-outline'          as const, color: '#8B5CF6', route: '/ai-tools/worksheet' },
    { id: 'quiz',        labelKey: 'quiz'             as const, icon: 'help-circle-outline'   as const, color: '#F59E0B', route: '/ai-tools/quiz' },
    { id: 'activity',    labelKey: 'toolActivityTitle'   as const, icon: 'flash-outline'    as const, color: '#E67E22', route: '/ai-tools/activity' },
    { id: 'classroom',   labelKey: 'toolClassroomTitle' as const, icon: 'tv-outline'         as const, color: '#4F46E5', route: '/ai-tools/classroom' },
    { id: 'workspace',   labelKey: 'myWorkspace'        as const, icon: 'folder-outline'    as const, color: '#10B981', route: '/workspace' },
  ];

  const STATS = [
    { label: lang === 'ar' ? 'موادي' : 'Materials', value: String(recentItems.length > 0 ? recentItems.length : '—'), icon: 'document-text-outline' as const, color: colors.primary },
    { label: lang === 'ar' ? 'أدوات الذكاء' : 'AI Tools', value: '3', icon: 'sparkles-outline' as const, color: colors.accent },
    { label: lang === 'ar' ? 'المواد' : 'Subjects', value: (user?.subjects?.length ?? 2).toString(), icon: 'library-outline' as const, color: '#8B5CF6' },
  ];

  const typeLabel = (type: string) => {
    if (type === 'lesson') return lang === 'ar' ? 'خطة درس' : 'Lesson Plan';
    if (type === 'worksheet') return lang === 'ar' ? 'ورقة عمل' : 'Worksheet';
    return lang === 'ar' ? 'اختبار' : 'Quiz';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffH = Math.floor(diffMs / 3600000);
      const diffD = Math.floor(diffMs / 86400000);
      if (lang === 'ar') {
        if (diffH < 1) return 'منذ قليل';
        if (diffH < 24) return `منذ ${diffH} ساعة`;
        if (diffD < 7) return `منذ ${diffD} يوم`;
        return d.toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' });
      }
      if (diffH < 1) return 'Just now';
      if (diffH < 24) return `${diffH}h ago`;
      if (diffD < 7) return `${diffD}d ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

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

      {/* ─── Continue Working ──────────────────────────────────── */}
      {continueItem && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {lang === 'ar' ? 'استكمل العمل' : 'Continue Working'}
          </Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/workspace/view', params: { id: continueItem.id } }); }}
            style={({ pressed }) => [
              styles.continueCard,
              { backgroundColor: colors.card, borderColor: colors.primary + '50', borderRadius: colors.radius, opacity: pressed ? 0.85 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={[styles.continueIcon, { backgroundColor: (TYPE_COLOR[continueItem.type] ?? colors.primary) + '18', borderRadius: 14 }]}>
              <Ionicons name={TYPE_ICON[continueItem.type] ?? 'document-text-outline'} size={22} color={TYPE_COLOR[continueItem.type] ?? colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                {continueItem.title}
              </Text>
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }]}>
                {continueItem.grade} · {formatDate(continueItem.savedAt)}
              </Text>
            </View>
            <View style={[styles.continueCta, { backgroundColor: colors.primary, borderRadius: 10 }]}>
              <Text style={[{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 }]}>
                {lang === 'ar' ? 'افتح' : 'Open'}
              </Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* ─── My Favourites ─────────────────────────────────────── */}
      {favoriteItems.length > 0 && (
        <View style={styles.section}>
          <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }]}>
            <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }]}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', marginBottom: 0 }]}>
                {lang === 'ar' ? 'المفضلة' : 'Favourites'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/workspace')}>
              <Text style={[{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                {lang === 'ar' ? 'عرض الكل' : 'View all'}
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {favoriteItems.map(m => {
              const color = TYPE_COLOR[m.type] ?? colors.primary;
              const icon  = TYPE_ICON[m.type]  ?? 'document-text-outline';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/workspace/view', params: { id: m.id } }); }}
                  style={({ pressed }) => [styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.materialIcon, { backgroundColor: color + '18', borderRadius: 12 }]}>
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.materialTitle, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <View style={[styles.materialMeta, isRTL && { flexDirection: 'row-reverse' }]}>
                      <View style={[styles.typePill, { backgroundColor: color + '18', borderRadius: 8 }]}>
                        <Text style={[styles.typeText, { color, fontFamily: 'Inter_500Medium' }]}>{typeLabel(m.type)}</Text>
                      </View>
                      <Text style={[styles.gradeText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.grade}</Text>
                    </View>
                  </View>
                  <Ionicons name="star" size={16} color="#F59E0B" />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ─── Recent Materials ──────────────────────────────────── */}
      <View style={styles.section}>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Inter_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('recentMaterials')}
          </Text>
          {recentItems.length > 0 && (
            <Pressable onPress={() => router.push('/workspace')}>
              <Text style={[{ color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                {lang === 'ar' ? 'عرض الكل' : 'View all'}
              </Text>
            </Pressable>
          )}
        </View>

        {recentItems.length === 0 ? (
          /* Empty state */
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => router.push('/(tabs)/ai-tools')}
              style={({ pressed }) => [
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="folder-open-outline" size={32} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 20 }]}>
                {lang === 'ar' ? 'لا توجد مواد محفوظة بعد\nاضغط لإنشاء أول مادة' : 'No saved materials yet\nTap to create your first'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSeedDemo}
              disabled={seeding}
              style={({ pressed }) => [
                styles.seedBtn,
                { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed || seeding ? 0.7 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.mutedForeground} />
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }]}>
                {seeding ? (lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…') : (lang === 'ar' ? 'تحميل محتوى تجريبي' : 'Load sample content')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentItems.map(m => {
              const color = TYPE_COLOR[m.type] ?? colors.primary;
              const icon = TYPE_ICON[m.type] ?? 'document-text-outline';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/workspace/view', params: { id: m.id } });
                  }}
                  style={({ pressed }) => [styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.materialIcon, { backgroundColor: color + '18', borderRadius: 12 }]}>
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.materialTitle, { color: colors.foreground, fontFamily: 'Inter_500Medium', textAlign: isRTL ? 'right' : 'left' }]}
                      numberOfLines={1}
                    >
                      {m.title}
                    </Text>
                    <View style={[styles.materialMeta, isRTL && { flexDirection: 'row-reverse' }]}>
                      <View style={[styles.typePill, { backgroundColor: color + '18', borderRadius: 8 }]}>
                        <Text style={[styles.typeText, { color, fontFamily: 'Inter_500Medium' }]}>{typeLabel(m.type)}</Text>
                      </View>
                      <Text style={[styles.gradeText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{m.grade}</Text>
                      <Text style={[styles.timeText, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }]}>{formatDate(m.savedAt)}</Text>
                    </View>
                  </View>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </View>
        )}
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
  continueCard:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1.5, gap: 12 },
  continueIcon:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  continueCta:   { paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  seedBtn:       { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderWidth: 1, borderStyle: 'dashed' },
  emptyCard: { padding: 30, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', gap: 10 },
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
