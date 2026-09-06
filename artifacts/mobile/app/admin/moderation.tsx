/**
 * The moderation queue — where reported messages are actually dealt with.
 *
 * `POST /messaging/reports` has existed since messaging shipped and nothing
 * ever read the rows, so the report button worked and no report could be
 * acted on. Apple's guideline 1.2 wants four things from an app carrying user
 * content: filtering, reporting, blocking, and the developer removing content
 * and ejecting the offender within 24 hours. This screen is the fourth.
 *
 * Role-gated client-side the same way `admin/dashboard.tsx` is — the real
 * enforcement is server-side, where every /moderation route is admin-only.
 * Strings are inline rather than in `services/i18n.ts`, matching the admin
 * dashboard: this is operator UI, not product UI.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { LEGAL_CONTACT_EMAIL } from '@/constants/legal';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['school_admin', 'system_admin'];

/**
 * What a suspended person is told. Deliberately not the reporter's own words:
 * a report's `reason` is written about someone, and echoing it back to them
 * as the official explanation republishes whatever it says.
 *
 * ponytail: one fixed sentence, no per-case text box. Add one when a
 * moderator asks for it — the endpoint already accepts `suspendReason`.
 */
const SUSPEND_REASON =
  `Your account was suspended following a report about your messages. ` +
  `To appeal, write to ${LEGAL_CONTACT_EMAIL}.`;

type Report = {
  id: string;
  reason: string;
  status: 'open' | 'reviewed' | 'dismissed';
  createdAt: string;
  threadId: string;
  threadTitle: string | null;
  messageId: string | null;
  messageBody: string | null;
  messageAttachmentKind: 'image' | 'audio' | 'document' | null;
  messageArchivedAt: string | null;
  reporterId: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
  reportedEmail: string;
  reportedRole: string;
  reportedSuspendedAt: string | null;
};

type StatusFilter = 'open' | 'reviewed' | 'dismissed' | 'all';
const FILTERS: StatusFilter[] = ['open', 'reviewed', 'dismissed', 'all'];

