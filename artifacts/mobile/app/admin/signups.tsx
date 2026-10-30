/**
 * Collected emails — iqrra.com's waitlist and contact-form submissions, which
 * the site's Vercel functions copy into `site_signups` (POST /api/site/signups).
 * Signups from before that existed live only in Resend / the FEEDBACK_TO inbox.
 * Also «اقترح ميزة» ideas from signed-out visitors to the app (kind `idea`,
 * POST /api/site/ideas). Ideas from signed-in users are in the dashboard's
 * feedback list instead, because those carry an account.
 *
 * system_admins can also message the waitlist from here («راسل قائمة الانتظار»):
 * the server (POST /admin/broadcasts, lib/siteMail.ts) decides who each kind of
 * message may reach and records who was mailed; this screen only shows the count.
 *
 * Role-gated client-side like `admin/dashboard.tsx`; enforcement is server-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiJson, ApiError } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { DateRange, EMPTY_RANGE, rangeQuery, type Range } from '@/components/admin/DateRange';
import { BackButton } from '@/components/ui/BackButton';
import { parseSignupKind, type SignupKind } from '@/services/adminSignupKind';

const ACCENT = '#4F46E5';
const SUCCESS = '#15803D';
const ADMIN_ROLES = ['school_admin', 'system_admin'];

type Signup = {
  id: string; kind: 'waitlist' | 'contact' | 'idea'; email: string; name: string; message: string; context: string; createdAt: string;
  invitedAt: string | null; lastMessagedAt: string | null; unsubscribedAt: string | null;
  /** When an account with this email registered in the app; null if none. */
  joinedAt: string | null;
};
type Kind = SignupKind;
type Status = 'all' | 'uninvited' | 'invited' | 'joined' | 'unsubscribed';
// What a message to the waitlist is for — the server decides who each one may reach (lib/siteMail.ts).
type Purpose = 'invite' | 'launch' | 'update';
type Audience = { count: number; heldBack: number; updatesOpen: boolean };

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString();

