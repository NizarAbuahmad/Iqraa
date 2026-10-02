/**
 * Collected emails — iqrra.com's waitlist and contact-form submissions, which
 * the site's Vercel functions copy into `site_signups` (POST /api/site/signups).
 * Signups from before that existed live only in Resend / the FEEDBACK_TO inbox.
 *
 * Role-gated client-side like `admin/dashboard.tsx`; enforcement is server-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, apiJson } from '@/services/apiClient';
import { goBack } from '@/services/navigation';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['school_admin', 'system_admin'];

type Signup = { id: string; kind: 'waitlist' | 'contact'; email: string; name: string; message: string; context: string; createdAt: string };
type Kind = 'all' | 'waitlist' | 'contact';

export default function AdminSignupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [kind, setKind] = useState<Kind>('all');
  const [items, setItems] = useState<Signup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const kindParam = kind === 'all' ? '' : `kind=${kind}&`;

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
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold' }}>{ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const chips: [Kind, string, string][] = [['all', 'الكل', 'All'], ['waitlist', 'قائمة الانتظار', 'Waitlist'], ['contact', 'رسائل التواصل', 'Contact']];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => goBack()} hitSlop={10} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'البريد المجمّع من iqrra.com' : 'Emails collected on iqrra.com'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 10 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {chips.map(([k, a, e]) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.chip, { borderRadius: colors.radius, backgroundColor: kind === k ? ACCENT : colors.card, borderColor: kind === k ? ACCENT : colors.border }]}
              >
                <Text style={{ color: kind === k ? '#fff' : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>{ar ? a : e}</Text>
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {Platform.OS === 'web' && (
              <Pressable onPress={exportCsv} style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                <Ionicons name="download-outline" size={15} color={ACCENT} />
                <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>{ar ? 'تصدير CSV' : 'Export CSV'}</Text>
              </Pressable>
            )}
          </View>
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
                <Ionicons name={s.kind === 'waitlist' ? 'mail-outline' : 'chatbubble-outline'} size={15} color={ACCENT} />
                <Text selectable style={{ flex: 1, color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 13.5, textAlign: align }}>
                  {s.email || s.name || '—'}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>{new Date(s.createdAt).toLocaleString()}</Text>
              </View>
              {!!s.name && !!s.email && <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>{s.name}</Text>}
              {!!s.message && <Text selectable style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{s.message}</Text>}
              {!!s.context && <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: align }}>{s.context}</Text>}
            </View>
          ))}

          {!loading && items.length < total && (
            <Pressable onPress={() => { void load(items.length).catch(() => {}); }} style={{ alignItems: 'center', padding: 14 }}>
              <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{ar ? 'تحميل المزيد' : 'Load more'}</Text>
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
});
