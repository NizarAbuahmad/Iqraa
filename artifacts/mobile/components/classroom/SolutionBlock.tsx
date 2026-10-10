import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BoardSolution } from '@workspace/math-verify';
import { RADIUS, TYPE } from '@/constants/theme';
import { MathText } from '@/components/classroom/MathText';
import { DECK_ACCENT, DECK_BORDER, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';
import { hasRenderableMath, isolateForeignRuns } from '@/services/mathRender';
import {
  SOLUTION_BOX,
  SOLUTION_PAD,
  layoutSolution,
  solutionItems,
  type SolutionItem,
  type SolutionLabels,
} from '@/services/solutionLayout';

/** An unchecked verdict is amber on purpose: it must not read like the teal ✓. */
const UNCHECKED = '#B45309';

/**
 * The solved problem, drawn on the left of the page UNDER the pen. It takes no
 * touches (`pointerEvents="none"`), so the pen draws over it and the controls
 * live in the toolbar. The font size is chosen for the FULLY revealed text, so
 * it does not jump as steps appear. Two labels are never optional: the AI label
 * is always drawn, and the final answer never appears without its verdict.
 *
 * Three vertical zones guarantee that when the text does not fit: the header
 * (AI label) and the footer (answer, verdict, "understood as") are pinned and
 * never clip; only the body (problem and steps) may be cut off.
 */
export function SolutionBlock({ solution, shown, scale, isRTL, labels }: {
  solution: BoardSolution;
  /** How many steps are revealed. */
  shown: number;
  /** Screen pixels per canvas unit. */
  scale: number;
  isRTL: boolean;
  labels: SolutionLabels;
}) {
  const { ai, verified, unchecked, understoodAs } = labels;
  const fontSize = useMemo(() => {
    if (!(scale > 0)) return 0;
    const inner = { w: (SOLUTION_BOX.w - 2 * SOLUTION_PAD) * scale, h: (SOLUTION_BOX.h - 2 * SOLUTION_PAD) * scale };
    return layoutSolution(solutionItems(solution, { ai, verified, unchecked, understoodAs }, solution.steps.length), inner, {
      maxFont: TYPE.display * scale,
      minFont: Math.max(TYPE.micro, TYPE.label * scale),
    }).fontSize;
  }, [solution, ai, verified, unchecked, understoodAs, scale]);
  if (!(scale > 0)) return null;
  const items = solutionItems(solution, labels, shown);
  const header = items.filter(i => i.kind === 'ai');
  const body = items.filter(i => i.kind === 'problem' || i.kind === 'step');
  const footer = items.filter(i => i.kind === 'answer' || i.kind === 'verdict' || i.kind === 'understood');
  const line = (item: SolutionItem, i: number) => (
    <Line key={`${item.kind}-${i}`} item={item} first={i === 0} fontSize={fontSize} solution={solution} isRTL={isRTL} />
  );
  return (
    <View
      pointerEvents="none"
      style={[styles.panel, {
        left: SOLUTION_BOX.x * scale, top: SOLUTION_BOX.y * scale,
        width: SOLUTION_BOX.w * scale, height: SOLUTION_BOX.h * scale,
        padding: SOLUTION_PAD * scale, borderRadius: RADIUS.md * scale,
      }]}
    >
      <View style={styles.header}>{header.map(line)}</View>
      <View style={styles.body}>{body.map((item, i) => line(item, i + 1))}</View>
      <View style={styles.footer}>{footer.map((item, i) => line(item, i + 1))}</View>
    </View>
  );
}

function Line({ item, first, fontSize, solution, isRTL }: {
  item: SolutionItem;
  first: boolean;
  fontSize: number;
  solution: BoardSolution;
  isRTL: boolean;
}) {
  const small = item.kind === 'ai' || item.kind === 'understood';
  const size = small ? Math.max(TYPE.micro, fontSize * 0.8) : fontSize;
  const bold = item.kind === 'problem' || item.kind === 'answer' || item.kind === 'verdict';
  const color =
    item.kind === 'ai' || item.kind === 'understood' ? DECK_MUTED
    : item.kind === 'answer' ? DECK_ACCENT
    : item.kind === 'verdict' ? (solution.verified ? DECK_ACCENT : UNCHECKED)
    : DECK_TEXT;
  const fontFamily = bold ? 'ReadexPro_700Bold' : 'Almarai_400Regular';
  const align = isRTL ? 'right' : 'left';
  const math = item.kind === 'step' || item.kind === 'problem' || item.kind === 'answer';
  return (
    <View style={{ marginTop: first ? 0 : fontSize * 0.5 }}>
      {math && hasRenderableMath(item.text) ? (
        <MathText text={item.text} fontSize={size} color={color} fontFamily={fontFamily} isRTL={isRTL} />
      ) : (
        <Text style={{ fontSize: size, color, fontFamily, textAlign: align, lineHeight: Math.round(size * 1.4), writingDirection: isRTL ? 'rtl' : 'ltr' }}>
          {isolateForeignRuns(item.text)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: DECK_BORDER,
  },
  header: { flexShrink: 0 },
  body: { flex: 1, overflow: 'hidden' },
  footer: { flexShrink: 0 },
});
