/**
 * Admin dashboard — feedback (real product data, our own DB) plus usage
 * counts pulled from data already stored (users, saved materials,
 * evaluations). Deliberately doesn't try to rebuild PostHog's own
 * screen-by-screen/trace analytics here — see STATUS.md — it links out to
 * the PostHog project for that instead of duplicating a second pipeline.
 *
 * Role-gated client-side (redirect away from a screen a non-admin shouldn't
 * see) — the real enforcement is server-side: GET /admin/usage-summary and
 * GET /feedback both 403 for anything but school_admin/system_admin.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { openExternal } from '@/services/externalLinks';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { goBack } from '@/services/navigation';
import { confirm } from '@/services/confirm';
import { ACCENT, Bar, FilterChip, KeyValue, SectionTitle, StatCard, Table } from '@/components/admin/widgets';
import { DateRange, EMPTY_RANGE, rangeQuery, type Range } from '@/components/admin/DateRange';
import { palette } from '@/constants/colors';
import { BackButton } from '@/components/ui/BackButton';

const ADMIN_ROLES = ['school_admin', 'system_admin'];

type UsageSummary = {
  totalUsers: number;
  totalEvaluations: number;
  /** Accounts with a password and no linked Google account — see the card below. */
  usersWithoutRecovery: number;
  materialsByType: Record<string, number>;
  feedbackByRating: Record<string, number>;
  usersByRole: { role: string; count: number; suspended: number }[];
  signupPlatforms: { platform: string; count: number }[];
  suspendedCount: number;
  signupsByDay: { day: string; role: string; count: number }[];
  authSplit: { google: number; password: number };
  activeUsers7d: number;
  activeUsers30d: number;
  ai: {
    budget: { liveMode: boolean; spentUsd: number; limitUsd: number; generationModel: string; chatModel: string };
    byKind: { kind: string; count: number; hits: number; costUsd: number; p50Ms: number | null; p95Ms: number | null }[];
    topSpenders: { userId: string; email: string; role: string; costUsd: number; count: number }[];
  };
  classes: { classes: number; students: number; students30d: number };
  parentLetters: { channel: string; total: number; last30d: number }[];
  siteSignups: { waitlist: number; contact: number };
  limits: {
    userBudgetUsd: number;
    studentBudgetUsd: number;
    rateLimits: { name: string; windowMs: number; max: number }[];
  };
};

type MetricRow = { key: string; value: number; date: string };

/** Must match METRIC_KEYS in api-server lib/adminMetrics.ts. */
const METRICS: { key: string; ar: string; en: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'play_downloads', ar: 'تنزيلات Google Play', en: 'Play downloads', icon: 'logo-google-playstore' },
  { key: 'instagram', ar: 'Instagram', en: 'Instagram', icon: 'logo-instagram' },
  { key: 'facebook', ar: 'Facebook', en: 'Facebook', icon: 'logo-facebook' },
  { key: 'youtube', ar: 'YouTube', en: 'YouTube', icon: 'logo-youtube' },
  { key: 'linkedin', ar: 'LinkedIn', en: 'LinkedIn', icon: 'logo-linkedin' },
  { key: 'x', ar: 'X', en: 'X', icon: 'logo-twitter' },
];

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const secs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const windowLabel = (ms: number) =>
  ms >= 3_600_000 ? `${ms / 3_600_000}h` : ms >= 60_000 ? `${ms / 60_000}m` : `${ms / 1000}s`;

type FeedbackItem = {
  id: string;
  materialType: string;
  toolId: string;
  /** 'idea' is a «اقترح ميزة» suggestion (materialType 'feature_request'). */
  rating: 'up' | 'down' | 'idea';
  comment: string;
  createdAt: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
};

type RatingFilter = 'all' | 'up' | 'down' | 'idea';
const PAGE_SIZE = 30;

