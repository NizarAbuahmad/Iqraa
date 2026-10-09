import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { badgeLabel, setUnreadMessages, useUnreadMessages } from '@/services/unreadMessages';
import { listThreads, markAllThreadsRead, type ChatThreadSummary } from '@/services/messaging';
import { relativeTime } from '@/services/relativeTime';
import { Avatar } from '@/components/ui/Avatar';

const PANEL_WIDTH = 360;

/**
 * Bell with an unread-message count. Opens a panel of the unread
 * conversations in place — it used to jump straight to the inbox, which read
 * as "the bell takes me to chat" rather than "show me what is new".
 */
export function NotificationBell({ size = 22 }: { size?: number }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const unread = useUnreadMessages();
  const label = badgeLabel(unread);
  const { width: winW } = useWindowDimensions();
  const btnRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);

  const panelW = Math.min(PANEL_WIDTH, winW - 16);
  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';

  const open = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      const left = Math.max(8, Math.min(x + w / 2 - panelW / 2, winW - panelW - 8));
      setAnchor({ top: y + h + 6, left });
    });
    setThreads(null);
    setFailed(false);
    setMarkFailed(false);
    listThreads()
      .then(list => {
        setThreads(list.filter(th => th.unreadCount > 0));
        setUnreadMessages(list.reduce((sum, th) => sum + th.unreadCount, 0));
      })
      .catch(() => setFailed(true));
  };

  const markAllRead = () => {
    setMarking(true);
    setMarkFailed(false);
    markAllThreadsRead()
      .then(() => {
        setThreads([]);
        setUnreadMessages(0);
      })
      .catch(() => setMarkFailed(true))
      .finally(() => setMarking(false));
  };

  const close = () => setAnchor(null);
  const go = (href: string) => {
    close();
    router.push(href as never);
  };

  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={open}
        hitSlop={8}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `${t('bellTitle')}: ${t('unread', unread)}` : t('bellTitle')}
      >
        <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={size} color={unread > 0 ? colors.primary : colors.foreground} />
        {label ? (
          <View style={[styles.badge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.badgeText}>{label}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={anchor !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('cancel')} />
        {anchor ? (
          <View
            style={[
              styles.panel,
              { top: anchor.top, left: anchor.left, width: panelW, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <View style={[styles.header, { flexDirection: row }]}>
              <Text style={[styles.title, { color: colors.foreground, textAlign: align }]}>{t('bellTitle')}</Text>
              {threads && threads.length > 0 ? (
                <Pressable onPress={markAllRead} disabled={marking} hitSlop={8} accessibilityRole="button">
                  {marking ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.markAll, { color: colors.primary }]}>{t('markAllRead')}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            {markFailed ? (
              <Text style={[styles.markError, { color: colors.destructive, textAlign: align }]}>{t('bellMarkFailed')}</Text>
            ) : null}

            {failed ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t('messagingLoadError')}</Text>
            ) : threads === null ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
            ) : threads.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>{t('bellEmpty')}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {threads.map(th => {
                  const other = th.otherParticipant;
                  const isGroup = th.type !== 'direct';
                  const name = isGroup ? (lang === 'ar' ? th.titleAr : th.title) || th.title : other ? `${other.firstName} ${other.lastName}` : '';
                  const msg = th.lastMessage;
                  const preview = msg ? (msg.senderName ? `${msg.senderName}: ${msg.body}` : msg.body) : '';
                  return (
                    <Pressable
                      key={th.id}
                      onPress={() => go(`/messaging/${th.id}`)}
                      accessibilityRole="button"
                      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                        styles.item,
                        { flexDirection: row, backgroundColor: hovered || pressed ? colors.secondary : 'transparent' },
                      ]}
                    >
                      {isGroup ? (
                        <View style={[styles.groupIcon, { backgroundColor: colors.secondary }]}>
                          <Ionicons name="people" size={18} color={colors.primary} />
                        </View>
                      ) : (
                        <Avatar firstName={other?.firstName ?? '?'} lastName={other?.lastName} size={36} colors={colors} />
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Text style={[styles.name, { color: colors.foreground, textAlign: align }]} numberOfLines={1}>{name}</Text>
                          <Text style={[styles.time, { color: colors.mutedForeground }]}>{relativeTime(th.updatedAt, lang)}</Text>
                        </View>
                        <Text style={[styles.preview, { color: colors.mutedForeground, textAlign: align }]} numberOfLines={1}>{preview}</Text>
                      </View>
                      <View style={[styles.count, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{badgeLabel(th.unreadCount)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable onPress={() => go('/notifications')} accessibilityRole="button" style={[styles.footer, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.primary }]}>{t('bellViewAll')}</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </>
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
  badgeText: { color: '#fff', fontSize: 10, fontFamily: 'ReadexPro_700Bold', lineHeight: 14 },
  panel: {
    position: 'absolute',
    borderWidth: 1,
    paddingTop: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  header: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  title: { fontSize: 16, fontFamily: 'ReadexPro_600SemiBold' },
  markAll: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  markError: { fontSize: 12, fontFamily: 'Almarai_400Regular', paddingHorizontal: 14, paddingBottom: 6 },
  empty: { fontSize: 14, fontFamily: 'Almarai_400Regular', textAlign: 'center', paddingVertical: 20, paddingHorizontal: 14 },
  item: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  groupIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 14, fontFamily: 'ReadexPro_600SemiBold' },
  time: { fontSize: 11, fontFamily: 'Almarai_400Regular', marginStart: 6 },
  preview: { fontSize: 13, fontFamily: 'Almarai_400Regular', marginTop: 2 },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1, paddingVertical: 12, alignItems: 'center' },
  footerText: { fontSize: 14, fontFamily: 'ReadexPro_600SemiBold' },
});
