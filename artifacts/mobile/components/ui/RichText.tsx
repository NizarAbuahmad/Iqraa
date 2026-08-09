/**
 * Lightweight markdown-ish renderer for assistant replies.
 *
 * Generated lesson plans and worksheets come back as plain text with headings,
 * numbered steps and bold runs. Rendering them line-by-line as flat body copy
 * (the previous behaviour) buried the structure, so long replies read as a
 * wall. This gives each construct a distinct visual weight while staying inside
 * the RN primitives — no markdown dependency, and RTL-aware throughout.
 *
 * Supported per line:
 *   ## heading / ### heading   → section heading with an accent rule
 *   **whole line**             → section heading
 *   • item  /  - item          → bullet with a teal marker
 *   1. item                    → numbered step with a badge
 *   ---                        → divider
 *   📚 / 📖 prefixed           → muted source note
 * Inline `**bold**` is honoured anywhere in a line.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Colors = {
  foreground: string;
  mutedForeground: string;
  primary: string;
  border: string;
};

type Props = {
  text: string;
  colors: Colors;
  isRTL: boolean;
  /** Override body colour (used inside the teal user bubble). */
  color?: string;
};

/** Split a line on `**bold**` runs, preserving order. */
function inline(line: string, boldFamily = 'Inter_600SemiBold') {
  const parts = line.split('**');
  if (parts.length === 1) return line;
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <Text key={i} style={{ fontFamily: boldFamily }}>
        {p}
      </Text>
    ) : (
      p
    ),
  );
}

export function RichText({ text, colors, isRTL, color }: Props) {
  const body = color ?? colors.foreground;
  const align = isRTL ? ('right' as const) : ('left' as const);
  const dir = isRTL ? ('rtl' as const) : ('ltr' as const);
  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);

  const lines = text.split('\n');

  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();

        if (!line.trim()) return <View key={i} style={styles.gap} />;

        // Divider — the generators emit ASCII rules and box-drawing rules alike.
        if (/^[-–—_*=~─━═╌┈]{3,}$/.test(line.trim().replace(/\s+/g, ''))) {
          return (
            <View key={i} style={[styles.divider, { backgroundColor: colors.border }]} />
          );
        }

        // Headings — "## text" or a line that is entirely bold
        const hashHeading = line.match(/^#{1,4}\s+(.*)$/);
        const boldLine = line.match(/^\*\*(.+)\*\*[:：]?$/);
        if (hashHeading || boldLine) {
          const content = (hashHeading?.[1] ?? boldLine?.[1] ?? '').trim();
          return (
            <View key={i} style={[styles.headingRow, { flexDirection: rowDir }]}>
              <View style={[styles.headingBar, { backgroundColor: colors.primary }]} />
              <Text
                style={[
                  styles.heading,
                  { color: body, textAlign: align, writingDirection: dir, flex: 1 },
                ]}
              >
                {content}
              </Text>
            </View>
          );
        }

        // Source / citation note
        if (/^(📚|📖|🔖)/.test(line)) {
          return (
            <Text
              key={i}
              style={[
                styles.source,
                { color: colors.mutedForeground, textAlign: align, writingDirection: dir },
              ]}
            >
              {line}
            </Text>
          );
        }

        // Numbered step
        const numbered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <View key={i} style={[styles.listRow, { flexDirection: rowDir }]}>
              <View style={[styles.numBadge, { backgroundColor: colors.primary + '1A' }]}>
                <Text style={[styles.numText, { color: colors.primary }]}>{numbered[1]}</Text>
              </View>
              <Text
                style={[
                  styles.body,
                  { color: body, flex: 1, textAlign: align, writingDirection: dir },
                ]}
              >
                {inline(numbered[2]!)}
              </Text>
            </View>
          );
        }

        // Bullet
        const bullet = line.match(/^[•\-*]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} style={[styles.listRow, { flexDirection: rowDir }]}>
              <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
              <Text
                style={[
                  styles.body,
                  { color: body, flex: 1, textAlign: align, writingDirection: dir },
                ]}
              >
                {inline(bullet[1]!)}
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={i}
            style={[
              styles.body,
              { color: body, textAlign: align, writingDirection: dir },
            ]}
          >
            {inline(line)}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  gap: { height: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, opacity: 0.8 },
  headingRow: { alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4 },
  headingBar: { width: 3, height: 15, borderRadius: 2 },
  heading: { fontSize: 14, fontFamily: 'Inter_700Bold', lineHeight: 21 },
  body: { fontSize: 13.5, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  listRow: { alignItems: 'flex-start', gap: 8, marginVertical: 2 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  numBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  numText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  source: {
    fontSize: 11.5,
    lineHeight: 18,
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
});
