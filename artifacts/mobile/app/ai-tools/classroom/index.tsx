import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

const ACCENT = '#4F46E5';

interface ActivityCard {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  titleKey: string;
  descKey: string;
  available: boolean;
  difficulty: string;
  groupType: string;
  duration: string;
}

const ACTIVITY_CARDS: ActivityCard[] = [
  {
    id: 'escape-challenge',
    icon: 'lock-closed-outline',
    emoji: '🔐',
    titleKey: 'activityEscapeTitle',
    descKey: 'activityEscapeDesc',
    available: true,
    difficulty: 'Easy–Advanced',
    groupType: 'Groups',
    duration: '10–30 min',
  },
  {
    id: 'bingo',
    icon: 'grid-outline',
    emoji: '🎱',
    titleKey: 'activityBingoTitle',
    descKey: '',
    available: false,
    difficulty: '',
    groupType: '',
    duration: '',
  },
  {
    id: 'relay',
    icon: 'swap-horizontal-outline',
    emoji: '🏃',
    titleKey: 'activityRelayTitle',
    descKey: '',
    available: false,
    difficulty: '',
    groupType: '',
    duration: '',
  },
  {
    id: 'exit-ticket',
    icon: 'exit-outline',
    emoji: '🎫',
    titleKey: 'activityExitTitle',
    descKey: '',
    available: false,
    difficulty: '',
    groupType: '',
    duration: '',
  },
];

export default function ClassroomHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const topPad = insets.top + (insets.top === 0 ? 67 : 0);

  const handleSelect = (card: ActivityCard) => {
    if (!card.available) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/ai-tools/classroom/builder',
      params: { activityType: card.id },
    } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <View style={[styles.headerBadgeRow, { flexDirection: isRTL ? 'row-reverse' : 'row', alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name="tv-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={[styles.headerBadge, { fontFamily: 'Inter_500Medium' }]}>{t('classroomBadge')}</Text>
          </View>
          <Text style={[styles.headerTitle, { fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('classroomHubTitle')}
          </Text>
          <Text style={[styles.headerSub, { fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('classroomHubDesc')}
          </Text>
        </View>

        {/* Activity Cards */}
        <View style={styles.cardList}>
          {ACTIVITY_CARDS.map(card => (
            <Pressable
              key={card.id}
              onPress={() => handleSelect(card)}
              disabled={!card.available}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: card.available ? ACCENT + '40' : colors.border,
                  borderRadius: colors.radius,
                  opacity: !card.available ? 0.55 : pressed ? 0.88 : 1,
                },
              ]}
            >
              {/* Coming soon ribbon */}
              {!card.available && (
                <View style={[styles.ribbon, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.ribbonText, { color: colors.mutedForeground, fontFamily: 'Inter_500Medium' }]}>
                    {t('activityComingSoon')}
                  </Text>
                </View>
              )}

              <View style={[styles.cardTop, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {/* Icon badge */}
                <View style={[styles.iconBadge, { backgroundColor: card.available ? ACCENT + '15' : colors.muted }]}>
                  <Text style={{ fontSize: 28 }}>{card.emoji}</Text>
                </View>

                <View style={{ flex: 1, marginHorizontal: 14 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                    {t(card.titleKey as any)}
                  </Text>
                  {card.available && card.descKey ? (
                    <Text style={[styles.cardDesc, { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>
                      {t(card.descKey as any)}
                    </Text>
                  ) : null}
                </View>

                {card.available && (
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={ACCENT} style={{ alignSelf: 'center' }} />
                )}
              </View>

              {/* Meta pills */}
              {card.available && (
                <View style={[styles.metaRow, { flexDirection: isRTL ? 'row-reverse' : 'row', borderTopColor: colors.border }]}>
                  <MetaPill icon="time-outline" label={card.duration} />
                  <MetaPill icon="people-outline" label={card.groupType} />
                  <MetaPill icon="speedometer-outline" label={card.difficulty} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={ACCENT} />
      <Text style={[styles.metaPillText, { color: ACCENT, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 30 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  headerBadgeRow: { alignItems: 'center', gap: 6, marginBottom: 8 },
  headerBadge: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  headerTitle: { fontSize: 26, color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },
  cardList: { padding: 16, gap: 14 },
  card: { borderWidth: 1.5, overflow: 'hidden' },
  cardTop: { alignItems: 'flex-start', padding: 18, paddingBottom: 14 },
  iconBadge: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: 17, marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  metaRow: { borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', gap: 16 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaPillText: { fontSize: 12 },
  ribbon: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, zIndex: 1 },
  ribbonText: { fontSize: 11 },
});
