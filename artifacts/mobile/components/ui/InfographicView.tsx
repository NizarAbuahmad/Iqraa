/**
 * A lesson infographic, drawn as one card: a coloured title band, a row of
 * key-fact tiles, icon sections, and a takeaway callout.
 *
 * Read-only on purpose — unlike `LessonPlanView` there is nothing a teacher
 * edits line by line here; they regenerate or export it.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safeIcon, type InfographicOutput } from '@/services/ai/infographic';

type Colors = {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  primaryForeground?: string;
  secondary: string;
};

export function InfographicView({ data, colors, isRTL }: {
  data: InfographicOutput;
  colors: Colors;
  isRTL: boolean;
}) {
  const align = isRTL ? 'right' : 'left';
  const dir = isRTL ? 'rtl' : 'ltr';
  const row = isRTL ? 'row-reverse' : 'row';
  const onPrimary = colors.primaryForeground || '#fff';

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.band, { backgroundColor: colors.primary }]}>
        <Text style={[styles.title, { color: onPrimary, textAlign: align, writingDirection: dir }]}>
          {data.title}
        </Text>
        {data.subtitle ? (
          <Text style={[styles.subtitle, { color: onPrimary, textAlign: align, writingDirection: dir }]}>
            {data.subtitle}
          </Text>
        ) : null}
      </View>

      {data.keyFacts.length > 0 ? (
        <View style={[styles.facts, { flexDirection: row }]}>
          {data.keyFacts.map((f, i) => (
            <View key={i} style={[styles.fact, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.factLabel, { color: colors.primary, textAlign: align, writingDirection: dir }]}>
                {f.label}
              </Text>
              <Text style={[styles.factValue, { color: colors.foreground, textAlign: align, writingDirection: dir }]}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {data.sections.map((s, i) => (
        <View key={i} style={[styles.section, { borderTopColor: colors.border }]}>
          <View style={[styles.sectionHead, { flexDirection: row }]}>
            <View style={[styles.iconDot, { backgroundColor: colors.primary + '1A' }]}>
              <Ionicons name={safeIcon(s.icon)} size={16} color={colors.primary} />
            </View>
            <Text style={[styles.heading, { color: colors.foreground, textAlign: align, writingDirection: dir }]}>
              {s.heading}
            </Text>
          </View>
          {s.points.map((p, j) => (
            <View key={j} style={[styles.point, { flexDirection: row }]}>
              <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.pointText, { color: colors.foreground, textAlign: align, writingDirection: dir }]}>
                {p}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <View style={[styles.takeaway, { flexDirection: row, backgroundColor: colors.primary + '14', borderColor: colors.primary + '55' }]}>
        <Ionicons name="bulb" size={18} color={colors.primary} />
        <Text style={[styles.takeawayText, { color: colors.foreground, textAlign: align, writingDirection: dir }]}>
          {data.takeaway}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  band: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  title: { fontFamily: 'Cairo_700Bold', fontSize: 18, lineHeight: 28 },
  subtitle: { fontFamily: 'Cairo_500Medium', fontSize: 13, lineHeight: 20, opacity: 0.92 },
  facts: { flexWrap: 'wrap', gap: 8, padding: 12 },
  fact: { flexGrow: 1, flexBasis: '45%', borderRadius: 12, padding: 10, gap: 2 },
  factLabel: { fontFamily: 'Cairo_700Bold', fontSize: 13 },
  factValue: { fontFamily: 'Cairo_500Medium', fontSize: 12.5, lineHeight: 19 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  sectionHead: { alignItems: 'center', gap: 8, marginBottom: 2 },
  iconDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontFamily: 'Cairo_700Bold', fontSize: 14.5 },
  point: { gap: 6, alignItems: 'flex-start' },
  bullet: { fontFamily: 'Cairo_700Bold', fontSize: 14, lineHeight: 22 },
  pointText: { flex: 1, fontFamily: 'Cairo_500Medium', fontSize: 13.5, lineHeight: 22 },
  takeaway: { alignItems: 'center', gap: 8, margin: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  takeawayText: { flex: 1, fontFamily: 'Cairo_600SemiBold', fontSize: 14, lineHeight: 22 },
});
