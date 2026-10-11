/**
 * The scientific calculator: display, on-screen keypad, angle-mode toggle and
 * history. The maths lives in `services/mathCalc.ts` / `mathExpr.ts`; this file
 * only draws it.
 *
 * Two layout rules differ from the rest of the app on purpose. The keypad does
 * not mirror in RTL (7 8 9 sits top-left on every calculator), and the display
 * is forced LTR so Arabic-Indic digits and operators do not reorder inside an
 * RTL paragraph. There is no `TextInput`, so no keyboard to fight with.
 */
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import type { AngleMode, MathFailure } from '@/services/mathExpr';
import { toArabicDigits } from '@/services/labFormat';
import {
  displayLtr,
  entriesToDisplay,
  entriesToSegments,
  forceLtr,
  formatCalcNumber,
  initialCalcState,
  press,
  recall,
  type CalcKey,
  type CalcState,
} from '@/services/mathCalc';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

// Exhaustive on purpose: a new failure reason without a message fails to compile.
const ERROR_KEY: Record<MathFailure, TranslationKey> = {
  empty: 'mathErrEmpty',
  'too-long': 'mathErrTooLong',
  syntax: 'mathErrSyntax',
  unbalanced: 'mathErrUnbalanced',
  'unknown-symbol': 'mathErrUnknown',
  'function-needs-brackets': 'mathErrBrackets',
  'wrong-arity': 'mathErrArity',
  domain: 'mathErrDomain',
  'divide-by-zero': 'mathErrDivZero',
  overflow: 'mathErrOverflow',
  'factorial-domain': 'mathErrFactorial',
};

type KeyKind = 'digit' | 'op' | 'fn' | 'action' | 'equals';
type KeyDef = { key: CalcKey; label: string; arLabel?: string; kind: KeyKind };

const k = (key: CalcKey, label: string, kind: KeyKind, arLabel?: string): KeyDef => ({ key, label, kind, arLabel });
const d = (n: string): KeyDef => k(n as CalcKey, n, 'digit');

const SCI_ROW: KeyDef[] = [
  k('sin', 'sin', 'fn', 'جا'),
  k('cos', 'cos', 'fn', 'جتا'),
  k('tan', 'tan', 'fn', 'ظا'),
  k('sqrt', '√', 'fn'),
  k('x2', 'x²', 'fn', 'س²'),
];

const MORE_ROWS: KeyDef[][] = [
  [k('asin', 'sin⁻¹', 'fn', 'جا⁻¹'), k('acos', 'cos⁻¹', 'fn', 'جتا⁻¹'), k('atan', 'tan⁻¹', 'fn', 'ظا⁻¹'), k('^', 'xʸ', 'fn'), k('!', 'n!', 'fn')],
  [k('ln', 'ln', 'fn'), k('log', 'log', 'fn'), k('exp', 'eˣ', 'fn'), k('cbrt', '∛', 'fn'), k('abs', '|x|', 'fn')],
  [k('nCr', 'nCr', 'fn'), k('nPr', 'nPr', 'fn'), k('%', '%', 'fn'), k('pi', 'π', 'fn'), k('e', 'e', 'fn')],
];

const MAIN_ROWS: KeyDef[][] = [
  [d('7'), d('8'), d('9'), k('DEL', '⌫', 'action'), k('AC', 'AC', 'action')],
  [d('4'), d('5'), d('6'), k('*', '×', 'op'), k('/', '÷', 'op')],
  [d('1'), d('2'), d('3'), k('+', '+', 'op'), k('-', '−', 'op')],
  [d('0'), k('.', '.', 'digit'), k('(', '(', 'op'), k(')', ')', 'op'), k(',', ',', 'op', '،')],
];

function keyLabel(def: KeyDef, lang: 'ar' | 'en'): string {
  if (lang === 'ar') {
    if (def.arLabel) return def.arLabel;
    if (def.kind === 'digit') return toArabicDigits(def.label);
  }
  return def.label;
}

type Colors = ReturnType<typeof useColors>;

