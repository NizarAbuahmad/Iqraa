/**
 * User insights — where people spend their time, which features they use, how many come back,
 * who the most frequent users are, what they like, and who the teachers are
 * (docs/superpowers/specs/2026-11-19-admin-user-insights-design.md).
 *
 * Reads GET /admin/insights (api-server routes/adminInsights.ts), which is system-admin only;
 * the client gate below only redirects. Time spent starts the day the heartbeat shipped
 * (`trackingSince`), and the page says so. A demographic group of one or two people arrives as
 * null and is shown as «<3». Each frequent user opens app/admin/insights-user.tsx.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { TYPE } from '@/constants/theme';
import { ICON } from '@/constants/icons';
import { ACCENT, Bar, DayBars, FilterChip, KeyValue, SectionTitle, StatCard, Table } from '@/components/admin/widgets';
import { BackButton } from '@/components/ui/BackButton';
import { GRADES, SUBJECTS } from '@/services/curriculumData';
import { teacherProfileLabel } from '@/services/teacherProfile';
// Dates and "61%" inside Arabic text are reordered by the bidi algorithm on web without this.
import { isolateLtr } from '@/services/growthMetrics';
import {
  INSIGHTS_DAYS,
  INSIGHTS_ROLES,
  arDays,
  areaLabel,
  excludedNote,
  periodLabel,
  roleFilterLabel,
  showsTeacherSections,
  breakdownCell,
  cohortCell,
  formatMinutes,
  roleName,
  share,
  type Breakdown,
  type Insights,
  type InsightsDays,
  type InsightsRole,
} from '@/services/adminInsights';

const subjectName = (id: string, ar: boolean) => {
  const s = SUBJECTS.find(x => x.id === id);
  return s ? (ar ? s.nameAr : s.name) : id;
};
const gradeName = (id: string, ar: boolean) => {
  const g = GRADES.find(x => x.id === id);
  return g ? (ar ? g.nameAr : g.name) : id;
};

export default function AdminInsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'system_admin';

  const [days, setDays] = useState<InsightsDays>(30);
  const [role, setRole] = useState<InsightsRole>('all');
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    apiJson<Insights>(`/admin/insights?days=${days}&role=${role}`)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isAdmin, days, role]);

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
  const note = (text: string) => (
    <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 18, textAlign: align }}>{text}</Text>
  );
  /** `total` given: a teacher-profile breakdown ("N of total answered"). Absent: people per value, no "answered". */
  const breakdownTable = (title: string, b: Breakdown, label: (key: string) => string, total?: number) => (
    <>
      <SectionTitle text={title} isRTL={isRTL} colors={colors} />
      <Table
        head={ar ? ['', 'العدد'] : ['', 'Count']}
        rows={b.rows.map(r => [label(r.key), breakdownCell(r.count)])}
        empty={ar ? 'لا إجابات بعد' : 'No answers yet'}
        isRTL={isRTL}
        colors={colors}
      />
      {total === undefined
        ? note(ar ? 'عدد الأشخاص لكل قيمة؛ المجموعات الأقل من ٣ أشخاص مخفية.' : 'People per value; groups under 3 people are hidden.')
        : note(
            // With a hidden group both totals are withheld too, or the group is one subtraction away.
            b.answered === null || b.unanswered === null
              ? ar
                ? `من ${total}. المجموعات الأقل من ٣ أشخاص مخفية، ومعها عدد من أجاب، كي لا تُستنتج بالطرح.`
                : `Of ${total}. Groups under 3 people are hidden, and so is how many answered, so they cannot be worked out.`
              : ar
                ? `أجاب ${b.answered} من ${total}، ولم يُجب ${b.unanswered}.`
                : `${b.answered} of ${total} answered, ${b.unanswered} did not.`,
          )}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text accessibilityRole="header" style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: align }}>
            {ar ? 'رؤى المستخدمين' : 'User insights'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 6 }}>
          <View style={{ flexDirection: row, gap: 8, marginBottom: 8 }}>
            {INSIGHTS_DAYS.map(d => (
              <FilterChip key={d} label={periodLabel(d, ar)} active={days === d} onPress={() => setDays(d)} colors={colors} />
            ))}
          </View>
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {INSIGHTS_ROLES.map(r => (
              <FilterChip key={r} label={roleFilterLabel(r, ar)} active={role === r} onPress={() => setRole(r)} colors={colors} />
            ))}
          </View>
          {!!data && !!excludedNote(data.excluded, ar) && note(excludedNote(data.excluded, ar))}
          {!!error && <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{error}</Text>}
          {loading || !data ? <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} /> : (
            <>
              <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10 }}>
                <StatCard label={ar ? 'نشطون في الفترة' : 'Active in period'} value={data.retention.active} colors={colors} />
                <StatCard label={ar ? 'عائدون (يومان أو أكثر)' : 'Returning (2+ days)'} value={data.retention.returning} colors={colors} />
                <StatCard label={ar ? 'انقطعوا (لا نشاط منذ ١٤ يومًا، أيًّا كانت الفترة)' : 'Lapsed (none in 14 days, any period)'} value={data.retention.churned} colors={colors} />
                <StatCard label={ar ? 'إجمالي وقت الاستخدام' : 'Total time in app'} value={formatMinutes(data.time.totalMinutes, ar)} colors={colors} />
                <StatCard label={ar ? 'متوسط الدقائق في يوم النشاط' : 'Avg minutes per active day'} value={data.time.avgMinutesPerActiveDay} colors={colors} />
              </View>

              {/* ─── Where time goes ─────────────────────────────────────── */}
              <SectionTitle text={ar ? 'أين يقضي المستخدمون وقتهم' : 'Where time goes'} isRTL={isRTL} colors={colors} />
              {note(
                data.trackingSince
                  ? ar
                    ? `يُقاس وقت الاستخدام منذ ${isolateLtr(data.trackingSince)}، بدقيقة لكل دقيقة كان فيها التطبيق أمام المستخدم ولمسه.`
                    : `Time is measured since ${data.trackingSince}: one minute for each minute the app was in front of someone who was using it.`
                  : ar
                    ? 'لم يُسجَّل أيّ وقت استخدام بعد — يبدأ القياس حين تصل النسخة الجديدة إلى المستخدمين.'
                    : 'No time recorded yet — it starts once the new version reaches people.',
              )}
              <Table
                head={ar ? ['القسم', 'الوقت', 'النسبة', 'المستخدمون'] : ['Area', 'Time', 'Share', 'People']}
                rows={data.time.byArea.map(r => [areaLabel(r.area, ar), formatMinutes(r.minutes, ar), share(r.minutes, data.time.totalMinutes), String(r.users)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this period'}
                isRTL={isRTL}
                colors={colors}
              />
              <View style={cardStyle}>
                <KeyValue k={ar ? 'الدقائق يوميًا' : 'Minutes per day'} v="" isRTL={isRTL} colors={colors} />
                <DayBars
                  from={data.time.byDay[0]?.day ?? data.since}
                  to={data.time.byDay[data.time.byDay.length - 1]?.day ?? data.since}
                  valueOf={d => data.time.byDay.find(x => x.day === d)?.minutes ?? 0}
                  isRTL={isRTL}
                  colors={colors}
                  stretch
                />
                {data.time.byPlatform.map(p => (
                  <View key={p.platform}>
                    <KeyValue k={p.platform} v={`${formatMinutes(p.minutes, ar)} · ${isolateLtr(share(p.minutes, data.time.totalMinutes))}`} isRTL={isRTL} colors={colors} />
                    {/* A share of all minutes: 100% on one platform is not a warning, so never red. */}
                    <Bar ratio={data.time.totalMinutes ? p.minutes / data.time.totalMinutes : 0} isRTL={isRTL} colors={colors} warn={false} />
                  </View>
                ))}
              </View>

              {/* ─── Features ────────────────────────────────────────────── */}
              <SectionTitle text={ar ? 'الميزات الأكثر استخدامًا' : 'Most used features'} isRTL={isRTL} colors={colors} />
              <View style={{ flexDirection: row, flexWrap: 'wrap', gap: 10 }}>
                <StatCard label={ar ? 'اختبارات أُنشئت' : 'Exams created'} value={data.features.evaluations} colors={colors} />
                <StatCard label={ar ? 'واجبات نُشرت' : 'Homework posted'} value={data.features.homework} colors={colors} />
                <StatCard label={ar ? 'رسائل أُرسلت' : 'Messages sent'} value={data.features.chatMessages} colors={colors} />
              </View>
              <Table
                head={ar ? ['التوليد بالذكاء الاصطناعي', 'مرّات', 'مستخدمون'] : ['AI generation', 'Times', 'People']}
                rows={data.features.generations.map(g => [g.kind, String(g.count), String(g.users)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this period'}
                isRTL={isRTL}
                colors={colors}
              />
              <Table
                head={ar ? ['المواد المحفوظة', 'عدد', 'مستخدمون'] : ['Saved materials', 'Count', 'People']}
                rows={data.features.saved.map(s => [s.type, String(s.count), String(s.users)])}
                empty={ar ? 'لا شيء في هذه الفترة' : 'Nothing in this period'}
                isRTL={isRTL}
                colors={colors}
              />

              {/* ─── Cohorts ─────────────────────────────────────────────── */}
              <SectionTitle text={ar ? 'العودة حسب أسبوع التسجيل' : 'Coming back, by sign-up week'} isRTL={isRTL} colors={colors} />
              {note(
                ar
                  ? 'كل صفّ أسبوع تسجيل (يبدأ الأحد): عدد من سجّلوا فيه، ثم نسبة من كان منهم نشطًا في ذلك الأسبوع وفي كل أسبوع بعده.'
                  : 'Each row is a sign-up week (starting Sunday): how many signed up, then the share of them active that week and each week after.',
              )}
              <Table
                head={[ar ? 'الأسبوع' : 'Week', ar ? 'العدد' : 'Size', ...data.retention.cohorts.map((_, i) => (ar ? `أ${i}` : `W${i}`))]}
                rows={data.retention.cohorts.map(c => [
                  isolateLtr(c.week),
                  String(c.size),
                  ...data.retention.cohorts.map((_, i) => (i < c.active.length ? cohortCell(c.active[i]!, c.size) : '')),
                ])}
                isRTL={isRTL}
                colors={colors}
              />

              {/* ─── Frequent users (teacher accounts only, so not on a student/parent filter) ── */}
              {showsTeacherSections(role) && <>
              <SectionTitle text={ar ? 'المستخدمون الأكثر نشاطًا' : 'Most frequent users'} isRTL={isRTL} colors={colors} />
              {note(
                ar
                  ? 'حسابات المعلّمين فقط، مرتّبة حسب أيام النشاط ثم الوقت. الطلبة وأولياء الأمور محسوبون في الأرقام أعلاه ولا تُعرض أسماؤهم. اضغط على اسم لفتح تفاصيله.'
                  : 'Teacher accounts only, by active days then time. Students and parents count in the numbers above but are never named. Tap a name for details.',
              )}
              {data.topUsers.length === 0 ? note(ar ? 'لا أحد في هذه الفترة' : 'Nobody in this period') : null}
              {data.topUsers.map((u, i) => {
                const teaches = [
                  ...u.subjectIds.map(id => subjectName(id, ar)),
                  ...u.gradeIds.map(id => gradeName(id, ar)),
                ].join('، ');
                return (
                  <Pressable
                    key={u.id}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/admin/insights-user', params: { id: u.id, days: String(days) } } as never)}
                    style={({ pressed }) => [...cardStyle, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{i + 1}</Text>
                      <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }}>{u.name}</Text>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption }}>{roleName(u.role, ar)}</Text>
                      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={ICON.md} color={colors.mutedForeground} />
                    </View>
                    <KeyValue
                      k={ar ? 'النشاط' : 'Activity'}
                      v={ar
                        ? `${arDays(u.activeDays)} · ${formatMinutes(u.minutes, ar)} · التوليد ${u.generations}`
                        : `${u.activeDays} days · ${formatMinutes(u.minutes, ar)} · ${u.generations} generations`}
                      isRTL={isRTL}
                      colors={colors}
                    />
                    {u.topAreas.length > 0 && (
                      <KeyValue k={ar ? 'أكثر ما يستخدم' : 'Spends time in'} v={u.topAreas.map(a => areaLabel(a, ar)).join('، ')} isRTL={isRTL} colors={colors} />
                    )}
                    {teaches ? <KeyValue k={ar ? 'يدرّس' : 'Teaches'} v={teaches} isRTL={isRTL} colors={colors} /> : null}
                    {(u.school || u.governorate) && (
                      <KeyValue
                        k={ar ? 'المكان' : 'Where'}
                        v={[u.school, u.governorate ? teacherProfileLabel(u.governorate, ar ? 'ar' : 'en') : null].filter(Boolean).join(' · ')}
                        isRTL={isRTL}
                        colors={colors}
                      />
                    )}
                  </Pressable>
                );
              })}
              </>}

              {/* ─── What they like ──────────────────────────────────────── */}
              <SectionTitle text={ar ? 'ما الذي يعجبهم' : 'What they like'} isRTL={isRTL} colors={colors} />
              <Table
                head={ar ? ['الأداة', 'أعجبني', 'لم يعجبني', 'نسبة الإعجاب'] : ['Tool', 'Liked', 'Disliked', 'Like rate']}
                rows={data.likes.byTool.map(t => [t.key, String(t.up), String(t.down), share(t.up, t.up + t.down)])}
                empty={ar ? 'لا تقييمات في هذه الفترة' : 'No ratings in this period'}
                isRTL={isRTL}
                colors={colors}
              />
              <Table
                head={ar ? ['المفضّلة (حسب النوع)', 'العدد'] : ['Favourites (by type)', 'Count']}
                rows={data.likes.favourites.map(f => [f.type, String(f.count)])}
                empty={ar ? 'لا مفضّلات بعد' : 'No favourites yet'}
                isRTL={isRTL}
                colors={colors}
              />
              {breakdownTable(ar ? 'المواد التي يحفظون منها (أشخاص)' : 'Subjects they save from (people)', data.likes.subjects, k => k)}
              {breakdownTable(ar ? 'الصفوف التي يحفظون منها (أشخاص)' : 'Grades they save from (people)', data.likes.grades, k => k)}

              {/* ─── Who the teachers are (teacher accounts whatever the period) ─────────── */}
              {showsTeacherSections(role) && <>
              <SectionTitle text={ar ? `من هم المعلّمون (${data.teachers.total})` : `Who the teachers are (${data.teachers.total})`} isRTL={isRTL} colors={colors} />
              {note(ar ? 'الجنس والعمر والمحافظة والخبرة أسئلة اختيارية في «عنك»؛ الأرقام لكل المعلّمين لا للفترة فقط.' : 'Gender, age, governorate and experience are optional «About you» answers; counts are all teachers, not just this period.')}
              {breakdownTable(ar ? 'المواد التي يدرّسونها' : 'Subjects they teach', data.teachers.subjects, k => subjectName(k, ar), data.teachers.total)}
              {breakdownTable(ar ? 'الصفوف التي يدرّسونها' : 'Grades they teach', data.teachers.grades, k => gradeName(k, ar), data.teachers.total)}
              {breakdownTable(ar ? 'الجنس' : 'Gender', data.teachers.gender, k => teacherProfileLabel(k, ar ? 'ar' : 'en'), data.teachers.total)}
              {breakdownTable(ar ? 'العمر' : 'Age', data.teachers.ageRange, k => teacherProfileLabel(k, ar ? 'ar' : 'en'), data.teachers.total)}
              {breakdownTable(ar ? 'المحافظة' : 'Governorate', data.teachers.governorate, k => teacherProfileLabel(k, ar ? 'ar' : 'en'), data.teachers.total)}
              {breakdownTable(ar ? 'سنوات الخبرة' : 'Years teaching', data.teachers.yearsTeaching, k => teacherProfileLabel(k, ar ? 'ar' : 'en'), data.teachers.total)}
              </>}
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
