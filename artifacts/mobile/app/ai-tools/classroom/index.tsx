import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { buildBuilderRoute } from './classroomRouting';

const ACCENT = '#4F46E5';

type FilterKey = 'all' | 'quick' | 'team' | 'solo';

interface ActivityCard {
  id: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  difficulty: string;
  groupType: string;
  duration: string;
  durationMin: number; // for Quick filter
  isTeam: boolean;
  isSolo: boolean;
  isNew: boolean;
  isFeatured: boolean;
  accentColor: string;
}

const ACTIVITY_CARDS: ActivityCard[] = [
  {
    id: 'escape-challenge', emoji: '🔐',
    titleKey: 'activityEscapeTitle', descKey: 'activityEscapeDesc',
    difficulty: 'Easy–Advanced', groupType: 'Groups', duration: '10–30 min',
    durationMin: 30, isTeam: true, isSolo: false, isNew: false, isFeatured: true,
    accentColor: ACCENT,
  },
  {
    id: 'error-detective', emoji: '🔍',
    titleKey: 'activityErrorTitle', descKey: 'activityErrorDesc',
    difficulty: 'Medium', groupType: 'Pairs', duration: '15–25 min',
    durationMin: 25, isTeam: true, isSolo: false, isNew: true, isFeatured: false,
    accentColor: '#E67E22',
  },
  {
    id: 'exit-ticket', emoji: '🎫',
    titleKey: 'activityExitTitle', descKey: 'activityExitDesc',
    difficulty: 'Easy', groupType: 'Individual', duration: '5–10 min',
    durationMin: 10, isTeam: false, isSolo: true, isNew: true, isFeatured: false,
    accentColor: '#10B981',
  },
  {
    id: 'bingo', emoji: '🎱',
    titleKey: 'activityBingoTitle', descKey: 'activityBingoDesc',
    difficulty: 'Easy–Medium', groupType: 'Whole Class', duration: '15–25 min',
    durationMin: 25, isTeam: true, isSolo: false, isNew: false, isFeatured: false,
    accentColor: '#A855F7',
  },
  {
    id: 'relay', emoji: '🏃',
    titleKey: 'activityRelayTitle', descKey: 'activityRelayDesc',
    difficulty: 'Medium–Advanced', groupType: 'Teams', duration: '20–35 min',
    durationMin: 35, isTeam: true, isSolo: false, isNew: false, isFeatured: false,
    accentColor: '#F43F5E',
  },
  {
    id: 'gallery-walk', emoji: '🖼️',
    titleKey: 'activityGalleryTitle', descKey: 'activityGalleryDesc',
    difficulty: 'Medium', groupType: 'Groups', duration: '20–30 min',
    durationMin: 30, isTeam: true, isSolo: false, isNew: true, isFeatured: false,
    accentColor: '#0EA5E9',
  },
];

