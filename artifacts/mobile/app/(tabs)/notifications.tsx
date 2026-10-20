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
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  getMyContacts,
  getTeacherContacts,
  hideThread,
  listThreads,
  startThread,
  type ChatThreadSummary,
  type ChatRole,
} from '@/services/messaging';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { chatThreadSubtitle } from '@/services/chatThreadSubtitle';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { useStudentAccountsEnabled } from '@/services/features';
import { setUnreadMessages } from '@/services/unreadMessages';
import { filterThreads, THREAD_FILTERS, type ThreadFilter } from '@/services/threadFilter';
import { allSelected, pruneSelection, toggleSelected } from '@/services/threadSelection';
import { confirm } from '@/services/confirm';
import { Avatar } from '@/components/ui/Avatar';
import { LoadError } from '@/components/ui/LoadError';
import { relativeTime } from '@/services/relativeTime';

interface Contact {
  userId: string;
  firstName: string;
  lastName: string;
  studentName: string;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const studentAccounts = useStudentAccountsEnabled();
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
  const [filter, setFilter] = useState<ThreadFilter>('all');
  // Bulk «حذف»: long-press a row (or tap «تحديد») to start. It is the same
  // per-person hide as the thread screen's menu — nothing is deleted for anyone
  // else — so a teacher can clear many test conversations and class groups at
  // once instead of opening each one.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, myContacts] = await Promise.all([
        listThreads(),
        isTeacherRole(user?.role)
          ? // Deduped by userId, the same way ParticipantPickerSheet does it:
            // contacts arrive grouped by student, so one parent with two
            // children on this teacher's roster appeared twice — and this list
            // keys on userId, so React saw duplicate keys. The two lists used
            // to disagree about the same data; the picker was the one that was
            // right. First student wins, so the subtitle stays stable.
            getTeacherContacts().then(byStudent => {
              const seen = new Map<string, Contact>();
              for (const s of byStudent) {
                for (const c of s.contacts) {
                  if (!seen.has(c.userId)) seen.set(c.userId, { ...c, studentName: s.studentName });
                }
              }
              return [...seen.values()];
            })
          : getMyContacts().then(rows =>
              rows.map(r => ({ userId: r.userId, firstName: r.firstName, lastName: r.lastName, studentName: r.studentName })),
            ),
      ]);
      setThreads(list);
      // A poll can drop a thread someone else just hid; don't act on a ghost.
      setSelected(prev => pruneSelection(prev, list.map(th => th.id)));
      setUnreadMessages(list.reduce((sum, th) => sum + th.unreadCount, 0));
      setContacts(myContacts);
      setError('');
    } catch (e) {
      setError(apiErrorMessage(e, 'messagingLoadError', t));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  // Keeps the inbox current without a manual reload — see hooks/usePollingRefresh.ts.
  usePollingRefresh(load);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const onRowPress = (id: string) => {
    if (selectMode) setSelected(prev => toggleSelected(prev, id));
    else router.push(`/messaging/${id}`);
  };

  const onRowLongPress = (id: string) => {
    if (bulkBusy) return;
    setSelectMode(true);
    setSelected(prev => (prev.has(id) ? prev : toggleSelected(prev, id)));
  };

  const hideSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0 || bulkBusy) return;
    const ok = await confirm({
      title: t('messagingBulkHideConfirmTitle', ids.length),
      message: t('messagingBulkHideConfirmDesc'),
      confirmLabel: t('messagingBulkHide', ids.length),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(ids.map(id => hideThread(id)));
      const failed = ids.filter((_, i) => results[i].status === 'rejected');
      await load();
      if (failed.length === 0) {
        exitSelectMode();
      } else {
        // Keep only the ones that did not go, so a retry is one tap.
        setSelected(new Set(failed));
        setError(t('messagingBulkHidePartial', failed.length));
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const openContact = async (userId: string) => {
    setStartingUserId(userId);
    try {
      const thread = await startThread(userId);
      setNewChatOpen(false);
      router.push(`/messaging/${thread.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, 'messagingSendError', t));
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
      // Same reason as ParticipantPickerSheet's: these are people holding an
      // account, not people on the roster, and "none yet" needs to say so.
      ListEmptyComponent={
        <View style={{ paddingVertical: 20, gap: 6 }}>
          <Text style={[styles.threadName, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: 'center' }]}>
            {t('messagingNoContactsTitle')}
          </Text>
          <Text style={[styles.threadPreview, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', lineHeight: 20 }]}>
            {studentAccounts ? t('messagingNoContactsDesc') : t('messagingDisabledDesc')}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.contactCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <Avatar firstName={item.firstName} lastName={item.lastName} size={40} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.threadName, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }]} numberOfLines={1}>
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
              <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                {t('messagingStartConversation')}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    />
  );

  // Not insets.top: the tab layout's lesson bar (or the slim bell header a
  // parent/student gets) sits above this screen and already pays for the
  // status bar, so adding it again left a blank band under that bar.
  const topPad = 16;
  const unreadCount = threads.reduce((sum, th) => sum + th.unreadCount, 0);
  const align = isRTL ? 'right' : 'left';
  const visibleThreads = filterThreads(threads, filter);
  const everyVisibleSelected = allSelected(selected, visibleThreads.map(th => th.id));
  const filterLabel: Record<ThreadFilter, string> = {
    all: t('messagingFilterAll'),
    groups: t('messagingFilterGroups'),
    direct: t('messagingFilterDirect'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-end' }]}>
        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
            {t('notificationsTitle')}
          </Text>
          {selectMode ? (
            <Text style={[styles.unreadCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('messagingSelectedCount', selected.size)}
            </Text>
          ) : unreadCount > 0 && (
            <Text style={[styles.unreadCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('unread', unreadCount)}
            </Text>
          )}
        </View>
        {selectMode ? (
          <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, paddingBottom: 6, alignItems: 'center' }]}>
            <Pressable onPress={exitSelectMode} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Text style={[styles.headerActionText, { color: colors.mutedForeground }]}>{t('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setSelected(everyVisibleSelected ? new Set() : new Set(visibleThreads.map(th => th.id)))
              }
              hitSlop={10}
              accessibilityRole="button"
            >
              <Text style={[styles.headerActionText, { color: colors.primary }]}>
                {everyVisibleSelected ? t('messagingDeselectAll') : t('messagingSelectAll')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void hideSelected()}
              disabled={selected.size === 0 || bulkBusy}
              hitSlop={10}
              accessibilityRole="button"
              style={[styles.headerActionPrimary, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.destructive, opacity: selected.size === 0 || bulkBusy ? 0.5 : 1 }]}
            >
              {bulkBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#fff" />
              )}
              <Text style={[styles.headerActionText, { color: '#fff' }]}>{t('messagingBulkHide', selected.size)}</Text>
            </Pressable>
          </View>
        ) : (
        <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, paddingBottom: 6, alignItems: 'center' }]}>
          {threads.length > 0 && (
            <Pressable onPress={() => setSelectMode(true)} hitSlop={10} accessibilityRole="button" style={[styles.headerAction, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.headerActionText, { color: colors.mutedForeground }]}>{t('messagingSelect')}</Text>
            </Pressable>
          )}
          {isTeacherRole(user?.role) && (
            <Pressable onPress={() => router.push('/messaging/new-group')} hitSlop={10} accessibilityRole="button" style={[styles.headerAction, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="people-circle-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.headerActionText, { color: colors.mutedForeground }]}>{t('messagingBroadcastTitle')}</Text>
            </Pressable>
          )}
          {/*
            Shown even with no contacts. Hiding it left a teacher whose
            students have not signed up yet with no compose button and nothing
            explaining why — indistinguishable from the feature being broken.
            The sheet now says what is missing and how to fix it.
          */}
          <Pressable onPress={() => setNewChatOpen(true)} hitSlop={10} accessibilityRole="button" style={[styles.headerActionPrimary, { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: colors.primary }]}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={[styles.headerActionText, { color: '#fff' }]}>{t('messagingNewMessage')}</Text>
          </Pressable>
        </View>
        )}
      </View>

      {/*
        Above the list, not after it: after it, the message sat below a
        full-height empty state, behind the floating tab bar, and was never seen.
      */}
      {error ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <LoadError message={error} onRetry={() => void load()} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error && threads.length === 0 ? (
        // Nothing loaded: «لا توجد محادثات بعد» would be a claim we cannot make.
        null
      ) : threads.length > 0 ? (
        <View style={{ flex: 1 }}>
        <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]} accessibilityRole="tablist">
          {THREAD_FILTERS.map(f => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                accessibilityRole="tab"
                aria-selected={active}
                style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={{ fontSize: 13, fontFamily: 'ReadexPro_600SemiBold', color: active ? colors.primaryForeground : colors.mutedForeground }}>
                  {filterLabel[f]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FlatList
          data={visibleThreads}
          keyExtractor={th => th.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', paddingTop: 32 }]}>
              {t('messagingFilterEmpty')}
            </Text>
          }
          renderItem={({ item }) => {
            const other = item.otherParticipant;
            const isGroup = item.type !== 'direct';
            const name = isGroup ? (lang === 'ar' ? item.titleAr : item.title) || item.title : other ? `${other.firstName} ${other.lastName}` : '';
            const senderName = item.lastMessage?.senderName;
            const preview = item.lastMessage
              ? senderName ? `${senderName}: ${item.lastMessage.body}` : item.lastMessage.body
              : '';
            const ts = item.updatedAt ? relativeTime(item.updatedAt, lang) : '';
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => onRowPress(item.id)}
                onLongPress={() => onRowLongPress(item.id)}
                aria-selected={selectMode ? isSelected : undefined}
                style={[
                  styles.threadCard,
                  {
                    backgroundColor: item.unreadCount > 0 ? colors.secondary : colors.card,
                    borderColor: isSelected ? colors.primary : item.unreadCount > 0 ? colors.primary + '33' : colors.border,
                    borderRadius: colors.radius,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  },
                ]}
              >
                {selectMode ? (
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                ) : null}
                {isGroup ? (
                  <View style={[styles.groupIcon, { backgroundColor: colors.secondary }]}>
                    <Ionicons name="people" size={20} color={colors.primary} />
                  </View>
                ) : (
                  <Avatar firstName={other?.firstName ?? '?'} lastName={other?.lastName} size={44} colors={colors} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Text
                      style={[styles.threadName, { color: colors.foreground, fontFamily: item.unreadCount > 0 ? 'ReadexPro_600SemiBold' : 'ReadexPro_500Medium', textAlign: align, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    {ts ? (
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', marginStart: 6 }}>
                        {ts}
                      </Text>
                    ) : null}
                  </View>
                  {item.type === 'direct' && other ? (
                    <Text
                      style={[styles.threadRole, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
                      numberOfLines={1}
                    >
                      {chatThreadSubtitle(other, t, lang)}
                    </Text>
                  ) : item.type === 'class_group' ? (
                    <Text style={[styles.threadRole, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]} numberOfLines={1}>
                      {t('messagingThreadClassGroup')}
                    </Text>
                  ) : item.type === 'custom_group' ? (
                    <Text style={[styles.threadRole, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]} numberOfLines={1}>
                      {t('messagingThreadCustomGroup')}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.threadPreview, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'ReadexPro_600SemiBold', lineHeight: 16 }}>
                      {item.unreadCount > 9 ? '9+' : String(item.unreadCount)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t('noNotifications')}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
              {t(isTeacherRole(user?.role) ? 'messagingEmptyDescTeacher' : 'messagingEmptyDesc')}
            </Text>
          </View>

          {contactsList(openContact)}
        </View>
      )}


      {/* Reachable once threads already exist too — an auto-created class
          group thread means "no threads yet" stops being the only time a
          user needs to start a new one. */}
      <Modal visible={newChatOpen} transparent animationType="slide" onRequestClose={() => setNewChatOpen(false)}>
        <Pressable style={styles.newChatBackdrop} onPress={() => setNewChatOpen(false)}>
          <Pressable style={[styles.newChatSheet, { backgroundColor: colors.background }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.newChatHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.title, { fontSize: 18, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
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
  unreadCount: { fontSize: 15, lineHeight: 24, marginTop: 2 },
  headerAction: { alignItems: 'center', gap: 4 },
  headerActionPrimary: { alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  headerActionText: { fontSize: 13, fontFamily: 'ReadexPro_600SemiBold' },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  threadCard: { padding: 14, gap: 12, borderWidth: 1, alignItems: 'center' },
  groupIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  threadName: { fontSize: 15, marginBottom: 3 },
  threadRole: { fontSize: 13, marginBottom: 2 },
  threadPreview: { fontSize: 15, lineHeight: 24 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  empty: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 15, fontFamily: 'ReadexPro_500Medium' as any },
  emptyDesc: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  contactCard: { padding: 12, gap: 12, borderWidth: 1, alignItems: 'center' },
  messageBtn: { paddingHorizontal: 14, paddingVertical: 8, minWidth: 72, alignItems: 'center' },
  newChatBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  newChatSheet: { maxHeight: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16 },
  newChatHeader: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
});
