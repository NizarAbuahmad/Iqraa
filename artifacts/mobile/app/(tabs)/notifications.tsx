/**
 * Chat inbox — every thread this account is part of.
 *
 * Was a mocked "Notifications" screen with no real data source (see
 * _layout.tsx's note on this tab). Person-to-person messaging is that real
 * source now: this renders services/messaging.ts's thread list instead.
 *
 * Loads on focus, not a live subscription — this app's existing convention
 * (see app/classes/index.tsx), and Phase 1 of messaging has no push/realtime
 * transport yet.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  MessagingError,
  getMyContacts,
  getTeacherContacts,
  listThreads,
  startThread,
  type ChatThreadSummary,
  type ChatRole,
} from '@/services/messaging';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';

const TEACHER_ROLES: ChatRole[] = ['teacher', 'school_admin', 'system_admin'];

interface Contact {
  userId: string;
  firstName: string;
  lastName: string;
  studentName: string;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { user } = useAuth();

  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  // Contacts are always shown when there are no threads yet (the natural
  // first-run state); once a thread exists — including an auto-created class
  // group, which a teacher never explicitly "starts" — this is the only way
  // back to that list, so it has to work even with threads already present.
  const [newChatOpen, setNewChatOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, myContacts] = await Promise.all([
        listThreads(),
        user && TEACHER_ROLES.includes(user.role)
          ? getTeacherContacts().then(byStudent =>
              byStudent.flatMap(s => s.contacts.map(c => ({ ...c, studentName: s.studentName }))),
            )
          : getMyContacts().then(rows =>
              rows.map(r => ({ userId: r.userId, firstName: r.firstName, lastName: r.lastName, studentName: r.studentName })),
            ),
      ]);
      setThreads(list);
      setContacts(myContacts);
      setError('');
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openContact = async (userId: string) => {
    setStartingUserId(userId);
    try {
      const thread = await startThread(userId);
      setNewChatOpen(false);
      router.push(`/messaging/${thread.id}`);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingSendError'));
    } finally {
      setStartingUserId(null);
    }
  };

  const contactsList = (onPick: (userId: string) => void) => (
    <FlatList
      data={contacts}
      keyExtractor={c => c.userId}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
        <View
          style={[
            styles.contactCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Avatar firstName={item.firstName} lastName={item.lastName} size={40} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.threadName, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </Text>
            <Text style={[styles.threadPreview, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]} numberOfLines={1}>
              {item.studentName}
            </Text>
          </View>
          <Pressable
            onPress={() => onPick(item.userId)}
            disabled={startingUserId === item.userId}
            style={[styles.messageBtn, { backgroundColor: colors.primary, borderRadius: 16 }]}
          >
            {startingUserId === item.userId ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontFamily: 'Cairo_500Medium', fontSize: 13 }}>
                {t('messagingStartConversation')}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    />
  );

  const topPad = insets.top + (insets.top === 0 ? 67 : 0);
  const unreadCount = threads.reduce((sum, th) => sum + th.unreadCount, 0);
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-end' }]}>
        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: align }]}>
            {t('notificationsTitle')}
          </Text>
          {unreadCount > 0 && (
            <Text style={[styles.unreadCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('unread', unreadCount)}
            </Text>
          )}
        </View>
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16, paddingBottom: 6 }]}>
          {user && TEACHER_ROLES.includes(user.role) && (
            <Pressable onPress={() => router.push('/messaging/new-group')} hitSlop={10}>
              <Ionicons name="people-circle-outline" size={26} color={colors.primary} />
            </Pressable>
          )}
          {contacts.length > 0 && (
            <Pressable onPress={() => setNewChatOpen(true)} hitSlop={10}>
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : threads.length > 0 ? (
        <FlatList
          data={threads}
          keyExtractor={th => th.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const other = item.otherParticipant;
            const isGroup = item.type !== 'direct';
            const name = isGroup ? (lang === 'ar' ? item.titleAr : item.title) || item.title : other ? `${other.firstName} ${other.lastName}` : '';
            const preview = item.lastMessage?.body ?? '';
            return (
              <Pressable
                onPress={() => router.push(`/messaging/${item.id}`)}
                style={[
                  styles.threadCard,
                  {
                    backgroundColor: item.unreadCount > 0 ? colors.secondary : colors.card,
                    borderColor: item.unreadCount > 0 ? colors.primary + '33' : colors.border,
                    borderRadius: colors.radius,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
              >
                {isGroup ? (
                  <View style={[styles.groupIcon, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                ) : (
                  <Avatar firstName={other?.firstName ?? '?'} lastName={other?.lastName} size={44} colors={colors} />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.threadName, { color: colors.foreground, fontFamily: item.unreadCount > 0 ? 'Cairo_600SemiBold' : 'Cairo_500Medium', textAlign: align }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <Text
                    style={[styles.threadPreview, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                </View>
                {item.unreadCount > 0 && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            );
          }}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('noNotifications')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('messagingEmptyDesc')}
            </Text>
          </View>

          {contacts.length > 0 && contactsList(openContact)}
        </View>
      )}

      {error ? (
        <Text style={[styles.errorBanner, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {error}
        </Text>
      ) : null}

      {/* Reachable once threads already exist too — an auto-created class
          group thread means "no threads yet" stops being the only time a
          user needs to start a new one. */}
      <Modal visible={newChatOpen} transparent animationType="slide" onRequestClose={() => setNewChatOpen(false)}>
        <Pressable style={styles.newChatBackdrop} onPress={() => setNewChatOpen(false)}>
          <Pressable style={[styles.newChatSheet, { backgroundColor: colors.background }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.newChatHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.title, { fontSize: 18, color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }]}>
                {t('messagingStartConversation')}
              </Text>
              <Pressable onPress={() => setNewChatOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {contactsList(openContact)}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 28 },
  unreadCount: { fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  threadCard: { padding: 14, gap: 12, borderWidth: 1, alignItems: 'center' },
  groupIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  threadName: { fontSize: 15, marginBottom: 3 },
  threadPreview: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: 'Cairo_500Medium' as any },
  emptyDesc: { fontSize: 13, textAlign: 'center' },
  contactCard: { padding: 12, gap: 12, borderWidth: 1, alignItems: 'center' },
  messageBtn: { paddingHorizontal: 14, paddingVertical: 8, minWidth: 72, alignItems: 'center' },
  errorBanner: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  newChatBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  newChatSheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16 },
  newChatHeader: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
});