export default function AdminSignupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  // The invite endpoint is system_admin only; school admins would just get a 403.
  const canInvite = user?.role === 'system_admin';

  // The dashboard's overview tiles open this on the chip they count.
  const params = useLocalSearchParams<{ kind?: string | string[] }>();
  const [kind, setKind] = useState<Kind>(() => parseSignupKind(params.kind));
  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [items, setItems] = useState<Signup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState('');
  const [invited, setInvited] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('all');
  const [purpose, setPurpose] = useState<Purpose>('invite');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [audience, setAudience] = useState<Audience | null>(null);
  const [mailing, setMailing] = useState<'' | 'test' | 'send'>('');
  const [mailResult, setMailResult] = useState('');

  const kindParam =
    (kind === 'all' ? '' : `kind=${kind}&`) +
    (status === 'all' ? '' : `status=${status}&`) +
    (rangeQuery(range) ? `${rangeQuery(range).slice(1)}&` : '');

  const load = useCallback(async (offset: number) => {
    const res = await apiJson<{ items: Signup[]; total: number }>(`/admin/signups?${kindParam}offset=${offset}`);
    setItems(cur => (offset === 0 ? res.items : [...cur, ...res.items]));
    setTotal(res.total);
  }, [kindParam]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(0)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isAdmin, load]);

  // The count behind «إرسال إلى N»: asked of the server, which owns who may be mailed.
  const refreshAudience = useCallback(async () => {
    try {
      setAudience(await apiJson<Audience>('/admin/broadcasts', { method: 'POST', body: JSON.stringify({ purpose, dryRun: true }) }));
    } catch {
      setAudience(null);
    }
  }, [purpose]);

  useEffect(() => {
    if (canInvite) void refreshAudience();
  }, [canInvite, refreshAudience]);

  const needsText = purpose !== 'invite';
  const textReady = !needsText || (subject.trim().length >= 3 && bodyText.trim().length >= 10);
  const sendFailed = (e: unknown) => {
    if (e instanceof ApiError && e.message === 'updates-closed') {
      return ar ? 'رسائل الأخبار لم تُفتح بعد — تُفتح بعد نشر صيغة الموافقة الجديدة في الموقع' : 'News emails are not open yet — they open once the new consent wording is live on the site';
    }
    return ar ? 'تعذّر الإرسال' : 'Could not send';
  };

  // A copy to the admin's own address; nothing is recorded, so it can be repeated freely.
  const sendTest = async () => {
    if (mailing || !textReady) return;
    setMailing('test');
    setMailResult('');
    try {
      const r = await apiJson<{ sentTo: string }>('/admin/broadcasts', {
        method: 'POST',
        body: JSON.stringify({ purpose, subject, body: bodyText, testOnly: true }),
      });
      setMailResult(ar ? `أُرسلت نسخة تجريبية إلى ${r.sentTo}` : `Test copy sent to ${r.sentTo}`);
    } catch (e: unknown) {
      setMailResult(sendFailed(e));
    } finally {
      setMailing('');
    }
  };

  const sendBroadcast = async () => {
    if (mailing || !audience || audience.count === 0 || !textReady) return;
    const ok = await confirm({
      title: ar ? 'إرسال الرسالة؟' : 'Send this message?',
      message: ar
        ? `ستُرسل إلى ${audience.count} بريدًا من قائمة الانتظار. لا يمكن التراجع عن الإرسال.`
        : `This goes to ${audience.count} waitlist addresses and can't be undone.`,
      confirmLabel: ar ? 'أرسل' : 'Send',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    setMailing('send');
    setMailResult('');
    try {
      const r = await apiJson<{ sent: number; failed: number; skipped?: number }>('/admin/broadcasts', {
        method: 'POST',
        body: JSON.stringify({ purpose, subject, body: bodyText }),
        timeoutMs: 180_000,
      });
      // `skipped`: unsubscribed from any of our mail (email_suppressions), so left out.
      const skipped = r.skipped ? (ar ? ` · أُلغي اشتراك ${r.skipped}` : ` · unsubscribed ${r.skipped}`) : '';
      setMailResult((ar ? `أُرسلت ${r.sent} · فشلت ${r.failed}` : `Sent ${r.sent} · failed ${r.failed}`) + skipped);
      if (r.sent > 0) {
        if (purpose !== 'invite') setBodyText('');
        void load(0).catch(() => {});
      }
    } catch (e: unknown) {
      setMailResult(sendFailed(e));
    } finally {
      setMailing('');
      void refreshAudience();
    }
  };

  // Mails the Android download link. The server records it (`invitedAt`), so
  // the badge on the row survives a reload; `invited` is only this visit's note.
  const sendInvite = async (raw: string) => {
    const email = raw.trim();
    if (!email || inviting) return;
    setInviting(email);
    setError('');
    try {
      await apiJson('/admin/invites', { method: 'POST', body: JSON.stringify({ email }) });
      setInvited(cur => [...cur, email.toLowerCase()]);
      const now = new Date().toISOString();
      setItems(cur => cur.map(r => (r.kind === 'waitlist' && r.email.toLowerCase() === email.toLowerCase() ? { ...r, invitedAt: r.invitedAt ?? now } : r)));
      void refreshAudience();
      if (email === inviteEmail.trim()) setInviteEmail('');
    } catch (e: unknown) {
      setError(e instanceof ApiError && e.message === 'unsubscribed'
        ? (ar ? `${email} ألغى اشتراكه، فلا تُرسَل إليه دعوة` : `${email} unsubscribed, so no invite is sent`)
        : (ar ? `تعذّر إرسال الدعوة إلى ${email}` : `Could not send the invite to ${email}`));
    } finally {
      setInviting('');
    }
  };

  // Fetched with the auth header (a plain link would carry none), then saved as a file.
  const exportCsv = async () => {
    try {
      const res = await apiFetch(`/admin/signups?${kindParam}format=csv`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const name = `iqraa-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      if (Platform.OS !== 'web') {
        // No DOM here: the anchor-click path below threw `document is not
        // defined` into the error banner on Android. Write to cache and hand
        // the file to the share sheet, as the other exports do.
        const file = new File(Paths.cache, name);
        file.write(await res.text());
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: name });
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={ACCENT} /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const chips: [Kind, string, string][] = [['all', 'الكل', 'All'], ['waitlist', 'قائمة الانتظار', 'Waitlist'], ['contact', 'رسائل التواصل', 'Contact'], ['idea', 'اقتراحات', 'Ideas']];
  const statusChips: [Status, string, string][] = [['all', 'كل الحالات', 'Any status'], ['uninvited', 'لم تُرسَل دعوة', 'Not invited'], ['invited', 'أُرسلت إليهم دعوة', 'Invite sent'], ['joined', 'انضموا', 'Joined'], ['unsubscribed', 'ألغوا الاشتراك', 'Unsubscribed']];
  const purposes: [Purpose, string, string][] = [['invite', 'دعوة التطبيق', 'App invite'], ['launch', 'إشعار الإطلاق', 'Launch notice'], ['update', 'أخبار وتحديثات', 'News & updates']];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'البريد المجمّع من iqrra.com' : 'Emails collected on iqrra.com'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 10 }}>
          {canInvite && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
                {ar ? 'ادعُ شخصًا لتجربة تطبيق الأندرويد' : 'Invite someone to try the Android app'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => { void sendInvite(inviteEmail); }}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: 'left' }}
                />
                <Pressable
                  onPress={() => { void sendInvite(inviteEmail); }}
                  disabled={!inviteEmail.trim() || !!inviting}
                  style={[styles.chip, { backgroundColor: ACCENT, borderColor: ACCENT, borderRadius: colors.radius, opacity: !inviteEmail.trim() || inviting ? 0.5 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'إرسال الدعوة' : 'Send invite'}</Text>
                </Pressable>
              </View>
              {invited.length > 0 && (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                  {ar ? `أُرسلت الدعوة: ${invited.join('، ')}` : `Invite sent: ${invited.join(', ')}`}
                </Text>
              )}
            </View>
          )}
          {canInvite && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, gap: 8 }]}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
                {ar ? 'راسل قائمة الانتظار' : 'Message the waitlist'}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                {purposes.map(([p, a, e]) => {
                  const closed = p === 'update' && audience?.updatesOpen === false;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => { setPurpose(p); setAudience(null); setMailResult(''); }}
                      style={[styles.chip, { borderRadius: colors.radius, backgroundColor: purpose === p ? ACCENT : colors.card, borderColor: purpose === p ? ACCENT : colors.border, opacity: closed ? 0.5 : 1 }]}
                    >
                      <Text style={{ color: purpose === p ? '#fff' : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? a : e}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 18, textAlign: align }}>
                {purpose === 'invite'
                  ? (ar ? 'يُرسَل نص الدعوة الثابت مع رابط التحميل إلى من لم تُرسَل إليهم دعوة بعد ولم ينضموا إلى التطبيق.' : 'Sends the standard invite with the download link to everyone not yet invited and not already joined.')
                  : purpose === 'launch'
                    ? (ar ? 'يصل إلى كل من سجّل في القائمة ولم يُلغِ اشتراكه — للدعوة وإشعار الإطلاق فقط، وهذا ما وُعدوا به.' : 'Reaches everyone on the list who has not unsubscribed — invites and the launch notice only, which is what they were promised.')
                    : audience?.updatesOpen === false
                      ? (ar ? 'لم تُفتح بعد: تُفتح بعد نشر صيغة الموافقة الجديدة في الموقع، ولمن يسجّل بعدها فقط.' : 'Not open yet: it opens once the new consent wording is live on the site, and only reaches people who sign up after it.')
                      : (ar ? 'أخبار ومعلومات عن التطبيق — لمن سجّل بعد صيغة الموافقة الجديدة فقط.' : 'App news and information — only for people who signed up after the new consent wording.')}
              </Text>
              {needsText && (
                <>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder={ar ? 'عنوان الرسالة' : 'Subject'}
                    placeholderTextColor={colors.mutedForeground}
                    maxLength={150}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}
                  />
                  <TextInput
                    value={bodyText}
                    onChangeText={setBodyText}
                    placeholder={ar ? 'نص الرسالة — سطر فارغ يفصل الفقرات، والروابط تصبح قابلة للنقر' : 'Message — a blank line starts a new paragraph; links become clickable'}
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={7}
                    maxLength={10000}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, minHeight: 140, textAlignVertical: 'top', color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}
                  />
                </>
              )}
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, textAlign: align }}>
                {audience === null
                  ? '…'
                  : ar
                    ? `${audience.count} مستلم${audience.heldBack > 0 ? ` · ${audience.heldBack} مؤجَّل (وصلتهم رسالة قبل أقل من ١٢ ساعة)` : ''}`
                    : `${audience.count} recipients${audience.heldBack > 0 ? ` · ${audience.heldBack} held back (mailed in the last 12 h)` : ''}`}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => { void sendTest(); }}
                  disabled={!!mailing || !textReady}
                  style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, opacity: mailing || !textReady ? 0.5 : 1 }]}
                >
                  <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                    {mailing === 'test' ? '…' : ar ? 'أرسل نسخة تجريبية لي' : 'Send me a test copy'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { void sendBroadcast(); }}
                  disabled={!!mailing || !textReady || !audience || audience.count === 0 || (purpose === 'update' && audience.updatesOpen === false)}
                  style={[styles.chip, { borderRadius: colors.radius, backgroundColor: ACCENT, borderColor: ACCENT, opacity: mailing || !textReady || !audience || audience.count === 0 || (purpose === 'update' && audience.updatesOpen === false) ? 0.5 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                    {mailing === 'send' ? '…' : ar ? `إرسال إلى ${audience?.count ?? 0}` : `Send to ${audience?.count ?? 0}`}
                  </Text>
                </Pressable>
              </View>
              {!!mailResult && (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{mailResult}</Text>
              )}
            </View>
          )}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {chips.map(([k, a, e]) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.chip, { borderRadius: colors.radius, backgroundColor: kind === k ? ACCENT : colors.card, borderColor: kind === k ? ACCENT : colors.border }]}
              >
                <Text style={{ color: kind === k ? '#fff' : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? a : e}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {Platform.OS === 'web' && (
              <Pressable onPress={exportCsv} style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                <Ionicons name="download-outline" size={16} color={ACCENT} />
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'تصدير CSV' : 'Export CSV'}</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
            {statusChips.map(([k, a, e]) => (
              <Pressable
                key={k}
                onPress={() => setStatus(k)}
                style={[styles.chip, { borderRadius: colors.radius, backgroundColor: status === k ? ACCENT : colors.card, borderColor: status === k ? ACCENT : colors.border }]}
              >
                <Text style={{ color: status === k ? '#fff' : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? a : e}</Text>
              </Pressable>
            ))}
          </View>
          <DateRange value={range} onChange={setRange} ar={ar} isRTL={isRTL} colors={colors} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
            {ar ? `${total} إدخال` : `${total} entries`}
          </Text>
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}

          {loading ? <ActivityIndicator color={ACCENT} /> : items.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', marginTop: 12 }}>
              {ar ? 'لا شيء بعد' : 'Nothing yet'}
            </Text>
          ) : items.map(s => (
            <View key={s.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={s.kind === 'waitlist' ? 'mail-outline' : s.kind === 'idea' ? 'bulb-outline' : 'chatbubble-outline'} size={16} color={ACCENT} />
                <Text selectable style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
                  {s.email || s.name || '—'}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>{new Date(s.createdAt).toLocaleString()}</Text>
              </View>
              {!!s.name && !!s.email && <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>{s.name}</Text>}
              {!!s.message && <Text selectable style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{s.message}</Text>}
              {!!s.context && <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: align }}>{s.context}</Text>}
              {s.kind === 'waitlist' && (!!s.invitedAt || !!s.joinedAt || !!s.unsubscribedAt) && (
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 }}>
                  {!!s.invitedAt && (
                    <View style={[styles.badge, { borderColor: ACCENT }]}>
                      <Ionicons name="paper-plane-outline" size={14} color={ACCENT} />
                      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                        {ar ? `أُرسلت الدعوة · ${fmtDay(s.invitedAt)}` : `Invite sent · ${fmtDay(s.invitedAt)}`}
                      </Text>
                    </View>
                  )}
                  {!!s.joinedAt && (
                    <View style={[styles.badge, { borderColor: SUCCESS }]}>
                      <Ionicons name="checkmark-circle" size={14} color={SUCCESS} />
                      <Text style={{ color: SUCCESS, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                        {ar ? `انضم · ${fmtDay(s.joinedAt)}` : `Joined · ${fmtDay(s.joinedAt)}`}
                      </Text>
                    </View>
                  )}
                  {!!s.unsubscribedAt && (
                    <View style={[styles.badge, { borderColor: colors.destructive }]}>
                      <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                        {ar ? `ألغى الاشتراك · ${fmtDay(s.unsubscribedAt)}` : `Unsubscribed · ${fmtDay(s.unsubscribedAt)}`}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {canInvite && s.kind === 'waitlist' && !!s.email && !s.unsubscribedAt && !s.joinedAt && (
                <Pressable
                  onPress={() => { void sendInvite(s.email); }}
                  disabled={!!inviting}
                  style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', paddingVertical: 4 }}
                >
                  <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                    {inviting === s.email
                      ? '…'
                      : s.invitedAt
                        ? (ar ? 'أعد إرسال الدعوة' : 'Send the invite again')
                        : (ar ? 'أرسل دعوة التطبيق' : 'Send app invite')}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}

          {!loading && items.length < total && (
            <Pressable onPress={() => { void load(items.length).catch(() => {}); }} style={{ alignItems: 'center', padding: 14 }}>
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'تحميل المزيد' : 'Load more'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 12, borderWidth: 1, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 999 },
});
