import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export function WebSidebar({ entries, isIOS }: { entries: TabEntry[]; isIOS: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: SIDEBAR_WIDTH,
          backgroundColor: colors.background,
          borderRightColor: colors.border,
          paddingTop: insets.top + 16,
        },
      ]}
    >
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