export default function AdminDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang, t } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const topPad = insets.top + (insets.top === 0 ? 20 : 0);

  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<RatingFilter>('all');
  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const viewportW = useViewportWidth();
  const isDesktop = Platform.OS === 'web' && viewportW >= DESKTOP_BREAKPOINT;
  const centered = { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };

  const load = useCallback(async (nextFilter: RatingFilter, r: Range, offset: number) => {
    const ratingParam = nextFilter === 'all' ? '' : `&rating=${nextFilter}`;
    const [summaryRes, feedbackRes, metricsRes] = await Promise.all([
      offset === 0 ? apiJson<UsageSummary>('/admin/usage-summary') : Promise.resolve(null),
      apiJson<{ items: FeedbackItem[]; total: number }>(`/feedback?limit=${PAGE_SIZE}&offset=${offset}${ratingParam}${rangeQuery(r)}`),
      offset === 0 ? apiJson<{ items: MetricRow[] }>('/admin/metrics') : Promise.resolve(null),
    ]);
    if (summaryRes) setSummary(summaryRes);
    if (metricsRes) setMetrics(metricsRes.items);
    setItems(cur => (offset === 0 ? feedbackRes.items : [...cur, ...feedbackRes.items]));
    setTotal(feedbackRes.total);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(filter, range, 0)
      // Show what actually failed. A bare "couldn't load" sent this screen's
      // first real user hunting through browser devtools for a 500 that turned
      // out to be a missing table — the message was already in the error.
      .catch((e: unknown) => setError(
        (lang === 'ar' ? 'تعذّر تحميل البيانات: ' : 'Failed to load dashboard data: ')
        + (e instanceof Error ? e.message : String(e)),
      ))
      .finally(() => setLoading(false));
  }, [isAdmin, filter, range, load, lang]);

  const removeFeedback = async (item: FeedbackItem) => {
    const ok = await confirm({
      title: lang === 'ar' ? 'حذف هذه الملاحظة؟' : 'Delete this note?',
      confirmLabel: lang === 'ar' ? 'حذف' : 'Delete',
      cancelLabel: lang === 'ar' ? 'إلغاء' : 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/feedback/${item.id}`, { method: 'DELETE' });
      setItems(cur => cur.filter(i => i.id !== item.id));
      setTotal(t => t - 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      await load(filter, range, items.length);
    } catch {
      // A failed "load more" just leaves the list where it was.
    } finally {
      setLoadingMore(false);
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
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {lang === 'ar' ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => goBack()} hitSlop={10} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold' }}>{lang === 'ar' ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[{ paddingBottom: 60 }, centered]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
            {t('adminDashboard')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : error ? (
          <Text style={{ color: colors.destructive, textAlign: 'center', margin: 20, fontFamily: 'Almarai_400Regular' }}>{error}</Text>
        ) : (
          <>
            {/* Moderation first: reported messages carry a 24-hour obligation
                (Apple 1.2) and usage counts do not. */}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 20, marginBottom: 16 }}>
              {([
                ['/admin/moderation', 'flag-outline', 'بلاغات الرسائل', 'Message reports'],
                ['/admin/artifact-reports', 'document-text-outline', 'بلاغات المحتوى', 'Content reports'],
                ['/admin/users', 'people-outline', 'المستخدمون والحظر', 'Users & blocking'],
                ['/admin/signups', 'mail-outline', 'البريد المجمّع', 'Collected emails'],
                ['/admin/ai-costs', 'cash-outline', 'تكاليف الذكاء الاصطناعي', 'AI costs'],
              ] as const).map(([href, icon, ar, en]) => (
                <Pressable
                  key={href}
                  onPress={() => router.push(href as any)}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 10,
                      flexGrow: 1,
                      flexBasis: 220,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name={icon} size={20} color={ACCENT} />
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? ar : en}
                  </Text>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>

            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <SectionTitle text={lang === 'ar' ? 'نظرة عامة' : 'Overview'} isRTL={isRTL} colors={colors} />
                <View style={[styles.statRow, { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }]}>
                  <StatCard label={lang === 'ar' ? 'كل الحسابات' : 'All accounts'} value={summary.totalUsers} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'نشطون ٧ أيام' : 'Active 7d'} value={summary.activeUsers7d} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'نشطون ٣٠ يومًا' : 'Active 30d'} value={summary.activeUsers30d} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'قائمة الانتظار' : 'Waitlist emails'} value={summary.siteSignups.waitlist} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'رسائل التواصل' : 'Contact messages'} value={summary.siteSignups.contact} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'محظورون' : 'Blocked'} value={summary.suspendedCount} colors={colors} />
                </View>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10 }]}>
                  {summary.usersByRole.map(r => (
                    <KeyValue key={r.role} k={r.role} v={String(r.count)} isRTL={isRTL} colors={colors} />
                  ))}
                  <KeyValue
                    k={lang === 'ar' ? 'دخول Google / كلمة مرور' : 'Google / password sign-in'}
                    v={`${summary.authSplit.google} / ${summary.authSplit.password}`}
                    isRTL={isRTL}
                    colors={colors}
                  />
                  <KeyValue
                    k={lang === 'ar' ? 'انضموا عبر (التطبيق / الويب)' : 'Joined via (app / web)'}
                    v={summary.signupPlatforms.map(p => `${p.platform} ${p.count}`).join(' · ')}
                    isRTL={isRTL}
                    colors={colors}
                  />
                </View>
              </View>
            )}

            <GrowthSection
              metrics={metrics}
              onSaved={() => apiJson<{ items: MetricRow[] }>('/admin/metrics').then(r => setMetrics(r.items))}
              isRTL={isRTL}
              ar={lang === 'ar'}
              colors={colors}
            />

            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <SectionTitle text={lang === 'ar' ? 'التسجيلات — آخر ٣٠ يومًا' : 'Signups — last 30 days'} isRTL={isRTL} colors={colors} />
                <SignupBars rows={summary.signupsByDay} ar={lang === 'ar'} isRTL={isRTL} colors={colors} />
              </View>
            )}

            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <SectionTitle text={lang === 'ar' ? 'الذكاء الاصطناعي: الاستخدام والتكلفة والأداء (هذا الشهر)' : 'AI usage, cost & performance (this month)'} isRTL={isRTL} colors={colors} />
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <KeyValue
                    k={lang === 'ar' ? 'الإنفاق / السقف' : 'Spent / cap'}
                    v={`${usd(summary.ai.budget.spentUsd)} / ${usd(summary.ai.budget.limitUsd)}`}
                    isRTL={isRTL}
                    colors={colors}
                  />
                  <Bar ratio={summary.ai.budget.limitUsd ? summary.ai.budget.spentUsd / summary.ai.budget.limitUsd : 0} isRTL={isRTL} colors={colors} />
                  <KeyValue
                    k={lang === 'ar' ? 'الوضع' : 'Mode'}
                    v={`${summary.ai.budget.liveMode ? 'live' : 'off'} · ${summary.ai.budget.generationModel} · chat ${summary.ai.budget.chatModel}`}
                    isRTL={isRTL}
                    colors={colors}
                  />
                </View>
                <Table
                  head={lang === 'ar' ? ['النوع', 'العدد', 'من المخزن', 'التكلفة', 'p50', 'p95'] : ['Kind', 'Calls', 'Cache hits', 'Cost', 'p50', 'p95']}
                  rows={summary.ai.byKind.map(k => [k.kind, String(k.count), String(k.hits), usd(k.costUsd), secs(k.p50Ms), secs(k.p95Ms)])}
                  empty={lang === 'ar' ? 'لا توليد هذا الشهر' : 'No generations this month'}
                  isRTL={isRTL}
                  colors={colors}
                />
                {summary.ai.topSpenders.length > 0 && (
                  <Table
                    head={lang === 'ar' ? ['الأعلى إنفاقًا', 'الدور', 'الطلبات', 'التكلفة'] : ['Top spenders', 'Role', 'Calls', 'Cost']}
                    rows={summary.ai.topSpenders.map(s => [s.email, s.role, String(s.count), usd(s.costUsd)])}
                    isRTL={isRTL}
                    colors={colors}
                  />
                )}
                <Pressable
                  onPress={() => { void openExternal('https://console.cloud.google.com/run?project=iqraa-auth-507315'); }}
                  style={[styles.posthogLink, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="speedometer-outline" size={15} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'زمن استجابة الخادم ونسبة الأخطاء في Cloud Run' : 'Server latency & error rate in Cloud Run'}
                  </Text>
                  <Ionicons name="open-outline" size={13} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <SectionTitle text={lang === 'ar' ? 'الشُّعب وأولياء الأمور' : 'Classes & parents'} isRTL={isRTL} colors={colors} />
                <View style={[styles.statRow, { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }]}>
                  <StatCard label={lang === 'ar' ? 'الشُّعب' : 'Classes'} value={summary.classes.classes} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'الطلاب' : 'Students'} value={summary.classes.students} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'طلاب جدد ٣٠ يومًا' : 'New students 30d'} value={summary.classes.students30d} colors={colors} />
                </View>
                <Table
                  head={lang === 'ar' ? ['رسائل الأهل حسب القناة', 'الكل', '٣٠ يومًا'] : ['Parent letters by channel', 'Total', '30d']}
                  rows={summary.parentLetters.map(p => [p.channel, String(p.total), String(p.last30d)])}
                  empty={lang === 'ar' ? 'لا رسائل بعد' : 'No letters yet'}
                  isRTL={isRTL}
                  colors={colors}
                />
              </View>
            )}

            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <SectionTitle text={lang === 'ar' ? 'الحدود' : 'Limits'} isRTL={isRTL} colors={colors} />
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <KeyValue
                    k={lang === 'ar' ? 'سقف المعلم الشهري (AI_USER_BUDGET_USD)' : 'Teacher monthly cap (AI_USER_BUDGET_USD)'}
                    v={summary.limits.userBudgetUsd ? usd(summary.limits.userBudgetUsd) : (lang === 'ar' ? 'بلا سقف' : 'none')}
                    isRTL={isRTL}
                    colors={colors}
                  />
                  <KeyValue
                    k={lang === 'ar' ? 'سقف الطالب الشهري (AI_STUDENT_BUDGET_USD)' : 'Student monthly cap (AI_STUDENT_BUDGET_USD)'}
                    v={summary.limits.studentBudgetUsd ? usd(summary.limits.studentBudgetUsd) : (lang === 'ar' ? 'بلا سقف' : 'none')}
                    isRTL={isRTL}
                    colors={colors}
                  />
                </View>
                <Table
                  head={lang === 'ar' ? ['حدّ المعدّل', 'الأقصى', 'لكل'] : ['Rate limit', 'Max', 'Per']}
                  rows={summary.limits.rateLimits.map(l => [l.name, String(l.max), windowLabel(l.windowMs)])}
                  isRTL={isRTL}
                  colors={colors}
                />
              </View>
            )}

            {/* Usage summary */}
            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {lang === 'ar' ? 'الاستخدام' : 'Usage'}
                </Text>
                <View style={[styles.statRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <StatCard label={lang === 'ar' ? 'التقييمات' : 'Evaluations'} value={summary.totalEvaluations} colors={colors} />
                  <StatCard
                    label={lang === 'ar' ? 'الملاحظات' : 'Feedback'}
                    value={(summary.feedbackByRating.up ?? 0) + (summary.feedbackByRating.down ?? 0)}
                    colors={colors}
                  />
                  <StatCard
                    label={lang === 'ar' ? 'اقتراحات الميزات' : 'Feature ideas'}
                    value={summary.feedbackByRating.idea ?? 0}
                    colors={colors}
                  />
                </View>
                {/*
                  Not a usage number, which is why it sits outside the row above:
                  it is the count of people who cannot get back into their own
                  account. Password reset was removed on 2026-09-10 with no email
                  provider to replace it, so a forgotten password here costs an
                  out-of-band conversation with an admin. Watch it — if it grows,
                  the answer is a real reset flow, not more admin tooling.
                */}
                {summary.usersWithoutRecovery > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10 }]}>
                    <View style={[styles.barRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Text style={[styles.cardLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', flex: 1, textAlign: isRTL ? 'right' : 'left', marginBottom: 0 }]}>
                        {lang === 'ar' ? 'حسابات لا يمكن استعادتها' : 'Accounts with no way back in'}
                      </Text>
                      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 20 }}>
                        {summary.usersWithoutRecovery}
                      </Text>
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                      {lang === 'ar'
                        ? 'تدخل بكلمة مرور ولا حساب Google لها. إن نسي أصحابها كلمة المرور فلا سبيل إلى استعادتها إلا بتدخّل مشرف.'
                        : 'They sign in with a password and have no Google account. If the owner forgets it, only an admin can get them back in.'}
                    </Text>
                  </View>
                )}
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10 }]}>
                  <Text style={[styles.cardLabel, { color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                    {lang === 'ar' ? 'المواد المحفوظة حسب النوع' : 'Saved materials by type'}
                  </Text>
                  {Object.entries(summary.materialsByType).length === 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20 }}>
                      {lang === 'ar' ? 'لا يوجد بعد' : 'None yet'}
                    </Text>
                  ) : (
                    Object.entries(summary.materialsByType).map(([type, count]) => (
                      <View key={type} style={[styles.barRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{type}</Text>
                        <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_700Bold', fontSize: 13 }}>{count}</Text>
                      </View>
                    ))
                  )}
                </View>
                <Pressable
                  onPress={() => { void openExternal('https://us.posthog.com'); }}
                  style={[styles.posthogLink, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="analytics-outline" size={15} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
                    {lang === 'ar' ? 'افتح PostHog لبيانات الاستخدام التفصيلية (الشاشات، الأدوات)' : 'Open PostHog for detailed usage/trace data (screens, tools)'}
                  </Text>
                  <Ionicons name={isRTL ? 'open-outline' : 'open-outline'} size={13} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {/* Feedback */}
            <View style={{ marginHorizontal: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {lang === 'ar' ? 'ملاحظات المعلمين' : 'Teacher feedback'}
              </Text>
              <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <FilterChip label={lang === 'ar' ? 'الكل' : 'All'} active={filter === 'all'} onPress={() => setFilter('all')} colors={colors} />
                <FilterChip label="👍" active={filter === 'up'} onPress={() => setFilter('up')} colors={colors} />
                <FilterChip label="👎" active={filter === 'down'} onPress={() => setFilter('down')} colors={colors} />
                <FilterChip label={lang === 'ar' ? '💡 اقتراحات' : '💡 Ideas'} active={filter === 'idea'} onPress={() => setFilter('idea')} colors={colors} />
              </View>
              <DateRange value={range} onChange={setRange} ar={lang === 'ar'} isRTL={isRTL} colors={colors} />

              {items.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 12, textAlign: 'center' }}>
                  {lang === 'ar' ? 'لا توجد ملاحظات بعد' : 'No feedback yet'}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {items.map(item => (
                    <View key={item.id} style={{ width: isDesktop ? '32%' : '100%' }}>
                      <FeedbackRow item={item} isRTL={isRTL} colors={colors} onDelete={() => removeFeedback(item)} />
                    </View>
                  ))}
                </View>
              )}

              {items.length < total && (
                <Pressable onPress={loadMore} disabled={loadingMore} style={{ alignItems: 'center', padding: 14 }}>
                  {loadingMore
                    ? <ActivityIndicator size="small" color={ACCENT} />
                    : <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{lang === 'ar' ? 'تحميل المزيد' : 'Load more'}</Text>}
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One bar per day for the last 30 days, height = signups that day, all roles. */
function SignupBars({ rows, ar, isRTL, colors }: { rows: UsageSummary['signupsByDay']; ar: boolean; isRTL: boolean; colors: any }) {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.count);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10));
  const max = Math.max(1, ...days.map(d => byDay.get(d) ?? 0));
  const total = days.reduce((n, d) => n + (byDay.get(d) ?? 0), 0);
  const byRole = new Map<string, number>();
  for (const r of rows) byRole.set(r.role, (byRole.get(r.role) ?? 0) + r.count);
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-end', height: 90, gap: 2 }}>
        {days.map(d => {
          const n = byDay.get(d) ?? 0;
          return (
            <View key={d} style={{ flex: 1, height: `${(n / max) * 100}%`, minHeight: n ? 3 : 1, backgroundColor: n ? ACCENT : colors.border, borderRadius: 2 }}
              // Hover tooltip on web: the day and its count.
              {...({ title: `${d}: ${n}` } as object)} />
          );
        })}
      </View>
      <KeyValue
        k={ar ? 'المجموع حسب الدور' : 'Total by role'}
        v={`${total} — ${[...byRole].map(([r, n]) => `${r} ${n}`).join(' · ') || '—'}`}
        isRTL={isRTL}
        colors={colors}
      />
    </View>
  );
}

/**
 * Hand-entered numbers from Play Console and each social platform. Shows the
 * latest value and the change since the previous entry; the form below
 * records today's (or a past day's) figure — the same day again replaces it.
 */
function GrowthSection({ metrics, onSaved, isRTL, ar, colors }: {
  metrics: MetricRow[];
  onSaved: () => Promise<unknown>;
  isRTL: boolean;
  ar: boolean;
  colors: any;
}) {
  const [key, setKey] = useState(METRICS[0].key);
  const [value, setValue] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      await apiJson('/admin/metrics', { method: 'POST', body: JSON.stringify({ key, value: Number(value), date }) });
      await onSaved();
      setValue('');
      setMsg(ar ? 'حُفظ' : 'Saved');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13 };

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
      <SectionTitle text={ar ? 'التنزيلات والمتابعون' : 'Downloads & followers'} isRTL={isRTL} colors={colors} />
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 }}>
        {METRICS.map(m => {
          const hist = metrics.filter(r => r.key === m.key);
          const last = hist[hist.length - 1];
          const prev = hist[hist.length - 2];
          const delta = last && prev ? last.value - prev.value : null;
          return (
            <View key={m.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, flexGrow: 1, flexBasis: 150 }]}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={m.icon} size={15} color={ACCENT} />
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>{ar ? m.ar : m.en}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
                {last ? last.value.toLocaleString() : '—'}
              </Text>
              <Text style={{ color: delta == null ? colors.mutedForeground : delta >= 0 ? palette.success : colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
                {last
                  ? `${delta == null ? '' : `${delta >= 0 ? '+' : ''}${delta.toLocaleString()} · `}${last.date}`
                  : (ar ? 'لم يُسجَّل بعد' : 'Not recorded yet')}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }]}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
          {METRICS.map(m => (
            <FilterChip key={m.key} label={ar ? m.ar : m.en} active={key === m.key} onPress={() => setKey(m.key)} colors={colors} />
          ))}
        </View>
        <TextInput
          value={value}
          onChangeText={t => setValue(t.replace(/[^\d]/g, ''))}
          placeholder={ar ? 'العدد' : 'Number'}
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          style={[input, { width: 120 }]}
        />
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          style={[input, { width: 120 }]}
          // A native date picker on web.
          {...(Platform.OS === 'web' ? ({ type: 'date' } as object) : {})}
        />
        <Pressable
          onPress={save}
          disabled={saving || !value}
          style={[styles.chip, { backgroundColor: ACCENT, borderColor: ACCENT, borderRadius: colors.radius, opacity: saving || !value ? 0.5 : 1 }]}
        >
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'حفظ' : 'Save'}</Text>
        </Pressable>
        {!!msg && <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>{msg}</Text>}
      </View>
    </View>
  );
}

function FeedbackRow({ item, isRTL, colors, onDelete }: { item: FeedbackItem; isRTL: boolean; colors: any; onDelete: () => void }) {
  const date = new Date(item.createdAt).toLocaleDateString();
  return (
    <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[styles.feedbackHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons
          name={item.rating === 'idea' ? 'bulb' : item.rating === 'up' ? 'thumbs-up' : 'thumbs-down'}
          size={14}
          color={item.rating === 'idea' ? palette.warning : item.rating === 'up' ? palette.success : colors.destructive}
        />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          {item.rating === 'idea' ? (isRTL ? 'اقتراح ميزة' : 'Feature idea') : `${item.materialType} · ${item.toolId}`}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18 }}>{date}</Text>
        {/* "Read it": the note goes away. The list is a to-do, not an archive. */}
        <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="delete">
          <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {!!item.comment && (
        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}>
          {item.comment}
        </Text>
      )}
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, lineHeight: 18, textAlign: isRTL ? 'right' : 'left' }}>
        {item.userFirstName} {item.userLastName} · {item.userEmail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, marginBottom: 10, marginTop: 10 },
  statRow: { gap: 10 },
  statCard: { flex: 1, alignItems: 'center', padding: 14, borderWidth: 1 },
  card: { padding: 14, borderWidth: 1, gap: 6 },
  cardLabel: { fontSize: 12, marginBottom: 4 },
  barRow: { alignItems: 'center', paddingVertical: 4 },
  posthogLink: { alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, marginTop: 10 },
  filterRow: { gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
  feedbackCard: { padding: 12, borderWidth: 1, gap: 6 },
  feedbackHeader: { alignItems: 'center', gap: 8 },
});
