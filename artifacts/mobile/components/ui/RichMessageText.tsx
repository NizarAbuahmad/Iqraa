/**
 * Lightweight markdown renderer for assistant replies.
 *
 * Generators return markdown-ish text (headings, bullets, numbered steps,
 * bold runs, tables of the "| a | b |" shape, horizontal rules). The chat used
 * to render only "**line**" and "• line", so a generated lesson plan arrived as
 * a wall of raw asterisks and pipes. This handles the subset the generators
 * actually emit — no dependency, no HTML.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Colors = {
  foreground: string;
  mutedForeground: string;
  primary: string;
  border: string;
  muted: string;
  secondary: string;
};

/** Splits a line on **bold** runs and returns styled fragments. */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${i}`} style={styles.strong}>
        {part}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-t${i}`}>{part}</Text>
    ),
  );
}

const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBER_RE = /^\s*(\d{1,2})[.)]\s+(.*)$/;
const RULE_RE = /^\s*(-{3,}|_{3,}|={3,})\s*$/;

export function RichMessageText({
  text,
  colors,
  isRTL,
}: {
  text: string;
  colors: Colors;
  isRTL: boolean;
}) {
  const dir = { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const lines = text.split('\n');

  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();

        if (!line.trim()) return <View key={i} style={styles.gap} />;

        if (RULE_RE.test(line)) {
          return <View key={i} style={[styles.rule, { backgroundColor: colors.border }]} />;
        }

        const heading = line.match(HEADING_RE);
        if (heading) {
          const level = heading[1]!.length;
          return (
            <Text
              key={i}
              style={[
                level <= 2 ? styles.h2 : styles.h3,
                { color: colors.foreground, marginTop: i === 0 ? 0 : 8 },
                dir,
              ]}
            >
              {inline(heading[2]!, `h${i}`)}
            </Text>
          );
        }

        // Source / reference lines the KB emits
        if (line.startsWith('📚') || line.startsWith('📖')) {
          return (
            <Text key={i} style={[styles.source, { color: colors.mutedForeground }, dir]}>
              {line}
            </Text>
          );
        }

        // A whole line wrapped in bold reads as a sub-heading
        if (/^\*\*[^*]+\*\*:?$/.test(line.trim())) {
          return (
            <Text
              key={i}
              style={[styles.h3, { color: colors.foreground, marginTop: i === 0 ? 0 : 8 }, dir]}
            >
              {line.replace(/\*\*/g, '')}
            </Text>
          );
        }

        const numbered = line.match(NUMBER_RE);
        if (numbered) {
          return (
            <View key={i} style={[styles.listRow, { flexDirection: rowDir }]}>
              <Text style={[styles.marker, { color: colors.primary }]}>{numbered[1]}.</Text>
              <Text style={[styles.body, { color: colors.foreground, flex: 1 }, dir]}>
                {inline(numbered[2]!, `n${i}`)}
              </Text>
            </View>
          );
        }

        const bullet = line.match(BULLET_RE);
        if (bullet) {
          return (
            <View key={i} style={[styles.listRow, { flexDirection: rowDir }]}>
              <Text style={[styles.marker, { color: colors.primary }]}>•</Text>
              <Text style={[styles.body, { color: colors.foreground, flex: 1 }, dir]}>
                {inline(bullet[1]!, `u${i}`)}
              </Text>
            </View>
          );
        }

        // Markdown table rows → a readable pipe-free line (separator rows dropped)
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
          if (cells.every(c => /^:?-{2,}:?$/.test(c))) return null;
          return (
            <Text key={i} style={[styles.body, { color: colors.foreground }, dir]}>
              {inline(cells.filter(Boolean).join('  ·  '), `tb${i}`)}
            </Text>
          );
        }

        return (
          <Text key={i} style={[styles.body, { color: colors.foreground }, dir]}>
            {inline(line, `p${i}`)}
          </Text>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  gap: { height: 8 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  h2: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 24, marginBottom: 2 },
  h3: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22, marginBottom: 2 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 23 },
  strong: { fontFamily: 'Inter_600SemiBold' },
  listRow: { alignItems: 'flex-start', gap: 8, marginVertical: 1 },
  marker: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 23, minWidth: 14 },
  source: { fontFamily: 'Inter_400Regular', fontSize: 11.5, lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
});