function Key({
  def,
  lang,
  colors,
  flex = 1,
  a11y,
  onPress,
}: {
  def: KeyDef;
  lang: 'ar' | 'en';
  colors: Colors;
  flex?: number;
  a11y?: string;
  onPress: (key: CalcKey) => void;
}) {
  const bg =
    def.kind === 'equals'
      ? colors.primary
      : def.kind === 'action'
        ? def.key === 'AC'
          ? colors.destructive
          : colors.muted
        : def.kind === 'fn'
          ? colors.secondary
          : def.kind === 'op'
            ? colors.muted
            : colors.card;
  const fg =
    def.kind === 'equals'
      ? colors.primaryForeground
      : def.key === 'AC'
        ? colors.destructiveForeground
        : def.kind === 'fn'
          ? colors.secondaryForeground
          : colors.foreground;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(def.key);
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? keyLabel(def, lang)}
      style={({ pressed }) => [
        styles.key,
        { flex, backgroundColor: bg, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.keyText, { color: fg, fontFamily: def.kind === 'fn' ? 'ReadexPro_500Medium' : 'ReadexPro_600SemiBold' }]}>
        {displayLtr(keyLabel(def, lang))}
      </Text>
    </Pressable>
  );
}

/**
 * The typed line. Arabic function words are their own `Text` and everything
 * else is one forced-LTR run (see `entriesToSegments`), laid out in a row so
 * the order is the typed order whatever the bidi algorithm would have done.
 */
