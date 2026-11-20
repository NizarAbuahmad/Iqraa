/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * A system admin drafts an issue from the «ما الجديد» notes (services/newsletterDraft.ts),
 * edits it, sends a test copy to their own address, and only then may send it to teachers.
 * Nothing here is automatic. The send button is disabled until a test of the text on screen
 * has succeeded; the server enforces the same rule whatever this screen does
 * (api-server routes/adminNewsletter.ts), so an edit after the test needs a new test.
 *
 * Role-gated client-side like the other admin screens; enforcement is server-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson, ApiError } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { SPACE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { getT } from '@/services/i18n';
import { ammanToday } from '@/services/homework';
import { WHATS_NEW } from '@/services/whatsNew';
import { buildNewsletterDraft } from '@/services/newsletterDraft';

const ACCENT = '#4F46E5';

type Summary = { lastSentAt: string | null; eligible: number; unsubscribed: number };
/** The text a successful test covered. The send button is live only while the fields still match it. */
type Tested = { issueId: string; subject: string; body: string };

export default function AdminNewsletterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'system_admin';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tested, setTested] = useState<Tested | null>(null);
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSummary(await apiJson<Summary>('/admin/newsletter'));
      setLoadError('');
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  const textReady = subject.trim().length >= 3 && body.trim().length >= 10;
  // Trimmed, as the server trims before hashing.
  const matchesTest = !!tested && tested.subject === subject.trim() && tested.body === body.trim();

  const fillDraft = () => {
    if (!summary) return;
    const draft = buildNewsletterDraft({
      entries: WHATS_NEW,
      since: summary.lastSentAt ? ammanToday(new Date(summary.lastSentAt)) : null,
      today: ammanToday(),
      ar: getT('ar') as (key: string) => string,
      en: getT('en') as (key: string) => string,
    });
    if (draft.count === 0) {
      setNote(ar ? 'لا جديد للمعلّمين منذ آخر عدد.' : 'Nothing new for teachers since the last issue.');
      return;
    }
    setSubject(draft.subject);
    setBody(draft.body);
    setTested(null);
    setNote(ar ? `مسودة فيها ${draft.count} من الأخبار. عدّلها ثم أرسل نسخة لنفسك.` : `Notes in this draft: ${draft.count}. Edit it, then send yourself a copy.`);
  };

  const failed = (e: unknown): string => {
    const code = e instanceof ApiError ? e.message : '';
    if (code === 'not-tested') return ar ? 'النص تغيّر بعد النسخة التجريبية. أرسل نسخة تجريبية جديدة أولًا.' : 'The text changed after the test copy. Send a new test first.';
    if (code === 'test-expired') return ar ? 'مضى أكثر من 24 ساعة على النسخة التجريبية. أرسل نسخة جديدة أولًا.' : 'The test copy is more than 24 hours old. Send a new one first.';
    if (code === 'sending') return ar ? 'هذا العدد قيد الإرسال الآن. انتظر قليلًا.' : 'This issue is being sent right now. Wait a moment.';
    if (code === 'unsubscribed') return ar ? 'بريدك في قائمة إلغاء الاشتراك، فلا تصلك النسخة التجريبية.' : 'Your own address is unsubscribed, so the test copy cannot reach you.';
    return ar ? 'تعذّر الإرسال' : 'Could not send';
  };

  const sendTest = async () => {
    if (busy || !textReady) return;
    setBusy('test');
    setNote('');
    try {
      const r = await apiJson<{ issueId: string; sentTo: string }>('/admin/newsletter/test', {
        method: 'POST',
        body: JSON.stringify({ subject, body }),
      });
      setTested({ issueId: r.issueId, subject: subject.trim(), body: body.trim() });
      setNote(ar ? `أُرسلت نسخة تجريبية إلى ${r.sentTo}. اقرأها وافتح كل رابط قبل الإرسال.` : `Test copy sent to ${r.sentTo}. Read it and open every link before sending.`);
    } catch (e: unknown) {
      setNote(failed(e));
    } finally {
      setBusy('');
    }
  };

  const sendIssue = async () => {
    if (busy || !tested || !matchesTest || !summary || summary.eligible === 0) return;
    const ok = await confirm({
      title: ar ? 'إرسال العدد إلى المعلّمين؟' : 'Send this issue to teachers?',
      message: ar
        ? `سيُرسل إلى ما لا يزيد على ${summary.eligible} من المعلّمين، ومن وصله هذا العدد من قبل لا يُرسل إليه مرة أخرى. لا يمكن التراجع عن الإرسال.`
        : `This goes to at most ${summary.eligible} teachers; anyone who already received this issue is skipped. It can't be undone.`,
      confirmLabel: ar ? 'أرسل' : 'Send',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    setBusy('send');
    setNote('');
    try {
      const r = await apiJson<{ sent: number; failed: number; skipped: number }>('/admin/newsletter/send', {
        method: 'POST',
        body: JSON.stringify({ issueId: tested.issueId, subject, body }),
        timeoutMs: 180_000,
      });
      const skipped = r.skipped ? (ar ? ` · ألغوا الاشتراك: ${r.skipped}` : ` · Unsubscribed: ${r.skipped}`) : '';
      const retry = r.failed > 0 ? (ar ? ' · اضغط الإرسال مرة أخرى ليصل إلى من لم يصلهم فقط' : ' · press send again to reach only those who were missed') : '';
      setNote((ar ? `وصلت: ${r.sent} · تعذّرت: ${r.failed}` : `Sent: ${r.sent} · Failed: ${r.failed}`) + skipped + retry);
    } catch (e: unknown) {
      setNote(failed(e));
    } finally {
      setBusy('');
      void refresh();
    }
  };

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={ACCENT} /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'هذه الصفحة لمدير النظام فقط' : 'This page is for system admins only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const canSend = !busy && matchesTest && !!summary && summary.eligible > 0;
  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACE.page + SPACE.xl, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'نشرة المعلّمين' : 'Teacher newsletter'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: SPACE.md }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
              {summary === null
                ? (loadError ? (ar ? 'تعذّر التحميل' : 'Could not load') : '…')
                : ar
                  ? `عدد المعلّمين المستلمين: ${summary.eligible} · ألغوا الاشتراك: ${summary.unsubscribed}`
                  : `Teachers who would receive it: ${summary.eligible} · Unsubscribed: ${summary.unsubscribed}`}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
              {summary?.lastSentAt
                ? (ar ? `آخر عدد: ${ammanToday(new Date(summary.lastSentAt))}` : `Last issue: ${ammanToday(new Date(summary.lastSentAt))}`)
                : (ar ? 'لم يُرسل أي عدد بعد.' : 'No issue has been sent yet.')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
              {ar
                ? 'لا يُرسل شيء تلقائيًا. يُرسل العدد فقط بعد أن تصلك نسخة تجريبية من النص نفسه وتضغط الإرسال.'
                : 'Nothing is sent automatically. An issue goes out only after a test copy of the same text reaches you and you press send.'}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, gap: 8 }]}>
            <Pressable
              onPress={fillDraft}
              disabled={!summary || !!busy}
              accessibilityRole="button"
              style={[styles.chip, { alignSelf: isRTL ? 'flex-end' : 'flex-start', borderRadius: colors.radius, borderColor: ACCENT, opacity: !summary || busy ? 0.5 : 1 }]}
            >
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'أنشئ مسودة من «ما الجديد»' : "Draft from What's new"}</Text>
            </Pressable>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={ar ? 'عنوان الرسالة' : 'Subject'}
              placeholderTextColor={colors.mutedForeground}
              maxLength={150}
              style={input}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={ar ? 'نص الرسالة — سطر فارغ يفصل الفقرات، والروابط تصبح قابلة للنقر' : 'Message — a blank line starts a new paragraph; links become clickable'}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={14}
              maxLength={10000}
              style={[input, { minHeight: 280, textAlignVertical: 'top' }]}
            />
            <View style={{ flexDirection: row, gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => { void sendTest(); }}
                disabled={!!busy || !textReady}
                accessibilityRole="button"
                style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, opacity: busy || !textReady ? 0.5 : 1 }]}
              >
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                  {busy === 'test' ? '…' : ar ? 'أرسل لي نسخة تجريبية' : 'Send me a test copy'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { void sendIssue(); }}
                disabled={!canSend}
                accessibilityRole="button"
                aria-disabled={!canSend}
                style={[styles.chip, { borderRadius: colors.radius, backgroundColor: ACCENT, borderColor: ACCENT, opacity: canSend ? 1 : 0.5 }]}
              >
                <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                  {busy === 'send' ? '…' : ar ? `أرسل إلى المعلّمين (${summary?.eligible ?? 0})` : `Send to teachers (${summary?.eligible ?? 0})`}
                </Text>
              </Pressable>
            </View>
            {textReady && !matchesTest && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                {tested
                  ? (ar ? 'عدّلت النص بعد النسخة التجريبية: أرسل نسخة جديدة ليُفتح الإرسال.' : 'You edited the text after the test copy: send a new one to unlock sending.')
                  : (ar ? 'الإرسال إلى المعلّمين يُفتح بعد نسخة تجريبية من هذا النص.' : 'Sending to teachers unlocks after a test copy of this text.')}
              </Text>
            )}
            {!!note && (
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{note}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 12, borderWidth: 1, gap: SPACE.xs },
  chip: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderWidth: 1.5 },
});
