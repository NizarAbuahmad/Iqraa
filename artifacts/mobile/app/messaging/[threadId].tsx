/**
 * A chat thread — a direct teacher↔parent/student conversation, or a
 * class-group thread with the teacher and every self-linked student.
 *
 * Loads on focus rather than opening a socket (this app's convention — see
 * app/classes/index.tsx). GET .../messages also marks the thread read as a
 * side effect, so there is no separate "mark read" call here — see
 * services/messaging.ts.
 *
 * Block (direct threads only, from the header menu) and report (any
 * message, via long-press) are this phase's safety rails. Both are
 * deliberately light here: block just flips a flag the server already
 * enforces, and report is a short reason picker, not a full form — see
 * services/messaging.ts and the server's file header for what each one
 * actually does (and does not do — a block never removes anyone from a
 * shared class thread, and a report never leaves this app; the owning
 * teacher already sees everything as a permanent participant).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { isTeacherRole, useAuth } from '@/context/AuthContext';
import {
  MessagingError,
  addGroupMembers,
  blockUser,
  getThread,
  listMessages,
  pickChatImage,
  removeGroupMember,
  reportUser,
  sendMessage as sendMessageApi,
  setStudentPosting,
  unblockUser,
  type ChatMessage,
  type ChatParticipantInfo,
  type ThreadDetail,
} from '@/services/messaging';
import { MessageBubble } from '@/components/ui/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { ParticipantPickerSheet } from '@/components/ui/ParticipantPickerSheet';
import { mergeNewMessages } from '@/services/messageMerge';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { useStudentAccountsEnabled } from '@/services/features';

const REPORT_REASON_KEYS = ['reportReasonInappropriate', 'reportReasonBullying', 'reportReasonSpam', 'reportReasonOther'] as const;

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  // Same gate as the roster's own key icon on classes/[id].tsx — see
  // services/features.ts. Both doors lead to the same v1-refused route.
  const studentAccounts = useStudentAccountsEnabled();

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  // Newest first, matching the inverted FlatList below.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ messageId: string; senderId: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [togglingPosting, setTogglingPosting] = useState(false);

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      const [th, msgs] = await Promise.all([getThread(threadId), listMessages(threadId)]);
      setThread(th);
      setMessages(msgs);
      setHasMore(msgs.length > 0);
      setError('');
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setLoading(false);
    }
  }, [threadId, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /*
   * The polling counterpart to load(). Deliberately NOT load() itself: that
   * assigns the newest page over `messages`, which would throw away every
   * older page the reader had scrolled back through and yank the thread
   * forward under them every few seconds. This merges instead, and stays
   * silent on failure — the reader did not ask for this fetch, so they must
   * not be shown it failing.
   *
   * Faster than the inbox's default: this is a thread someone is looking at
   * while a reply is being typed.
   */
  const refresh = useCallback(async () => {
    if (!threadId) return;
    try {
      const polled = await listMessages(threadId);
      setMessages(prev => mergeNewMessages(prev, polled));
    } catch {
      // Leave the open thread exactly as it was.
    }
  }, [threadId]);

  usePollingRefresh(refresh, 10000);

  const participantsById = useMemo(() => {
    const map = new Map<string, ChatParticipantInfo>();
    for (const p of thread?.participants ?? []) map.set(p.userId, p);
    if (thread?.otherParticipant) map.set(thread.otherParticipant.userId, thread.otherParticipant);
    return map;
  }, [thread]);

  const loadMore = useCallback(async () => {
    if (!threadId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const older = await listMessages(threadId, oldest.createdAt);
      if (older.length === 0) setHasMore(false);
      setMessages(prev => [...prev, ...older]);
    } catch {
      // A failed "load older messages" shouldn't interrupt the visible thread.
    } finally {
      setLoadingMore(false);
    }
  }, [threadId, loadingMore, hasMore, messages]);

  const handleSend = async () => {
    const body = input.trim();
    if ((!body && !attachment) || !threadId || sending) return;
    setInput('');
    const pendingAttachment = attachment;
    setAttachment(null);
    setSending(true);
    try {
      const message = await sendMessageApi(threadId, body, pendingAttachment ?? undefined);
      // Merged, not prepended: a poll can land between the server storing this
      // message and this line running, in which case it is already on screen
      // and a bare prepend would show it twice.
      setMessages(prev => mergeNewMessages(prev, [message]));
      setError('');
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setInput(body);
      setAttachment(pendingAttachment);
      setError(e instanceof MessagingError ? e.message : t('messagingSendError'));
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const dataUrl = await pickChatImage();
      if (dataUrl) setAttachment(dataUrl);
    } catch {
      setError(t('messagingSendError'));
    }
  };

  const isOwnerOfGroup = thread?.type === 'custom_group' && thread.createdBy === user?.id;

  const toggleStudentPosting = async () => {
    if (!threadId || !thread || togglingPosting) return;
    const next = !thread.studentPostingEnabled;
    setTogglingPosting(true);
    try {
      await setStudentPosting(threadId, next);
      setThread(prev => (prev ? { ...prev, studentPostingEnabled: next } : prev));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setTogglingPosting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!threadId || memberActionUserId) return;
    setMemberActionUserId(userId);
    try {
      await removeGroupMember(threadId, userId);
      setThread(prev => (prev ? { ...prev, participants: (prev.participants ?? []).filter(p => p.userId !== userId) } : prev));
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setMemberActionUserId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!threadId || !user || leaving) return;
    setLeaving(true);
    try {
      await removeGroupMember(threadId, user.id);
      router.back();
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
      setLeaving(false);
    }
  };

  const toggleBlock = async () => {
    if (!thread?.otherParticipant || blocking) return;
    setMenuOpen(false);
    setBlocking(true);
    try {
      if (thread.isBlocked) await unblockUser(thread.otherParticipant.userId);
      else await blockUser(thread.otherParticipant.userId);
      setThread(prev => (prev ? { ...prev, isBlocked: !prev.isBlocked } : prev));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setBlocking(false);
    }
  };

  const submitReport = async (reasonKey: string) => {
    if (!threadId || !reportTarget || reporting) return;
    setReporting(true);
    try {
      await reportUser({
        threadId,
        reportedUserId: reportTarget.senderId,
        messageId: reportTarget.messageId,
        reason: reasonKey,
      });
      setReportTarget(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
    } finally {
      setReporting(false);
    }
  };

  const topPad = insets.top + (insets.top === 0 ? 12 : 0);
  const align = isRTL ? 'right' : 'left';
  const isGroup = thread?.type !== 'direct';
  const headerTitle = isGroup ? (lang === 'ar' ? thread?.titleAr : thread?.title) || thread?.title : '';
  const isTeacher = isTeacherRole(user?.role);
  // The server enforces this too (see routes/messaging.ts) — hiding the
  // composer is the courtesy, not the rule.
  const canPost = !thread || !isGroup || isTeacher || thread.studentPostingEnabled;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          { paddingTop: topPad, backgroundColor: colors.card, borderBottomColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={colors.foreground} />
        </Pressable>
        {isGroup ? (
          <>
            <View style={[styles.groupIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <Text
              style={[styles.headerName, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}
              numberOfLines={1}
            >
              {headerTitle}
            </Text>
          </>
        ) : thread?.otherParticipant ? (
          <>
            <Avatar firstName={thread.otherParticipant.firstName} lastName={thread.otherParticipant.lastName} size={34} colors={colors} />
            <Text
              style={[styles.headerName, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}
              numberOfLines={1}
            >
              {thread.otherParticipant.firstName} {thread.otherParticipant.lastName}
            </Text>
          </>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {/*
          Adding someone used to be five taps in — ⋮ → إدارة الأعضاء → the
          dashed row → tick → إضافة — which is why nobody found it. The picker
          is already mounted independently of the manage sheet, so opening it
          straight from the header costs nothing. ⋮ keeps إدارة الأعضاء: it is
          still the only route to *remove* someone.

          Gated on isOwnerOfGroup, not thread.isOwner, so it stays off a class
          group — that membership is derived from the roster and must never be
          hand-edited (see routes/messaging.ts's syncClassGroupThread).
        */}
        {isOwnerOfGroup ? (
          <Pressable onPress={() => setAddMembersOpen(true)} hitSlop={10}>
            <Ionicons name="person-add-outline" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
        {(!isGroup && thread?.otherParticipant) || thread?.type === 'custom_group' || (isGroup && thread?.isOwner) ? (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          inverted
          contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.mutedForeground} style={{ marginVertical: 8 }} /> : null}
          renderItem={({ item }) => {
            const isOwn = item.senderId === user?.id;
            const sender = isOwn ? null : participantsById.get(item.senderId);
            return (
              <Pressable
                onLongPress={() => {
                  if (!isOwn) {
                    Haptics.selectionAsync();
                    setReportTarget({ messageId: item.id, senderId: item.senderId });
                  }
                }}
                delayLongPress={400}
              >
                <MessageBubble
                  body={item.body}
                  createdAt={item.createdAt}
                  isOwn={isOwn}
                  isRTL={isRTL}
                  colors={colors}
                  senderFirstName={sender?.firstName}
                  senderLastName={sender?.lastName}
                  attachmentUrl={item.attachmentUrl}
                  attachmentKind={item.attachmentKind}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
                {t('messagingEmptyThread')}
              </Text>
            </View>
          }
        />
      )}

      {error ? (
        <Text style={[styles.errorText, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {error}
        </Text>
      ) : null}

      {!canPost ? (
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[styles.readOnlyNotice, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="megaphone-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.readOnlyText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
              {t('messagingReadOnlyGroup')}
            </Text>
          </View>
        </View>
      ) : (
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {attachment ? (
          <View style={[styles.attachmentPreview, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Image source={{ uri: attachment }} style={styles.attachmentThumb} resizeMode="cover" />
            <Pressable onPress={() => setAttachment(null)} hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderRadius: 24 }, isRTL && { flexDirection: 'row-reverse' }]}>
          <Pressable onPress={handlePickImage} hitSlop={10} style={{ paddingBottom: 6 }}>
            <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
          </Pressable>
          <TextInput
            style={[styles.input, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}
            placeholder={t('messagingPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
          />
          <Pressable
            onPress={handleSend}
            disabled={(!input.trim() && !attachment) || sending}
            style={[styles.sendBtn, { backgroundColor: input.trim() || attachment ? colors.primary : colors.muted, borderRadius: 20 }]}
          >
            <Ionicons
              name={isRTL ? 'arrow-back' : 'arrow-forward'}
              size={18}
              color={input.trim() || attachment ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
      )}

      {/* ─── Header menu: block/unblock a direct thread, or manage/leave a custom group ─── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            {isGroup ? (
              <>
                {/* The one switch that decides whether students may post here. */}
                {thread?.isOwner ? (
                  <Pressable onPress={toggleStudentPosting} disabled={togglingPosting} style={styles.menuRow}>
                    <Ionicons
                      name={thread.studentPostingEnabled ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={thread.studentPostingEnabled ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.menuText, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                      {t('messagingAllowStudentPosting')}
                    </Text>
                  </Pressable>
                ) : null}
                {/*
                  The link code lives on the roster, one per student, behind a
                  small icon on the class screen — teachers could not find it,
                  which read as "the feature is missing". This is the way back
                  to it from the one screen they are already on when they want
                  to invite someone. Not a code of its own: a class-wide join
                  code is a separate, deliberately-parked decision.

                  Gated on `studentAccounts` for the same reason the roster's
                  own key icon is: the route it opens mints a code that
                  `studentAccountsEnabled()` refuses in v1. Making a dead end
                  easier to reach is worse than leaving it buried — that is
                  what this row did between #281 and this fix.
                */}
                {thread?.type === 'class_group' && thread.isOwner && thread.classGroupId && studentAccounts ? (
                  <Pressable
                    onPress={() => { setMenuOpen(false); router.push(`/classes/${thread.classGroupId}`); }}
                    style={styles.menuRow}
                  >
                    <Ionicons name="key-outline" size={18} color={colors.foreground} />
                    <Text style={[styles.menuText, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                      {t('messagingStudentCodes')}
                    </Text>
                  </Pressable>
                ) : null}
                {isOwnerOfGroup ? (
                  <Pressable onPress={() => { setMenuOpen(false); setManageOpen(true); }} style={styles.menuRow}>
                    <Ionicons name="people-outline" size={18} color={colors.foreground} />
                    <Text style={[styles.menuText, { color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                      {t('messagingManageMembers')}
                    </Text>
                  </Pressable>
                ) : thread?.type === 'custom_group' ? (
                  <Pressable onPress={() => { setMenuOpen(false); void handleLeaveGroup(); }} disabled={leaving} style={styles.menuRow}>
                    <Ionicons name="exit-outline" size={18} color={colors.destructive} />
                    <Text style={[styles.menuText, { color: colors.destructive, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                      {t('messagingLeaveGroup')}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Pressable onPress={toggleBlock} disabled={blocking} style={styles.menuRow}>
                <Ionicons name={thread?.isBlocked ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={colors.destructive} />
                <Text style={[styles.menuText, { color: colors.destructive, fontFamily: 'Cairo_500Medium', textAlign: align }]}>
                  {thread?.isBlocked ? t('messagingUnblock') : t('messagingBlock')}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ─── Manage members: owning teacher only, custom groups only ─── */}
      <Modal visible={manageOpen} transparent animationType="slide" onRequestClose={() => setManageOpen(false)}>
        <Pressable style={styles.newChatBackdrop} onPress={() => setManageOpen(false)}>
          <Pressable style={[styles.newChatSheet, { backgroundColor: colors.background }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.newChatHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align, flex: 1 }]}>
                {t('messagingManageMembers')}
              </Text>
              <Pressable onPress={() => setManageOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <FlatList
              data={thread?.participants ?? []}
              keyExtractor={p => p.userId}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
              renderItem={({ item }) => (
                <View style={[styles.memberManageRow, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Avatar firstName={item.firstName} lastName={item.lastName} size={30} colors={colors} />
                  <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_500Medium', textAlign: align }} numberOfLines={1}>
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.userId !== thread?.createdBy ? (
                    <Pressable onPress={() => handleRemoveMember(item.userId)} disabled={memberActionUserId === item.userId} hitSlop={10}>
                      <Ionicons name="close-circle" size={20} color={colors.destructive} />
                    </Pressable>
                  ) : null}
                </View>
              )}
            />
            <Pressable
              onPress={() => setAddMembersOpen(true)}
              style={[styles.addMembersRow, { borderColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'Cairo_500Medium' }}>{t('messagingPickMembers')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ParticipantPickerSheet
        visible={addMembersOpen}
        onClose={() => setAddMembersOpen(false)}
        excludeUserIds={(thread?.participants ?? []).map(p => p.userId)}
        onConfirm={async picked => {
          if (!threadId) return;
          try {
            const participants = await addGroupMembers(threadId, picked.map(p => p.userId));
            setThread(prev => (prev ? { ...prev, participants } : prev));
          } catch (e) {
            setError(e instanceof MessagingError ? e.message : t('messagingLoadError'));
          } finally {
            setAddMembersOpen(false);
          }
        }}
      />

      {/* ─── Report reason picker, opened by long-pressing a message ─── */}
      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setReportTarget(null)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: 'Cairo_600SemiBold', textAlign: align }]}>
              {t('messagingReportTitle')}
            </Text>
            {REPORT_REASON_KEYS.map(key => (
              <Pressable key={key} onPress={() => submitReport(key)} disabled={reporting} style={styles.menuRow}>
                <Text style={[styles.menuText, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                  {t(key)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center', gap: 10, borderBottomWidth: 1 },
  groupIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 16, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14 },
  errorText: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },
  inputBar: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 10 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 0 },
  sendBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menuCard: { width: '100%', maxWidth: 340, borderRadius: 16, padding: 10, gap: 2 },
  modalTitle: { fontSize: 15, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10 },
  menuText: { fontSize: 14, flex: 1 },
  readOnlyNotice: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  readOnlyText: { fontSize: 12.5, flexShrink: 1 },
  attachmentPreview: { alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 8 },
  attachmentThumb: { width: 56, height: 56, borderRadius: 10 },
  newChatBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  newChatSheet: { maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, gap: 12 },
  newChatHeader: { alignItems: 'center', paddingHorizontal: 16 },
  memberManageRow: { alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  addMembersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed' },
});
