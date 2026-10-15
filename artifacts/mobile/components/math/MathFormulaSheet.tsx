/**
 * The Grade 10 formula sheet: every formula as the student books print it,
 * grouped by unit and lesson, each with the book and page it came from.
 *
 * Titles come from the knowledge base through the lesson id; the Arabic caption
 * above a formula is the book's own phrase or absent (`services/mathFormulaView.ts`).
 * A formula is symbols only, so it is forced left-to-right with `displayLtr`.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { toArabicDigits } from '@/services/labFormat';
import { displayLtr } from '@/services/mathCalc';
import { buildFormulaSheet, filterFormulaSheet, formulaCaption, type FormulaRow } from '@/services/mathFormulaView';

type Colors = ReturnType<typeof useColors>;
type Lang = 'ar' | 'en';

function FormulaCard({
  row,
  lang,
  colors,
  align,
  source,
}: {
  row: FormulaRow;
  lang: Lang;
  colors: Colors;
  align: 'left' | 'right';
  source: string;
}) {
  const caption = formulaCaption(row, lang);
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {caption ? (
        <Text style={[styles.caption, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
          {caption}
        </Text>
      ) : null}
      <Text
        selectable
        style={[styles.formula, { color: colors.foreground, textAlign: align === 'right' ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}
      >
        {displayLtr(row.formula)}
      </Text>
      <Text style={[styles.source, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{source}</Text>
    </View>
  );
}

export function MathFormulaSheet() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [unitId, setUnitId] = useState<string | null>(null);
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const sheet = useMemo(() => buildFormulaSheet(lang), [lang]);
  const shown = filterFormulaSheet(sheet, unitId);

  const sourceLine = (row: FormulaRow): string => {
    const page = lang === 'ar' ? toArabicDigits(String(row.page)) : String(row.page);
    const semester = t(row.book === 's1' ? 'mathFormulaSemester1' : 'mathFormulaSemester2');
    return `${t('mathFormulaBook')} · ${semester} · ${t('qrOnPage', page)}`;
  };

  const chips: { id: string | null; label: string }[] = [
    { id: null, label: t('mathFormulaAllUnits') },
    ...sheet.map(u => ({ id: u.unitId, label: u.title })),
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('mathFormulaGradeNote')}
      </Text>

      <View style={[styles.chips, { flexDirection: rowDir }]}>
        {chips.map(c => {
          const selected = c.id === unitId;
          return (
            <Pressable
              key={c.id ?? 'all'}
              onPress={() => {
                Haptics.selectionAsync();
                setUnitId(c.id);
              }}
              accessibilityRole="button"
              aria-selected={selected}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.primaryForeground : colors.foreground,
                  fontFamily: 'ReadexPro_500Medium',
                  fontSize: TYPE.label,
                }}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {shown.map(unit => (
        <View key={unit.unitId} style={styles.unit}>
          <Text style={[styles.unitTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_700Bold' }]}>{unit.title}</Text>
          {unit.lessons.map(lesson => (
            <View key={lesson.lessonId} style={styles.lesson}>
              <Text style={[styles.lessonTitle, { color: colors.primary, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {lesson.title}
              </Text>
              {lesson.formulas.map(row => (
                <FormulaCard key={row.id} row={row} lang={lang} colors={colors} align={align} source={sourceLine(row)} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACE.lg, gap: SPACE.md },
  note: { fontSize: TYPE.caption },
  chips: { flexWrap: 'wrap', gap: SPACE.sm },
  chip: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
  unit: { gap: SPACE.md, marginTop: SPACE.md },
  unitTitle: { fontSize: TYPE.title },
  lesson: { gap: SPACE.sm },
  lessonTitle: { fontSize: TYPE.body },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.xs },
  caption: { fontSize: TYPE.caption },
  formula: { fontSize: TYPE.bodyLg, lineHeight: 28 },
  source: { fontSize: TYPE.micro },
});
