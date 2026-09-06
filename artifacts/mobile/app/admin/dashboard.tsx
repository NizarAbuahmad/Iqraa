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
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['school_admin', 'system_admin'];

type UsageSummary = {
  totalUsers: number;
  totalEvaluations: number;
  materialsByType: Record<string, number>;
  feedbackByRating: Record<string, number>;
};

type FeedbackItem = {
  id: string;
  materialType: string;
  toolId: string;
  rating: 'up' | 'down';
  comment: string;
  createdAt: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
};

type RatingFilter = 'all' | 'up' | 'down';
const PAGE_SIZE = 30;

export default function AdminDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const topPad = insets.top + (insets.top === 0 ? 20 : 0);

  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<RatingFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextFilter: RatingFilter, offset: number) => {
    const ratingParam = nextFilter === 'all' ? '' : `&rating=${nextFilter}`;
    const [summaryRes, feedbackRes] = await Promise.all([
      offset === 0 ? apiJson<UsageSummary>('/admin/usage-summary') : Promise.resolve(null),
      apiJson<{ items: FeedbackItem[]; total: number }>(`/feedback?limit=${PAGE_SIZE}&offset=${offset}${ratingParam}`),
    ]);
    if (summaryRes) setSummary(summaryRes);
    setItems(cur => (offset === 0 ? feedbackRes.items : [...cur, ...feedbackRes.items]));
    setTotal(feedbackRes.total);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(filter, 0)
      // Show what actually failed. A bare "couldn't load" sent this screen's
      // first real user hunting through browser devtools for a 500 that turned
      // out to be a missing table — the message was already in the error.
      .catch((e: unknown) => setError(
        (lang === 'ar' ? 'تعذّر تحميل البيانات: ' : 'Failed to load dashboard data: ')
        + (e instanceof Error ? e.message : String(e)),
      ))
      .finally(() => setLoading(false));
  }, [isAdmin, filter, load, lang]);

  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      await load(filter, items.length);
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
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {lang === 'ar' ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold' }}>{lang === 'ar' ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
          </Pressable>
          <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
            {lang === 'ar' ? 'لوحة الإدارة' : 'Admin dashboard'}
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
            {/* Moderation. Above usage on purpose: reported messages carry a
                24-hour obligation (Apple 1.2) and usage counts do not. */}
            <Pressable
              onPress={() => router.push('/admin/moderation' as any)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  marginHorizontal: 20,
                  marginBottom: 16,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="flag-outline" size={20} color={ACCENT} />
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'بلاغات الرسائل' : 'Message reports'}
              </Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Usage summary */}
            {summary && (
              <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                  {lang === 'ar' ? 'الاستخدام' : 'Usage'}
                </Text>
                <View style={[styles.statRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <StatCard label={lang === 'ar' ? 'المعلمون' : 'Teachers'} value={summary.totalUsers} colors={colors} />
                  <StatCard label={lang === 'ar' ? 'التقييمات' : 'Evaluations'} value={summary.totalEvaluations} colors={colors} />
                  <StatCard
                    label={lang === 'ar' ? 'الملاحظات' : 'Feedback'}
                    value={(summary.feedbackByRating.up ?? 0) + (summary.feedbackByRating.down ?? 0)}
                    colors={colors}
                  />
                </View>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 10 }]}>
                  <Text style={[styles.cardLabel, { color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                    {lang === 'ar' ? 'المواد المحفوظة حسب النوع' : 'Saved materials by type'}
                  </Text>
                  {Object.entries(summary.materialsByType).length === 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12.5 }}>
                      {lang === 'ar' ? 'لا يوجد بعد' : 'None yet'}
                    </Text>
                  ) : (
                    Object.entries(summary.materialsByType).map(([type, count]) => (
                      <View key={type} style={[styles.barRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 12.5, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>{type}</Text>
                        <Text style={{ color: ACCENT, fontFamily: 'Cairo_700Bold', fontSize: 13 }}>{count}</Text>
                      </View>
                    ))
                  )}
                </View>
                <Pressable
                  onPress={() => Linking.openURL('https://us.posthog.com')}
                  style={[styles.posthogLink, { borderColor: colors.border, borderRadius: colors.radius, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="analytics-outline" size={15} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12.5 }}>
                    {lang === 'ar' ? 'افتح PostHog لبيانات الاستخدام التفصيلية (الشاشات، الأدوات)' : 'Open PostHog for detailed usage/trace data (screens, tools)'}
                  </Text>
                  <Ionicons name={isRTL ? 'open-outline' : 'open-outline'} size={13} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            {/* Feedback */}
            <View style={{ marginHorizontal: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: 'Cairo_700Bold', textAlign: isRTL ? 'right' : 'left' }]}>
                {lang === 'ar' ? 'ملاحظات المعلمين' : 'Teacher feedback'}
              </Text>
              <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <FilterChip label={lang === 'ar' ? 'الكل' : 'All'} active={filter === 'all'} onPress={() => setFilter('all')} colors={colors} />
                <FilterChip label="👍" active={filter === 'up'} onPress={() => setFilter('up')} colors={colors} />
                <FilterChip label="👎" active={filter === 'down'} onPress={() => setFilter('down')} colors={colors} />
              </View>

              {items.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                  {lang === 'ar' ? 'لا توجد ملاحظات بعد' : 'No feedback yet'}
                </Text>
              ) : (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {items.map(item => (
                    <FeedbackRow key={item.id} item={item} isRTL={isRTL} colors={colors} />
                  ))}
                </View>
              )}

              {items.length < total && (
                <Pressable onPress={loadMore} disabled={loadingMore} style={{ alignItems: 'center', padding: 14 }}>
                  {loadingMore
                    ? <ActivityIndicator size="small" color={ACCENT} />
                    : <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold', fontSize: 13 }}>{lang === 'ar' ? 'تحميل المزيد' : 'Load more'}</Text>}
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, colors }: { label: string; value: number; colors: any }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 20 }}>{value}</Text>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11.5, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: active ? ACCENT : colors.card,
        borderColor: active ? ACCENT : colors.border,
        borderRadius: colors.radius,
      }]}
    >
      <Text style={{ color: active ? '#fff' : colors.mutedForeground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}

function FeedbackRow({ item, isRTL, colors }: { item: FeedbackItem; isRTL: boolean; colors: any }) {
  const date = new Date(item.createdAt).toLocaleDateString();
  return (
    <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={[styles.feedbackHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons
          name={item.rating === 'up' ? 'thumbs-up' : 'thumbs-down'}
          size={14}
          color={item.rating === 'up' ? '#10B981' : colors.destructive}
        />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 12.5, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          {item.materialType} · {item.toolId}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11 }}>{date}</Text>
      </View>
      {!!item.comment && (
        <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 19, textAlign: isRTL ? 'right' : 'left' }}>
          {item.comment}
        </Text>
      )}
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 11, textAlign: isRTL ? 'right' : 'left' }}>
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
