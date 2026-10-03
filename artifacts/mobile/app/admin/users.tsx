/**
 * Users & blocking — search every account, see who is suspended, block or
 * unblock. Blocking is the existing suspension (the API 403s every route but
 * /auth/me and account deletion); unblocking reuses moderation's unsuspend.
 *
 * Role-gated client-side like `admin/dashboard.tsx`; the real enforcement is
 * server-side. Strings inline, as on the other admin screens.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { LEGAL_CONTACT_EMAIL } from '@/constants/legal';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['school_admin', 'system_admin'];

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  google: boolean;
  createdAt: string;
  lastLogin: string | null;
  suspendedAt: string | null;
  suspendedReason: string;
  monthSpendUsd: number;
};

/** What the blocked person is shown — written to them, editable per block. */
const DEFAULT_REASON =
  `Your account has been suspended. Contact ${LEGAL_CONTACT_EMAIL} if you think this is a mistake.`;

export default function AdminUsersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [q, setQ] = useState('');
  const [onlySuspended, setOnlySuspended] = useState(false);
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(async (offset: number) => {
    const params = `q=${encodeURIComponent(q)}&status=${onlySuspended ? 'suspended' : 'all'}&offset=${offset}`;
    const res = await apiJson<{ items: UserRow[]; total: number }>(`/admin/users?${params}`);
    setItems(cur => (offset === 0 ? res.items : [...cur, ...res.items]));
    setTotal(res.total);
  }, [q, onlySuspended]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    // Debounced so typing a search doesn't fire a request per keystroke.
    const t = setTimeout(() => {
      load(0)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [isAdmin, load]);

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError('');
    try {
      await fn();
      await load(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const block = async (u: UserRow, reason: string) => {
    const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
    const ok = await confirm({
      title: ar ? `حظر ${name}؟` : `Block ${name}?`,
      message: ar ? 'يفقد الدخول فورًا، ويمكن التراجع عن ذلك.' : 'They lose access immediately. This can be undone.',
      confirmLabel: ar ? 'حظر' : 'Block',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    setBlocking(null);
    await run(u.id, () => apiJson(`/admin/users/${u.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }));
  };

  const unblock = async (u: UserRow) => {
    const ok = await confirm({
      title: ar ? `رفع الحظر عن ${u.email}؟` : `Unblock ${u.email}?`,
      confirmLabel: ar ? 'رفع الحظر' : 'Unblock',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
    });
    if (ok) await run(u.id, () => apiJson(`/moderation/users/${u.id}/unsuspend`, { method: 'POST' }));
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
  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => goBack()} hitSlop={10} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'المستخدمون والحظر' : 'Users & blocking'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 10 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={ar ? 'ابحث بالاسم أو البريد' : 'Search name or email'}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { flex: 1, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: align }]}
            />
            <Pressable
              onPress={() => setOnlySuspended(v => !v)}
              style={[styles.chip, { borderRadius: colors.radius, backgroundColor: onlySuspended ? ACCENT : colors.card, borderColor: onlySuspended ? ACCENT : colors.border }]}
            >
              <Text style={{ color: onlySuspended ? '#fff' : colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                {ar ? 'المحظورون فقط' : 'Blocked only'}
              </Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
            {ar ? `${total} حساب` : `${total} accounts`}
          </Text>
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}

          {loading ? <ActivityIndicator color={ACCENT} /> : items.map(u => {
            const isAdminRow = ADMIN_ROLES.includes(u.role);
            return (
              <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: u.suspendedAt ? colors.destructive : colors.border, borderRadius: colors.radius }]}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
                      {`${u.firstName} ${u.lastName}`.trim() || '—'} · <Text style={{ color: colors.mutedForeground }}>{u.role}</Text>
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, textAlign: align }}>
                      {u.email} · {u.google ? 'Google' : (ar ? 'كلمة مرور' : 'password')}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: align }}>
                      {ar ? 'انضم' : 'Joined'} {date(u.createdAt)} · {ar ? 'آخر دخول' : 'Last login'} {date(u.lastLogin)} · AI ${u.monthSpendUsd.toFixed(3)}
                    </Text>
                    {!!u.suspendedAt && (
                      <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: align }}>
                        {ar ? 'محظور منذ' : 'Blocked since'} {date(u.suspendedAt)}{u.suspendedReason ? ` — ${u.suspendedReason}` : ''}
                      </Text>
                    )}
                  </View>
                  {busyId === u.id ? <ActivityIndicator color={ACCENT} /> : isAdminRow ? null : u.suspendedAt ? (
                    <Pressable onPress={() => unblock(u)} style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT }]}>
                      <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'رفع الحظر' : 'Unblock'}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setBlocking({ id: u.id, reason: DEFAULT_REASON })} style={[styles.chip, { borderRadius: colors.radius, borderColor: colors.destructive }]}>
                      <Text style={{ color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'حظر' : 'Block'}</Text>
                    </Pressable>
                  )}
                </View>
                {blocking?.id === u.id && (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                      {ar ? 'الرسالة التي سيراها صاحب الحساب:' : 'Message the account owner will see:'}
                    </Text>
                    <TextInput
                      value={blocking.reason}
                      onChangeText={reason => setBlocking({ id: u.id, reason })}
                      multiline
                      style={[styles.input, { minHeight: 60, borderColor: colors.border, borderRadius: colors.radius, color: colors.foreground, textAlign: align }]}
                    />
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                      <Pressable onPress={() => block(u, blocking.reason)} style={[styles.chip, { borderRadius: colors.radius, backgroundColor: colors.destructive, borderColor: colors.destructive }]}>
                        <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'تأكيد الحظر' : 'Block'}</Text>
                      </Pressable>
                      <Pressable onPress={() => setBlocking(null)} style={[styles.chip, { borderRadius: colors.radius, borderColor: colors.border }]}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'إلغاء' : 'Cancel'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

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
  card: { padding: 12, borderWidth: 1, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'Almarai_400Regular', fontSize: 13 },
});
