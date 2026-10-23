/**
 * The desktop side panel: a sheet of paper drawn from the options as skeleton
 * rows, updating as they change. It shows the SHAPE of what the button will
 * make (how many questions, of which types, for how many marks), never real
 * questions: nothing has been generated yet, and a made-up question here could
 * be mistaken for one.
 *
 * The sheet is always paper: white with ink text, in dark mode too, because it
 * stands for the printout and not for the app's surface. Those four colours are
 * the only literals in the components/generator folder and are the allow-list in
 * `generatorScreens.test.ts`.
 *
 * Decorative to a screen reader apart from its heading and note: the same
 * counts are in the summary line above the button.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSurface } from '@/components/ui/Surface';
import { ELEVATION, RADIUS, SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';

/** The sheet, whatever the theme. Allow-listed in generatorScreens.test.ts. */
const PAPER = { sheet: '#FFFFFF', ink: '#0B1B33', soft: '#5C6675', rule: '#E3E8E7' } as const;

export interface PaperPreviewRow {
  n: number;
  /** The question type's label, or null when nothing is ticked. */
  tag: string | null;
}

export interface PaperPreviewProps {
  title: string;
  subtitle: string;
  rows: readonly PaperPreviewRow[];
  /** «+ 4 أسئلة أخرى», or empty. */
  more: string;
  /** The sheet's bottom line: [start, end] — «الدرجة الكاملة 20», «20 دقيقة». */
  footer: readonly [string, string];
  note?: string;
  accent: string;
}

export function PaperPreview({ title, subtitle, rows, more, footer, note, accent }: PaperPreviewProps) {
  const colors = useColors();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const align = isRTL ? 'right' : 'left';
  const tagInk = readableOn(accent, PAPER.sheet);
  return (
    <View style={[surface, styles.panel]}>
      <Text style={[styles.heading, { color: colors.mutedForeground, textAlign: align }]}>{t('genPreviewTitle')}</Text>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={styles.sheet}
      >
        <View style={styles.head}>
          <Text style={[styles.sheetTitle, { textAlign: align }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.sheetSub, { textAlign: align }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <View style={[styles.nameLine, row]}>
          <Text style={styles.sheetSub}>{t('genPreviewName')}: ................</Text>
          <Text style={styles.sheetSub}>{t('genPreviewDate')}: ........</Text>
        </View>
        {rows.map(r => (
          <View key={r.n} style={[styles.qRow, row]}>
            <Text style={styles.qNum}>{r.n}</Text>
            <View style={[styles.bar, { width: r.n % 2 ? '88%' : '100%' }]} />
            {r.tag ? (
              <Text style={[styles.tag, { color: tagInk, backgroundColor: accent + '1A' }]} numberOfLines={1}>{r.tag}</Text>
            ) : null}
          </View>
        ))}
        {more ? <Text style={styles.more}>{more}</Text> : null}
        <View style={[styles.foot, row]}>
          <Text style={styles.footText}>{footer[0]}</Text>
          <Text style={styles.footText}>{footer[1]}</Text>
        </View>
      </View>
      {note ? <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: SPACE.lg, gap: SPACE.md },
  heading: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption },
  sheet: { backgroundColor: PAPER.sheet, borderRadius: RADIUS.sm, padding: SPACE.lg, gap: SPACE.md, boxShadow: ELEVATION.card },
  head: { gap: SPACE.xxs, paddingBottom: SPACE.sm, borderBottomWidth: 2, borderBottomColor: PAPER.ink },
  sheetTitle: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.bodyLg, color: PAPER.ink },
  sheetSub: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, color: PAPER.soft },
  nameLine: { justifyContent: 'space-between', gap: SPACE.sm },
  qRow: { alignItems: 'center', gap: SPACE.sm },
  qNum: { width: 22, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.micro, color: PAPER.soft },
  bar: { flex: 1, height: 8, borderRadius: RADIUS.xs, backgroundColor: PAPER.rule },
  tag: { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.pill, overflow: 'hidden' },
  more: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, color: PAPER.soft, textAlign: 'center' },
  foot: { justifyContent: 'space-between', paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: PAPER.rule },
  footText: { fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.caption, color: PAPER.ink },
  note: { fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 20 },
});