export default function ModerationScreen() {
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
    const res = await apiJson<{ reports: Report[]; openCount: number }>(`/moderation/reports${q}`);
    setReports(res.reports);
    setOpenCount(res.openCount);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(filter)
      // Same reasoning as the dashboard: show what actually failed. A bare
      // "couldn't load" sends the next person to devtools for a message the
      // error already carried.
      .catch((e: unknown) =>
        setError(
          (ar ? 'تعذّر تحميل البلاغات: ' : 'Failed to load reports: ') +
            (e instanceof Error ? e.message : String(e)),
        ),
      )
      .finally(() => setLoading(false));
  }, [isAdmin, filter, load, ar]);

  const act = async (
    report: Report,
    body: { outcome: 'reviewed' | 'dismissed'; hideMessage?: boolean; suspendUser?: boolean },
  ) => {
    setBusyId(report.id);
    setError('');
    try {
      await apiJson(`/moderation/reports/${report.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify(body.suspendUser ? { ...body, suspendReason: SUSPEND_REASON } : body),
      });
      await load(filter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmAndAct = async (
    report: Report,
    body: { outcome: 'reviewed' | 'dismissed'; hideMessage?: boolean; suspendUser?: boolean },
    question: string,
  ) => {
    const ok = await confirm({
      title: question,
      message: body.suspendUser
        ? ar
          ? `سيفقد ${report.reportedName} الدخول فورًا، ويمكن التراجع عن ذلك.`
          : `${report.reportedName} loses access immediately. This can be undone.`
        : undefined,
      confirmLabel: ar ? 'تأكيد' : 'Confirm',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (ok) await act(report, body);
  };

  const unsuspend = async (report: Report) => {
    const ok = await confirm({
      title: ar ? `رفع الإيقاف عن ${report.reportedName}؟` : `Lift the suspension on ${report.reportedName}?`,
      confirmLabel: ar ? 'رفع الإيقاف' : 'Lift suspension',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    setBusyId(report.id);
    setError('');
    try {
      await apiJson(`/moderation/users/${report.reportedId}/unsuspend`, { method: 'POST' });
      await load(filter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
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
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold' }}>{ar ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
          {ar ? 'البلاغات' : 'Reports'}
        </Text>
        <Text style={{ color: '#fff', opacity: 0.85, fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {openCount === 0
            ? ar ? 'لا بلاغات مفتوحة' : 'No open reports'
            : ar ? `${openCount} بلاغ مفتوح` : `${openCount} open`}
        </Text>
      </View>

      <View style={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? ACCENT : colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: filter === f ? '#fff' : colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>
              {labelFor(f, ar)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
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
          reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              colors={colors}
              ar={ar}
              isRTL={isRTL}
              busy={busyId === r.id}
              onHide={() =>
                confirmAndAct(r, { outcome: 'reviewed', hideMessage: true }, ar ? 'إخفاء الرسالة؟' : 'Hide this message?')
              }
              onHideAndSuspend={() =>
                confirmAndAct(
                  r,
                  { outcome: 'reviewed', hideMessage: true, suspendUser: true },
                  ar ? 'إخفاء الرسالة وإيقاف الحساب؟' : 'Hide the message and suspend the account?',
                )
              }
              onSuspend={() =>
                confirmAndAct(
                  r,
                  { outcome: 'reviewed', suspendUser: true },
                  ar ? 'إيقاف الحساب؟' : 'Suspend this account?',
                )
              }
              onDismiss={() => act(r, { outcome: 'dismissed' })}
              onUnsuspend={() => unsuspend(r)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function labelFor(f: StatusFilter, ar: boolean): string {
  if (f === 'open') return ar ? 'مفتوحة' : 'Open';
  if (f === 'reviewed') return ar ? 'عولجت' : 'Actioned';
  if (f === 'dismissed') return ar ? 'مرفوضة' : 'Dismissed';
  return ar ? 'الكل' : 'All';
}

function ReportCard({
  report, colors, ar, isRTL, busy,
  onHide, onHideAndSuspend, onSuspend, onDismiss, onUnsuspend,
}: {
  report: Report;
  colors: ReturnType<typeof useColors>;
  ar: boolean;
  isRTL: boolean;
  busy: boolean;
  onHide: () => void;
  onHideAndSuspend: () => void;
  onSuspend: () => void;
  onDismiss: () => void;
  onUnsuspend: () => void;
}) {
  const align = isRTL ? 'right' : 'left';
  const open = report.status === 'open';
  const alreadyHidden = !!report.messageArchivedAt;
  const suspended = !!report.reportedSuspendedAt;
  // A report with no message names a person, not a post — and so does one
  // whose message has since been deleted (messageId is `set null`). Either
  // way there is nothing to hide, so the button would be a dead end.
  const hideable = !!report.messageId && !alreadyHidden;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
        {report.reportedName}
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>
          {'  '}{report.reportedEmail} · {report.reportedRole}
        </Text>
      </Text>

      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 4, textAlign: align }}>
        {ar ? 'أبلغ عنه: ' : 'Reported by '}{report.reporterName}
        {' · '}{new Date(report.createdAt).toLocaleString()}
        {report.threadTitle ? ` · ${report.threadTitle}` : ''}
      </Text>

      {report.reason ? (
        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 10, textAlign: align }}>
          {ar ? 'السبب: ' : 'Reason: '}{report.reason}
        </Text>
      ) : null}

      <View style={[styles.quote, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
          {report.messageId === null
            ? (ar ? '— لم يُحدَّد نصّ رسالة —' : '— no message named —')
            : report.messageBody?.trim()
              ? report.messageBody
              : (ar ? '— رسالة بلا نصّ —' : '— message with no text —')}
        </Text>
        {report.messageAttachmentKind ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 6, textAlign: align }}>
            {ar ? 'مرفق: ' : 'Attachment: '}{report.messageAttachmentKind}
          </Text>
        ) : null}
      </View>

      <View style={[styles.badges, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Badge text={statusLabel(report.status, ar)} color={open ? colors.warning : colors.mutedForeground} colors={colors} />
        {alreadyHidden ? <Badge text={ar ? 'مخفيّة' : 'Hidden'} color={colors.info} colors={colors} /> : null}
        {suspended ? <Badge text={ar ? 'موقوف' : 'Suspended'} color={colors.destructive} colors={colors} /> : null}
      </View>

      {busy ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 14 }} />
      ) : (
        <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {open && hideable ? (
            <Action label={ar ? 'إخفاء' : 'Hide'} onPress={onHide} color={colors.info} colors={colors} />
          ) : null}
          {open && !suspended && hideable ? (
            <Action label={ar ? 'إخفاء وإيقاف' : 'Hide + suspend'} onPress={onHideAndSuspend} color={colors.destructive} colors={colors} />
          ) : null}
          {open && !suspended && !hideable ? (
            <Action label={ar ? 'إيقاف الحساب' : 'Suspend'} onPress={onSuspend} color={colors.destructive} colors={colors} />
          ) : null}
          {open ? (
            <Action label={ar ? 'رفض البلاغ' : 'Dismiss'} onPress={onDismiss} color={colors.mutedForeground} colors={colors} />
          ) : null}
          {suspended ? (
            <Action label={ar ? 'رفع الإيقاف' : 'Lift suspension'} onPress={onUnsuspend} color={colors.success} colors={colors} />
          ) : null}
        </View>
      )}
    </View>
  );
}

function statusLabel(s: Report['status'], ar: boolean): string {
  if (s === 'open') return ar ? 'مفتوح' : 'Open';
  if (s === 'reviewed') return ar ? 'عولج' : 'Actioned';
  return ar ? 'مرفوض' : 'Dismissed';
}

function Badge({ text, color, colors }: { text: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.badge, { borderColor: color, borderRadius: colors.radius }]}>
      <Text style={{ color, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>{text}</Text>
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
      style={({ pressed }) => [
        styles.action,
        { borderColor: color, borderRadius: colors.radius, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ color, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>{label}</Text>
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
  quote: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 10 },
  badges: { gap: 6, marginTop: 10, flexWrap: 'wrap' },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  actions: { gap: 8, marginTop: 14, flexWrap: 'wrap' },
  action: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
});
