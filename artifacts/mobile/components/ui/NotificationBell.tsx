import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { badgeLabel, useUnreadMessages } from '@/services/unreadMessages';

/** Bell with an unread-message count; opens the messages inbox. */
export function NotificationBell({ size = 22 }: { size?: number }) {
  const colors = useColors();
  const { t } = useLanguage();
  const unread = useUnreadMessages();
  const label = badgeLabel(unread);

  return (
    <Pressable
      onPress={() => router.push('/notifications' as never)}
      hitSlop={8}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${t('tabAlerts')}: ${t('unread', unread)}` : t('tabAlerts')}
    >
      <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={size} color={unread > 0 ? colors.primary : colors.foreground} />
      {label ? (
        <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 3,
    end: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: 'Cairo_700Bold', lineHeight: 14 },
});
