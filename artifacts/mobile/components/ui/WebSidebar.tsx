import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { IqraaMark } from '@/components/ui/IqraaMark';
import { isTabActive, tabHref } from '@/services/tabRoute';
import type { TabEntry } from '@/app/(tabs)/_layout';

const SIDEBAR_WIDTH = 240;

function SidebarRow({ entry, isIOS, active }: { entry: TabEntry; isIOS: boolean; active: boolean }) {
  const colors = useColors();
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(tabHref(entry.name) as never)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.row,
        {
          backgroundColor: active ? colors.primary + '1a' : hovered ? colors.muted : 'transparent',
          borderRadius: colors.radius,
        },
      ]}
    >
      {entry.icon({ color: active ? colors.primary : colors.mutedForeground, focused: active, isIOS })}
      <Text
        style={[
          styles.label,
          { color: active ? colors.primary : colors.foreground, fontFamily: active ? 'ReadexPro_600SemiBold' : 'ReadexPro_500Medium' },
        ]}
      >
        {t(entry.titleKey)}
      </Text>
      {entry.badge ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <Text style={styles.badgeText}>{entry.badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * «اقترح ميزة» — always visible at the foot of the rail on the website, so
 * a teacher with an idea does not have to know it lives under the profile tab.
 * Quieter than the nav rows above it: it is an invitation, not a destination.
 */
function SuggestFeatureLink({ active }: { active: boolean }) {
  const colors = useColors();
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const tint = active || hovered ? colors.primary : colors.mutedForeground;

  return (
    <Pressable
      onPress={() => router.push('/suggest-feature' as never)}
      accessibilityRole="link"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.suggest,
        {
          borderColor: active || hovered ? colors.primary + '55' : colors.border,
          backgroundColor: active ? colors.primary + '1a' : 'transparent',
          borderRadius: colors.radius,
        },
      ]}
    >
      <Ionicons name="bulb-outline" size={18} color={tint} />
      <Text style={[styles.suggestLabel, { color: tint }]}>{t('suggestFeature')}</Text>
    </Pressable>
  );
}

export function WebSidebar({
  entries,
  isIOS,
  lessonCard,
}: {
  entries: TabEntry[];
  isIOS: boolean;
  /** The teacher's current-lesson card, above the nav; null for roles with no lesson to switch. */
  lessonCard?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { t, isRTL } = useLanguage();

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: SIDEBAR_WIDTH,
          // White rail against the page's light-grey ground: on desktop the
          // brand and the nav read as chrome, and the thread beside them as
          // content. Both surfaces were the same grey before, so the window
          // was one flat sheet with a hairline down it.
          backgroundColor: colors.card,
          borderColor: colors.border,
          // The rail sits on the right in Arabic, so its seam is its left edge.
          ...(isRTL ? { borderLeftWidth: 1 } : { borderRightWidth: 1 }),
          paddingTop: insets.top + 16,
          paddingBottom: 16,
        },
      ]}
    >
      {/*
        The brand lives here on desktop, not over the thread. Every screen got
        its own centred logo band, which cost ~110px at the top of a window
        that already had a permanent nav rail to carry identity.
      */}
      <View style={styles.brand}>
        <IqraaMark size={30} tone="brand" />
        <Text style={[styles.brandWord, { color: colors.foreground, flex: 1 }]}>{t('appName')}</Text>
        <NotificationBell />
      </View>
      {entries
        .filter((entry) => entry.visible)
        .map((entry) => (
          <SidebarRow key={entry.name} entry={entry} isIOS={isIOS} active={isTabActive(pathname, entry.name)} />
        ))}
      {/* Brand and nav first, the lesson being prepared last: it is context, not navigation. */}
      <View style={styles.footer}>
        {lessonCard}
        <SuggestFeatureLink active={pathname === '/suggest-feature'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    paddingHorizontal: 12,
    gap: 4,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  footer: { marginTop: 'auto', gap: 10 },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  suggestLabel: { fontSize: 14, fontFamily: 'ReadexPro_500Medium', flex: 1 },
  brandWord: { fontFamily: 'ReadexPro_700Bold', fontSize: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
    flex: 1,
  },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'ReadexPro_700Bold', lineHeight: 15 },
});