const FILTERS: Array<{ key: FilterKey; labelKey: string }> = [
  { key: 'all',   labelKey: 'marketplaceAll' },
  { key: 'quick', labelKey: 'marketplaceQuick' },
  { key: 'team',  labelKey: 'marketplaceTeam' },
  { key: 'solo',  labelKey: 'marketplaceIndividual' },
];
export default function ClassroomHubScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const topPad  = insets.top + (insets.top === 0 ? 67 : 0);
  const params  = useLocalSearchParams<{ noActivity?: string }>();

  const [query,  setQuery]  = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  useFocusEffect(
    useCallback(() => {
      if (params.noActivity === '1') {
        Alert.alert('', t('buildActivityFirst' as any));
        router.setParams({ noActivity: undefined } as any);
      }
    }, [params.noActivity]),
  );

  const handleSelect = (card: ActivityCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(buildBuilderRoute(card) as any);
  };

  const featured = ACTIVITY_CARDS.find(c => c.isFeatured)!;

  const filtered = useMemo(() => {
    let list = ACTIVITY_CARDS.filter(c => !c.isFeatured);
    if (filter === 'quick') list = list.filter(c => c.durationMin <= 15);
    if (filter === 'team')  list = list.filter(c => c.isTeam);
    if (filter === 'solo')  list = list.filter(c => c.isSolo);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c =>
        t(c.titleKey as any).toLowerCase().includes(q) ||
        t(c.descKey as any).toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, query, lang]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 8 }]}>
            <Ionicons name="storefront-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.headerBadge, { fontFamily: 'Inter_500Medium' }]}>{t('classroomBadge')}</Text>
          </View>
          <Text style={[styles.headerTitle, { fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {lang === 'ar' ? 'متجر الأنشطة' : 'Activity Marketplace'}
          </Text>
          <Text style={[styles.headerSub, { fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {lang === 'ar' ? '6 أنشطة تفاعلية — اختر وأطلق في ثوانٍ' : '6 interactive activities — pick one and launch in seconds'}
          </Text>

          {/* Search */}
          <View style={[styles.searchBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={[styles.searchInput, { fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={t('marketplaceSearch' as any)}
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Filter chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => { setFilter(f.key); Haptics.selectionAsync(); }}
                style={[styles.chip, { backgroundColor: active ? ACCENT : colors.muted, borderColor: active ? ACCENT : colors.border }]}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.mutedForeground, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                  {t(f.labelKey as any)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Featured Activity ── */}
        {filter === 'all' && !query.trim() && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_700Bold' }]}>
                {t('marketplaceFeatured' as any)}
              </Text>
            </View>
            <Pressable
              onPress={() => handleSelect(featured)}
              style={({ pressed }) => [
                styles.featuredCard,
                { backgroundColor: featured.accentColor, borderRadius: colors.radius, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <View style={[styles.featuredTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={styles.featuredEmoji}>{featured.emoji}</Text>
                <View style={{ flex: 1, marginHorizontal: 16 }}>
                  <Text style={[styles.featuredTitle, { fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t(featured.titleKey as any)}
                  </Text>
                  <Text style={[styles.featuredDesc, { fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t(featured.descKey as any)}
                  </Text>
                </View>
                <View style={styles.featuredArrow}>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#fff" />
                </View>
              </View>
              <View style={[styles.featuredMeta, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: 'rgba(255,255,255,0.2)' }]}>
                <FeaturedPill icon="time-outline"       label={featured.duration} />
                <FeaturedPill icon="people-outline"     label={featured.groupType} />
                <FeaturedPill icon="speedometer-outline" label={featured.difficulty} />
              </View>
            </Pressable>
          </View>
        )}

        {/* ── All Activities ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.foreground, fontFamily: 'Inter_700Bold', marginBottom: 12 }]}>
            {filter === 'all' && !query.trim()
              ? t('marketplaceActivities' as any)
              : `${filtered.length} ${lang === 'ar' ? 'نشاط' : filtered.length === 1 ? 'activity' : 'activities'}`}
          </Text>

          {filtered.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={{ fontSize: 32 }}>🔍</Text>
              <Text style={[{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center' }]}>
                {lang === 'ar' ? 'لا توجد أنشطة تطابق بحثك' : 'No activities match your search'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map(card => (
                <Pressable
                  key={card.id}
                  onPress={() => handleSelect(card)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {/* New badge */}
                  {card.isNew && (
                    <View style={[styles.newBadge, { backgroundColor: card.accentColor }]}>
                      <Text style={[styles.newBadgeText, { fontFamily: 'Inter_600SemiBold' }]}>
                        {t('marketplaceNew' as any)}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.iconBadge, { backgroundColor: card.accentColor + '18' }]}>
                      <Text style={{ fontSize: 26 }}>{card.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 14 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                        {t(card.titleKey as any)}
                      </Text>
                      <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                        {t(card.descKey as any)}
                      </Text>
                    </View>
                    <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={card.accentColor} style={{ alignSelf: 'center' }} />
                  </View>

                  <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: colors.border }]}>
                    <MetaPill icon="time-outline"       label={card.duration}     color={card.accentColor} />
                    <MetaPill icon="people-outline"     label={card.groupType}    color={card.accentColor} />
                    <MetaPill icon="speedometer-outline" label={card.difficulty}  color={card.accentColor} />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MetaPill({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.metaPillText, { color, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
    </View>
  );
}

function FeaturedPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color="rgba(255,255,255,0.8)" />
      <Text style={[styles.metaPillText, { color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter_500Medium' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:        { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn:       { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerBadge:   { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  headerTitle:   { fontSize: 26, color: '#fff', marginBottom: 6 },
  headerSub:     { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18, marginBottom: 16 },
  searchBar:     { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  searchInput:   { flex: 1, fontSize: 14, color: '#fff', padding: 0 },
  filterRow:     { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  chip:          { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText:      { fontSize: 13 },
  section:       { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionLabel:  { fontSize: 15 },
  // Featured
  featuredCard:  { overflow: 'hidden' },
  featuredTop:   { alignItems: 'center', padding: 20, paddingBottom: 16 },
  featuredEmoji: { fontSize: 44, flexShrink: 0 },
  featuredTitle: { fontSize: 20, color: '#fff', marginBottom: 6 },
  featuredDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  featuredArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 18, flexShrink: 0 },
  featuredMeta:  { borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12, gap: 18 },
  // Cards
  card:          { borderWidth: 1, overflow: 'hidden' },
  cardTop:       { alignItems: 'flex-start', padding: 16, paddingBottom: 12 },
  iconBadge:     { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:     { fontSize: 16, marginBottom: 4 },
  cardDesc:      { fontSize: 13, lineHeight: 18 },
  metaRow:       { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 16 },
  metaPill:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaPillText:  { fontSize: 11 },
  newBadge:      { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, zIndex: 1 },
  newBadgeText:  { fontSize: 10, color: '#fff' },
  empty:         { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, borderWidth: 1 },
});
