/**
 * One person's insights — opened from the frequent-users list on app/admin/insights.tsx.
 * Who they are (role, school, what they teach, their optional «عنك» answers), when they were
 * active, where their time went, what they generated and saved, and the ratings they left.
 *
 * Reads GET /admin/insights/users/:id (system-admin only on the server; this gate only redirects).
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TYPE } from '@/constants/theme';
import { ICON } from '@/constants/icons';
import { Ionicons } from '@expo/vector-icons';
import { ACCENT, DayBars, FilterChip, KeyValue, SectionTitle, StatCard, Table } from '@/components/admin/widgets';
import { BackButton } from '@/components/ui/BackButton';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { TEACHER_PROFILE_FIELDS, teacherProfileLabel } from '@/services/teacherProfile';
import { isolateLtr } from '@/services/growthMetrics';
import {
  INSIGHTS_DAYS,
  ammanDayOf,
  areaLabel,
  formatMinutes,
  periodLabel,
  roleName,
  share,
  type InsightsDays,
  type UserInsights,
} from '@/services/adminInsights';

const FIELD_NAMES: Record<string, [string, string]> = {
  gender: ['الجنس', 'Gender'],
  ageRange: ['العمر', 'Age'],
  governorate: ['المحافظة', 'Governorate'],
  yearsTeaching: ['سنوات الخبرة', 'Years teaching'],
};

const parseDays = (raw: unknown): InsightsDays => {
  const n = Number(raw);
  return (INSIGHTS_DAYS as readonly number[]).includes(n) ? (n as InsightsDays) : 30;
};

export default function AdminInsightsUserScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'system_admin';
  const params = useLocalSearchParams<{ id?: string; days?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [days, setDays] = useState<InsightsDays>(parseDays(params.days));
  const [data, setData] = useState<UserInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin || !id) return;
    setLoading(true);
    setError('');
    apiJson<UserInsights>(`/admin/insights/users/${encodeURIComponent(id)}?days=${days}`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isAdmin, id, days]);

  const [savingInternal, setSavingInternal] = useState(false);
  const [internalError, setInternalError] = useState('');
  const toggleInternal = () => {
    if (!data || savingInternal) return;
    const internal = !data.user.internal;
    setSavingInternal(true);
    setInternalError('');
    apiJson<{ id: string; internal: boolean }>(`/admin/insights/users/${encodeURIComponent(id)}/internal`, {
      method: 'PUT',
      body: JSON.stringify({ internal }),
    })
      .then(r => setData(d => (d ? { ...d, user: { ...d.user, internal: r.internal } } : d)))
      .catch((e: unknown) => setInternalError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSavingInternal(false));
  };

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={ACCENT} /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'هذه الصفحة لإدارة النظام فقط' : 'This page is for system admins only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }];
  const totalMinutes = data?.areas.reduce((s, a) => s + a.minutes, 0) ?? 0;
  const dash = '—';
  // A date inside Arabic text is reordered by the bidi algorithm on web without the isolate.
  const date = (iso: string | null) => (iso ? isolateLtr(ammanDayOf(iso)) : dash);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text accessibilityRole="header" style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
            {data?.user.name ?? (ar ? 'مستخدم' : 'User')}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 6 }}>
          <View style={{ flexDirection: row, gap: 8, marginBottom: 8 }}>
            {INSIGHTS_DAYS.map(d => (
              <FilterChip key={d} label={periodLabel(d, ar)} active={days === d} onPress={() => setDays(d)} colors={colors} />
            ))}
          </View>
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}
          {loading || !data ? (error ? null : <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />) : (
            <>
              <View style={cardStyle}>
                <KeyValue k={ar ? 'الصفة' : 'Role'} v={roleName(data.user.role, ar)} isRTL={isRTL} colors={colors} />
                <KeyValue k={ar ? 'البريد' : 'Email'} v={data.user.email ?? dash} isRTL={isRTL} colors={colors} />
                <KeyValue k={ar ? 'المدرسة' : 'School'} v={data.user.school ?? dash} isRTL={isRTL} colors={colors} />
                <KeyValue
                  k={ar ? 'المواد' : 'Subjects'}
                  v={data.user.subjectIds.map(s => { const x = SUBJECTS.find(y => y.id === s); return x ? (ar ? x.nameAr : x.name) : s; }).join('، ') || dash}
                  isRTL={isRTL}
                  colors={colors}
                />
                <KeyValue
                  k={ar ? 'الصفوف' : 'Grades'}
                  v={data.user.gradeIds.map(g => { const x = GRADES.find(y => y.id === g); return x ? (ar ? x.nameAr : x.name) : g; }).join('، ') || dash}
                  isRTL={isRTL}
                  colors={colors}
                />
                {TEACHER_PROFILE_FIELDS.map(f => {
                  const v = data.user.teacherProfile[f];
                  return (
                    <KeyValue
                      key={f}
                      k={FIELD_NAMES[f]![ar ? 0 : 1]}
                      v={v ? teacherProfileLabel(v, ar ? 'ar' : 'en') : ar ? 'لم يُجب' : 'Not answered'}
                      isRTL={isRTL}
                      colors={colors}
                    />
                  );
                })}
                <KeyValue k={ar ? 'سجّل في' : 'Joined'} v={`${date(data.user.createdAt)}${data.user.signupPlatform ? ` · ${data.user.signupPlatform}` : ''}`} isRTL={isRTL} colors={colors} />
                <KeyValue k={ar ? 'آخر ظهور' : 'Last seen'} v={date(data.user.lastSeen)} isRTL={isRTL} colors={colors} />
              </View>

              {/* Team and test accounts are marked internal so the insights page leaves them out.
                  A system admin is always left out, so their mark cannot be changed. */}
              {data.user.role === 'system_admin' ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {ar ? 'حساب إدارة النظام: لا يُحتسب في صفحة الرؤى أبدًا.' : 'A system admin account: never counted on the insights page.'}
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: data.user.internal, disabled: savingInternal }}
                  aria-checked={data.user.internal}
                  disabled={savingInternal}
                  onPress={toggleInternal}
                  style={({ pressed }) => [...cardStyle, { minHeight: 44, flexDirection: row, alignItems: 'center', gap: 10, opacity: pressed || savingInternal ? 0.7 : 1 }]}
                >
                  <Ionicons name={data.user.internal ? 'checkbox' : 'square-outline'} size={ICON.lg} color={data.user.internal ? ACCENT : colors.mutedForeground} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>
                      {ar ? 'حساب داخلي' : 'Internal account'}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                      {ar ? 'حساب للفريق أو للتجربة: لا يُحتسب في صفحة الرؤى.' : 'A team or test account: left out of the insights page.'}
                    </Text>
                  </View>
                </Pressable>
              )}
              {!!internalError && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{internalError}</Text>}

              <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10 }}>
                <StatCard label={ar ? 'أيام النشاط' : 'Active days'} value={data.activeDays} colors={colors} />
                <StatCard label={ar ? 'وقت الاستخدام' : 'Time in app'} value={formatMinutes(totalMinutes, ar)} colors={colors} />
                <StatCard label={ar ? 'مرّات التوليد' : 'Generations'} value={data.generations.reduce((s, g) => s + g.count, 0)} colors={colors} />
              </View>

              <SectionTitle text={ar ? 'الدقائق يوميًا' : 'Minutes per day'} isRTL={isRTL} colors={colors} />
              <View style={cardStyle}>
                <DayBars
                  from={data.daily[0]?.day ?? ''}
                  to={data.daily[data.daily.length - 1]?.day ?? ''}
                  valueOf={d => data.daily.find(x => x.day === d)?.minutes ?? 0}
                  isRTL={isRTL}
                  colors={colors}
                  stretch
                />
              </View>

              <SectionTitle text={ar ? 'أين يقضي وقته' : 'Where their time goes'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['القسم', 'الوقت', 'النسبة'] : ['Area', 'Time', 'Share']}
                rows={data.areas.map(a => [areaLabel(a.area, ar), formatMinutes(a.minutes, ar), share(a.minutes, totalMinutes)])}
                empty={ar ? 'لا وقت مسجّل في هذه الفترة' : 'No time recorded in this period'}
                isRTL={isRTL}
                colors={colors}
              />

              <SectionTitle text={ar ? 'ما الذي ولّده وحفظه' : 'What they generated and saved'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['التوليد', 'مرّات'] : ['Generation', 'Times']}
                rows={data.generations.map(g => [g.kind, String(g.count)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this period'}
                isRTL={isRTL}
                colors={colors}
              />
              <Table
                head={ar ? ['المواد المحفوظة (الكل)', 'عدد', 'مفضّلة'] : ['Saved materials (all time)', 'Count', 'Favourites']}
                rows={data.saved.map(s => [s.type, String(s.count), String(s.favourites)])}
                empty={ar ? 'لا مواد محفوظة' : 'No saved materials'}
                isRTL={isRTL}
                colors={colors}
              />

              <SectionTitle text={ar ? 'تقييماته (آخر ٢٠)' : 'Their ratings (latest 20)'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['التاريخ', 'الأداة', 'التقييم', 'التعليق'] : ['Date', 'Tool', 'Rating', 'Comment']}
                rows={data.feedback.map(f => [
                  date(f.createdAt),
                  f.toolId || f.materialType,
                  f.rating === 'up' ? (ar ? 'أعجبني' : 'Liked') : f.rating === 'down' ? (ar ? 'لم يعجبني' : 'Disliked') : ar ? 'اقتراح' : 'Idea',
                  f.comment,
                ])}
                empty={ar ? 'لا تقييمات' : 'No ratings'}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 14, borderWidth: 1, gap: 6, marginBottom: 8 },
});
