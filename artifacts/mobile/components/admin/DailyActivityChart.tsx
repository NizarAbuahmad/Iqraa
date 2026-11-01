/**
 * The dashboard's daily-activity chart: one stacked bar per day, returning people at the bottom and
 * new people on top, so the bar's height is that day's active people. Numbers come from
 * GET /admin/daily-activity; the sums and heights are `services/adminDailyActivity.ts`.
 *
 * Laid out like the signups chart beside it (`SignupBars`): the same bar area, the day running with
 * the reading direction, a hover title per day on web.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ACCENT, KeyValue } from '@/components/admin/widgets';
import { TYPE } from '@/constants/theme';
import { isolateLtr } from '@/services/growthMetrics';
import { activityTotals, barRatios, chartMax, type DailyActivityDay } from '@/services/adminDailyActivity';

/** Teal against the indigo `ACCENT`: different hue and lightness, so the two read apart in greyscale too. */
export const NEW_COLOR = '#0D9488';
const CHART_HEIGHT = 110;

const oneDecimal = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function DailyActivityChart({ days, ar, isRTL, colors }: {
  days: DailyActivityDay[];
  ar: boolean;
  isRTL: boolean;
  colors: any;
}) {
  const max = chartMax(days);
  const totals = activityTotals(days);
  const first = days[0]?.day;
  const last = days[days.length - 1]?.day;
  const row = isRTL ? 'row-reverse' : 'row';
  const summary = ar
    ? `متوسط النشطين يوميًا ${oneDecimal(totals.averageActive)}${totals.peak ? `، أعلى يوم ${totals.peak.day} بـ ${totals.peak.active}` : ''}`
    : `Average ${oneDecimal(totals.averageActive)} active a day${totals.peak ? `, peak ${totals.peak.day} with ${totals.peak.active}` : ''}`;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={{ flexDirection: row, gap: 16, flexWrap: 'wrap' }}>
        <Legend color={ACCENT} label={ar ? 'عائدون' : 'Returning'} isRTL={isRTL} colors={colors} />
        <Legend color={NEW_COLOR} label={ar ? 'جدد (أُنشئ حسابهم في اليوم نفسه)' : 'New (account created that day)'} isRTL={isRTL} colors={colors} />
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        style={{ flexDirection: row, alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2 }}
      >
        {days.map(d => {
          const { newRatio, returningRatio } = barRatios(d, max);
          return (
            <View
              key={d.day}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
              // Hover tooltip on web: the day and its split.
              {...({ title: `${d.day}: ${d.active} (${ar ? 'جدد' : 'new'} ${d.new}, ${ar ? 'عائدون' : 'returning'} ${d.returning})` } as object)}
            >
              {d.active === 0 ? (
                <View style={{ height: 1, backgroundColor: colors.border }} />
              ) : (
                <>
                  {d.new > 0 && (
                    <View style={{ height: `${newRatio * 100}%`, minHeight: 2, backgroundColor: NEW_COLOR, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                  )}
                  {d.returning > 0 && (
                    <View style={{ height: `${returningRatio * 100}%`, minHeight: 2, backgroundColor: ACCENT, borderTopLeftRadius: d.new > 0 ? 0 : 2, borderTopRightRadius: d.new > 0 ? 0 : 2 }} />
                  )}
                </>
              )}
            </View>
          );
        })}
      </View>

      {first && last ? (
        <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
          <Text style={[styles.axis, { color: colors.mutedForeground }]}>{isolateLtr(first)}</Text>
          <Text style={[styles.axis, { color: colors.mutedForeground }]}>{isolateLtr(last)}</Text>
        </View>
      ) : null}

      <KeyValue k={ar ? 'متوسط النشطين يوميًا' : 'Average daily active'} v={oneDecimal(totals.averageActive)} isRTL={isRTL} colors={colors} />
      <KeyValue
        k={ar ? 'أعلى يوم' : 'Busiest day'}
        v={totals.peak ? `${isolateLtr(totals.peak.day)} — ${totals.peak.active}` : '—'}
        isRTL={isRTL}
        colors={colors}
      />
      <KeyValue
        k={ar ? 'جدد / عائدون (مجموع أيام النشاط)' : 'New / returning (summed over days)'}
        v={`${totals.newPersonDays} / ${totals.returningPersonDays}`}
        isRTL={isRTL}
        colors={colors}
      />
      <KeyValue k={ar ? 'تسجيلات جديدة' : 'New signups'} v={String(totals.signups)} isRTL={isRTL} colors={colors} />
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>
        {ar
          ? 'النشاط = إنشاء محتوى بالذكاء الاصطناعي أو حفظ مادة. الأيام بتوقيت عمّان، وفتح التطبيق دون إنشاء أو حفظ لا يُحسب.'
          : 'Active = generated with AI or saved a material. Days are Amman time; opening the app without doing either is not counted.'}
      </Text>
    </View>
  );
}

function Legend({ color, label, isRTL, colors }: { color: string; label: string; isRTL: boolean; colors: any }) {
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1, gap: 8 },
  axis: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro },
  note: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, lineHeight: 16 },
});
