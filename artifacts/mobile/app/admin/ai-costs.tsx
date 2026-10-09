/**
 * AI costs — the spend page. What the dashboard's AI card summarises, over
 * any date range: per-day spend, by tool, by model, by user, with the budget
 * for the current month. Role-gated client-side like `admin/dashboard.tsx`;
 * the route itself is admin-only.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { ACCENT, Bar, DayBars, KeyValue, SectionTitle, StatCard, Table } from '@/components/admin/widgets';
import { DateRange, monthStart, rangeQuery, type Range } from '@/components/admin/DateRange';
import { BackButton } from '@/components/ui/BackButton';

const ADMIN_ROLES = ['school_admin', 'system_admin'];

type Costs = {
  from: string;
  to: string;
  totals: { calls: number; hits: number; costUsd: number; promptTokens: number; completionTokens: number };
  byDay: { day: string; calls: number; costUsd: number }[];
  byKind: { kind: string; calls: number; hits: number; costUsd: number; p50Ms: number | null; p95Ms: number | null }[];
  byModel: { model: string; calls: number; costUsd: number; promptTokens: number; completionTokens: number }[];
  byUser: { userId: string; email: string; role: string; calls: number; costUsd: number }[];
  budget: { liveMode: boolean; spentUsd: number; limitUsd: number; generationModel: string; chatModel: string };
};

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const secs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export default function AdminAiCostsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [range, setRange] = useState<Range>({ from: monthStart(), to: '' });
  const [data, setData] = useState<Costs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    apiJson<Costs>(`/admin/ai-costs?${rangeQuery(range).slice(1)}`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isAdmin, range]);

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
  const costOfDay = new Map((data?.byDay ?? []).map(d => [d.day, d.costUsd]));
  const callsOfDay = new Map((data?.byDay ?? []).map(d => [d.day, d.calls]));
  const fromDay = data ? data.from.slice(0, 10) : range.from;
  const toDay = data ? data.to.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'تكاليف الذكاء الاصطناعي' : 'AI costs'}
          </Text>
        </View>

        <View style={{ margin: 20 }}>
          <DateRange value={range} onChange={setRange} ar={ar} isRTL={isRTL} colors={colors} />
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}
          {loading || !data ? <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} /> : (
            <>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 }}>
                <StatCard label={ar ? 'التكلفة' : 'Cost'} value={usd(data.totals.costUsd)} colors={colors} />
                <StatCard label={ar ? 'الطلبات' : 'Calls'} value={data.totals.calls} colors={colors} />
                <StatCard label={ar ? 'من المخزن (مجانًا)' : 'Cache hits (free)'} value={data.totals.hits} colors={colors} />
                <StatCard label={ar ? 'رموز الإدخال' : 'Input tokens'} value={k(data.totals.promptTokens)} colors={colors} />
                <StatCard label={ar ? 'رموز الإخراج' : 'Output tokens'} value={k(data.totals.completionTokens)} colors={colors} />
                <StatCard
                  label={ar ? 'متوسط التكلفة للطلب' : 'Avg cost per call'}
                  value={data.totals.calls - data.totals.hits > 0 ? usd(data.totals.costUsd / (data.totals.calls - data.totals.hits)) : '—'}
                  colors={colors}
                />
              </View>

              <SectionTitle text={ar ? 'ميزانية هذا الشهر' : 'This month’s budget'} isRTL={isRTL} colors={colors} />
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <KeyValue k={ar ? 'الإنفاق / السقف (AI_BUDGET_USD)' : 'Spent / cap (AI_BUDGET_USD)'} v={`${usd(data.budget.spentUsd)} / ${usd(data.budget.limitUsd)}`} isRTL={isRTL} colors={colors} />
                <Bar ratio={data.budget.limitUsd ? data.budget.spentUsd / data.budget.limitUsd : 0} isRTL={isRTL} colors={colors} />
                <KeyValue k={ar ? 'الوضع' : 'Mode'} v={`${data.budget.liveMode ? 'live' : 'off'} · ${data.budget.generationModel} · chat ${data.budget.chatModel}`} isRTL={isRTL} colors={colors} />
              </View>

              <SectionTitle text={ar ? 'التكلفة يوميًا' : 'Cost per day'} isRTL={isRTL} colors={colors} />
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <DayBars from={fromDay} to={toDay} valueOf={d => costOfDay.get(d) ?? 0} isRTL={isRTL} colors={colors} />
                <KeyValue k={ar ? 'الطلبات يوميًا' : 'Calls per day'} v="" isRTL={isRTL} colors={colors} />
                <DayBars from={fromDay} to={toDay} valueOf={d => callsOfDay.get(d) ?? 0} isRTL={isRTL} colors={colors} />
              </View>

              <SectionTitle text={ar ? 'حسب الأداة' : 'By tool'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['الأداة', 'الطلبات', 'من المخزن', 'التكلفة', 'p50', 'p95'] : ['Tool', 'Calls', 'Cache hits', 'Cost', 'p50', 'p95']}
                rows={data.byKind.map(r => [r.kind, String(r.calls), String(r.hits), usd(r.costUsd), secs(r.p50Ms), secs(r.p95Ms)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this range'}
                isRTL={isRTL}
                colors={colors}
              />

              <SectionTitle text={ar ? 'حسب النموذج' : 'By model'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['النموذج', 'الطلبات', 'التكلفة', 'إدخال', 'إخراج'] : ['Model', 'Calls', 'Cost', 'Input', 'Output']}
                rows={data.byModel.map(r => [r.model, String(r.calls), usd(r.costUsd), k(r.promptTokens), k(r.completionTokens)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this range'}
                isRTL={isRTL}
                colors={colors}
              />

              <SectionTitle text={ar ? 'حسب المستخدم (الأعلى ٥٠)' : 'By user (top 50)'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['البريد', 'الدور', 'الطلبات', 'التكلفة'] : ['Email', 'Role', 'Calls', 'Cost']}
                rows={data.byUser.map(r => [r.email, r.role, String(r.calls), usd(r.costUsd)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this range'}
                isRTL={isRTL}
                colors={colors}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 14, borderWidth: 1, gap: 6 },
});
