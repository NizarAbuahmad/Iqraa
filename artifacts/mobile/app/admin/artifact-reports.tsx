/**
 * The AI-artifact report queue — where a teacher's "بلّغ عن مشكلة" is
 * actually acted on. Structurally mirrors admin/moderation.tsx, but for
 * `ai_artifacts` reports instead of chat reports: system_admin only (not
 * school_admin — content quality isn't a per-school concern), and the only
 * two outcomes are approve (retire the artifact) or dismiss.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['system_admin'];

type Report = {
  id: string;
  status: 'open' | 'approved' | 'dismissed';
  createdAt: string;
  artifactId: string;
  kind: string;
  lessonRef: string;
  language: string;
  artifactRetiredAt: string | null;
  reporterId: string;
  reporterName: string;
};

type StatusFilter = 'open' | 'approved' | 'dismissed' | 'all';
const FILTERS: StatusFilter[] = ['open', 'approved', 'dismissed', 'all'];

export default function ArtifactReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const ar = lang === 'ar';
  const topPad = insets.top + (insets.top === 0 ? 20 : 0);

  const [reports, setReports] = useState<Report[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (which: StatusFilter) => {
    const q = which === 'all' ? '' : `?status=${which}`;
    const res = await apiJson<{ reports: Report[]; openCount: number }>(`/moderation/artifact-reports${q}`);
    setReports(res.reports);
    setOpenCount(res.openCount);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(filter)
      .catch((e: unknown) =>
        setError((ar ? 'تعذّر تحميل البلاغات: ' : 'Failed to load reports: ') + (e instanceof Error ? e.message : String(e))),
      )
      .finally(() => setLoading(false));
  }, [isAdmin, filter, load, ar]);

  const resolve = async (report: Report, outcome: 'approved' | 'dismissed') => {
    setBusyId(report.id);
    setError('');
    try {
      await apiJson(`/moderation/artifact-reports/${report.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      });
      await load(filter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmAndResolve = async (report: Report, outcome: 'approved' | 'dismissed') => {
    const ok = await confirm({
      title:
        outcome === 'approved'
          ? ar
            ? 'سحب هذه النسخة من المشترك؟'
            : 'Withdraw this version from the shared pool?'
          : ar
            ? 'تجاهل هذا البلاغ؟'
            : 'Dismiss this report?',
      confirmLabel: ar ? 'تأكيد' : 'Confirm',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
      destructive: outcome === 'approved',
    });
    if (ok) await resolve(report, outcome);
  };

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => goBack()} hitSlop={10} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={ar ? 'رجوع' : 'Back'} onPress={() => goBack()} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
          {ar ? 'بلاغات المحتوى' : 'Content reports'}
        </Text>
        <Text style={{ color: '#fff', opacity: 0.85, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {openCount === 0 ? (ar ? 'لا بلاغات مفتوحة' : 'No open reports') : ar ? `${openCount} بلاغ مفتوح` : `${openCount} open`}
        </Text>
      </View>

      <View style={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? ACCENT : colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: filter === f ? '#fff' : colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
              {labelFor(f, ar)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
            {error}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', marginTop: 40 }}>
            {ar ? 'لا شيء هنا.' : 'Nothing here.'}
          </Text>
        ) : (
          reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              colors={colors}
              ar={ar}
              isRTL={isRTL}
              busy={busyId === r.id}
              onApprove={() => confirmAndResolve(r, 'approved')}
              onDismiss={() => confirmAndResolve(r, 'dismissed')}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function labelFor(f: StatusFilter, ar: boolean): string {
  if (f === 'open') return ar ? 'مفتوحة' : 'Open';
  if (f === 'approved') return ar ? 'سُحبت' : 'Withdrawn';
  if (f === 'dismissed') return ar ? 'مرفوضة' : 'Dismissed';
  return ar ? 'الكل' : 'All';
}

function ReportCard({
  report, colors, ar, isRTL, busy, onApprove, onDismiss,
}: {
  report: Report;
  colors: ReturnType<typeof useColors>;
  ar: boolean;
  isRTL: boolean;
  busy: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const align = isRTL ? 'right' : 'left';
  const open = report.status === 'open';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
        {report.kind}
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19 }}>
          {'  '}{report.lessonRef || (ar ? '— بلا درس محدد —' : '— no lesson —')} · {report.language}
        </Text>
      </Text>

      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: align }}>
        {ar ? 'أبلغ عنه: ' : 'Reported by '}{report.reporterName}
        {' · '}{new Date(report.createdAt).toLocaleString()}
      </Text>

      <View style={[styles.badges, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Badge text={statusLabel(report.status, ar)} color={open ? colors.warning : colors.mutedForeground} colors={colors} />
        {report.artifactRetiredAt ? <Badge text={ar ? 'مسحوبة' : 'Retired'} color={colors.info} colors={colors} /> : null}
      </View>

      {busy ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 14 }} />
      ) : open ? (
        <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Action label={ar ? 'سحب النسخة' : 'Withdraw version'} onPress={onApprove} color={colors.destructive} colors={colors} />
          <Action label={ar ? 'تجاهل' : 'Dismiss'} onPress={onDismiss} color={colors.mutedForeground} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

function statusLabel(s: Report['status'], ar: boolean): string {
  if (s === 'open') return ar ? 'مفتوح' : 'Open';
  if (s === 'approved') return ar ? 'سُحبت' : 'Withdrawn';
  return ar ? 'مرفوض' : 'Dismissed';
}

function Badge({ text, color, colors }: { text: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.badge, { borderColor: color, borderRadius: colors.radius }]}>
      <Text style={{ color, fontFamily: 'ReadexPro_500Medium', fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function Action({ label, onPress, color, colors }: {
  label: string; onPress: () => void; color: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { borderColor: color, borderRadius: colors.radius, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={{ color, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { padding: 4, marginBottom: 8 },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  card: { borderWidth: 1, padding: 14, marginBottom: 12 },
  badges: { gap: 6, marginTop: 10, flexWrap: 'wrap' },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  actions: { gap: 8, marginTop: 14, flexWrap: 'wrap' },
  action: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
});
