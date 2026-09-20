import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IqraaMark } from '@/components/ui/IqraaMark';
import type { TabEntry } from '@/app/(tabs)/_layout';

const SIDEBAR_WIDTH = 240;

function SidebarRow({ entry, isIOS, active }: { entry: TabEntry; isIOS: boolean; active: boolean }) {
  const colors = useColors();
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={() => router.push(`/${entry.name === 'index' ? '' : entry.name}` as never)}
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
          { color: active ? colors.primary : colors.foreground, fontFamily: active ? 'Cairo_600SemiBold' : 'Cairo_500Medium' },
        ]}
      >
        {t(entry.titleKey)}
      </Text>
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
  const { t } = useLanguage();

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
          borderRightColor: colors.border,
          paddingTop: insets.top + 16,
        },
      ]}
    >
      {lessonCard}
      {/*
        The brand lives here on desktop, not over the thread. Every screen got
        its own centred logo band, which cost ~110px at the top of a window
        that already had a permanent nav rail to carry identity.
      */}
      <View style={styles.brand}>
        <IqraaMark size={30} tone="brand" />
        <Text style={[styles.brandWord, { color: colors.foreground }]}>{t('appName')}</Text>
      </View>
      {entries
        .filter((entry) => entry.visible)
        .map((entry) => (
          <SidebarRow key={entry.name} entry={entry} isIOS={isIOS} active={pathname.startsWith(`/${entry.name}`)} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: 1,
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
  brandWord: { fontFamily: 'Cairo_700Bold', fontSize: 19, letterSpacing: 0.2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: {
    fontSize: 15,
  },
});