function ExprText({
  entries,
  lang,
  label,
  style,
}: {
  entries: string[];
  lang: 'ar' | 'en';
  label: string;
  style: StyleProp<TextStyle>;
}) {
  const segments = entriesToSegments(entries, lang);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${entriesToDisplay(entries, lang)}`}
      style={styles.exprRow}
    >
      {segments.length === 0 ? <Text style={style}>{' '}</Text> : null}
      {segments.map((seg, i) => (
        <Text key={i} style={[style, styles.exprRun]}>
          {seg.word ? seg.text : forceLtr(seg.text)}
        </Text>
      ))}
    </View>
  );
}

function Result({ state, lang, colors, t }: { state: CalcState; lang: 'ar' | 'en'; colors: Colors; t: (k: TranslationKey) => string }) {
  const r = state.result;
  if (r === null) return <Text style={[styles.value, { color: colors.mutedForeground }]}>{' '}</Text>;
  if (!r.ok) {
    return (
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.error, { color: colors.destructive, fontFamily: 'ReadexPro_600SemiBold' }]}
      >
        {t(ERROR_KEY[r.reason])}
      </Text>
    );
  }
  const q = formatCalcNumber(r.value, lang);
  return (
    <View style={styles.valueRow} accessibilityLiveRegion="polite">
      <Text style={[styles.value, { color: colors.foreground }]}>{forceLtr(q.text)}</Text>
      {q.exponent !== null ? <Text style={[styles.exp, { color: colors.foreground }]}>{forceLtr(q.exponent)}</Text> : null}
    </View>
  );
}

export function MathCalculator() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [state, setState] = useState<CalcState>(initialCalcState);
  const [angle, setAngle] = useState<AngleMode>('deg');
  const [more, setMore] = useState(false);
  const align = isRTL ? 'right' : 'left';

  const onKey = (key: CalcKey) => setState(s => press(s, key, angle));
  const rows = more ? [SCI_ROW, ...MORE_ROWS] : [SCI_ROW];

  return (
    <View style={styles.wrap}>
      <View style={[styles.modeRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('mathCalcAngleMode')}
          style={[styles.segment, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          {(['deg', 'rad'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => setAngle(m)}
              accessibilityRole="radio"
              aria-checked={angle === m}
              style={[styles.segmentItem, angle === m && { backgroundColor: colors.primary }]}
            >
              <Text
                style={{
                  color: angle === m ? colors.primaryForeground : colors.foreground,
                  fontFamily: 'ReadexPro_500Medium',
                  fontSize: TYPE.caption,
                }}
              >
                {t(m === 'deg' ? 'mathCalcDeg' : 'mathCalcRad')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.display, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ExprText
          entries={state.entries}
          lang={lang}
          label={t('mathCalcExpression')}
          style={[styles.expr, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium' }]}
        />
        <Result state={state} lang={lang} colors={colors} t={t} />
      </View>

      <View style={styles.pad}>
        {rows.map((row, i) => (
          <View key={`s${i}`} style={styles.padRow}>
            {row.map(def => (
              <Key key={def.key} def={def} lang={lang} colors={colors} onPress={onKey} />
            ))}
          </View>
        ))}
        <Pressable
          onPress={() => setMore(m => !m)}
          accessibilityRole="button"
          style={[styles.moreToggle, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
        >
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>
            {more ? t('mathCalcLess') : t('mathCalcMore')}
          </Text>
        </Pressable>
        {MAIN_ROWS.map((row, i) => (
          <View key={`m${i}`} style={styles.padRow}>
            {row.map(def => (
              <Key
                key={def.key}
                def={def}
                lang={lang}
                colors={colors}
                onPress={onKey}
                a11y={def.key === 'DEL' ? t('mathCalcDelete') : def.key === 'AC' ? t('mathCalcClearAll') : undefined}
              />
            ))}
          </View>
        ))}
        <View style={styles.padRow}>
          <Key def={k('ans', 'Ans', 'op')} lang={lang} colors={colors} onPress={onKey} />
          <Key def={k('=', '=', 'equals')} lang={lang} colors={colors} onPress={onKey} flex={4} />
        </View>
      </View>

      <Text style={[styles.historyTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('mathCalcHistory')}
      </Text>
      {state.history.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption }}>
          {t('mathCalcHistoryEmpty')}
        </Text>
      ) : (
        state.history.map((item, i) => {
          const q = formatCalcNumber(item.value, lang);
          return (
            <Pressable
              key={`${i}-${item.entries.join('')}`}
              onPress={() => setState(s => recall(s, item))}
              accessibilityRole="button"
              style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <ExprText
                entries={item.entries}
                lang={lang}
                label={t('mathCalcExpression')}
                style={[styles.historyExpr, { color: colors.mutedForeground }]}
              />
              <Text style={[styles.historyValue, { color: colors.foreground }]} numberOfLines={1}>
                {forceLtr(`= ${q.text}${q.exponent !== null ? `^${q.exponent}` : ''}`)}
              </Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

// Right-aligned like every calculator. Direction itself comes from `forceLtr`:
// react-native-web stamps dir="auto" on each Text, which beats any style.
const LTR = { textAlign: 'right' as const };

const styles = StyleSheet.create({
  wrap: { padding: SPACE.lg, gap: SPACE.md },
  modeRow: {},
  segment: { borderRadius: RADIUS.pill, padding: SPACE.xs },
  segmentItem: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
  display: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, minHeight: 112, justifyContent: 'space-between' },
  exprRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  // A run can be 30 digits with no break point; let it shrink and wrap by character
  // or it runs off the screen and hides what is being typed.
  exprRun: { flexShrink: 1, minWidth: 0, ...(Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as object) : null) },
  expr: { ...LTR, fontSize: TYPE.title, lineHeight: 28 },
  valueRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start' },
  value: { ...LTR, fontSize: TYPE.hero, lineHeight: 40, fontFamily: 'ReadexPro_700Bold' },
  exp: { fontSize: TYPE.body, marginTop: SPACE.xs, fontFamily: 'ReadexPro_700Bold' },
  error: { ...LTR, fontSize: TYPE.body, lineHeight: 28 },
  pad: { gap: SPACE.sm },
  padRow: { flexDirection: 'row', gap: SPACE.sm },
  key: { minHeight: 50, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: TYPE.bodyLg },
  moreToggle: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.xs },
  historyTitle: { fontSize: TYPE.body, marginTop: SPACE.sm },
  historyRow: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  historyExpr: { ...LTR, fontSize: TYPE.label, fontFamily: 'Almarai_400Regular' },
  historyValue: { ...LTR, fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
});
