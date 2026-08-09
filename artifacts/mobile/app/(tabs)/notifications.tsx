import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { MOCK_NOTIFICATIONS } from '@/services/curriculumData';

const TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  info: { icon: 'information-circle', color: '#3B82F6' },
  success: { icon: 'checkmark-circle', color: '#10B981' },
  warning: { icon: 'warning', color: '#F59E0B' },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);
  const unreadCount = items.filter(n => !n.read).length;

  const markAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
              {t('notificationsTitle')}
            </Text>
            {unreadCount > 0 && (
              <Text style={[styles.unreadCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                {t('unread', unreadCount)}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} style={[styles.markAllBtn, { backgroundColor: colors.secondary, borderRadius: 20 }]}>
              <Text style={[styles.markAllText, { color: colors.primary, fontFamily: 'Cairo_500Medium' }]}>{t('markAllRead')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('noNotifications')}
            </Text>
          </View>
        }
        renderItem={({ item: n }) => {
          const { icon, color } = TYPE_ICONS[n.type] ?? TYPE_ICONS.info;
          // Show Arabic or English content based on lang
          // MOCK_NOTIFICATIONS stores Arabic in title/body, English in titleEn/bodyEn
          const title = lang === 'ar' ? n.title : (n.titleEn || n.title);
          const body = lang === 'ar' ? n.body : (n.bodyEn || n.body);
          return (
            <Pressable
              onPress={() => markRead(n.id)}
              style={[
                styles.notifCard,
                {
                  backgroundColor: n.read ? colors.card : colors.secondary,
                  borderColor: n.read ? colors.border : colors.primary + '33',
                  borderRadius: colors.radius,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: color + '20', borderRadius: 22 }]}>
                <Ionicons name={icon} size={20} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, { color: colors.foreground, fontFamily: n.read ? 'Cairo_500Medium' : 'Cairo_600SemiBold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {title}
                </Text>
                <Text style={[styles.notifBody, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                  {body}
                </Text>
                <Text style={[styles.notifTime, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }]}>{n.time}</Text>
              </View>
              {!n.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerRow: { justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28 },
  unreadCount: { fontSize: 13, marginTop: 2 },
  markAllBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  markAllText: { fontSize: 13 },
  notifCard: { padding: 14, gap: 12, borderWidth: 1, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle: { fontSize: 14, marginBottom: 3 },
  notifBody: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  notifTime: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
});
