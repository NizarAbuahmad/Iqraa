import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BoardSolution } from '@workspace/math-verify';
import { MathText } from '@/components/classroom/MathText';
import { DECK_ACCENT, DECK_BORDER, DECK_MUTED, DECK_TEXT } from '@/services/deckTheme';
import { hasRenderableMath } from '@/services/mathRender';
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
  if (!(scale > 0)) return null;
  const inner = { w: (SOLUTION_BOX.w - 2 * SOLUTION_PAD) * scale, h: (SOLUTION_BOX.h - 2 * SOLUTION_PAD) * scale };
  const layout = layoutSolution(solutionItems(solution, labels, solution.steps.length), inner, {
    maxFont: 28 * scale,
    minFont: Math.max(11, 14 * scale),
  });
  const items = solutionItems(solution, labels, shown);
  return (
    <View
      pointerEvents="none"
      style={[styles.panel, {
        left: SOLUTION_BOX.x * scale, top: SOLUTION_BOX.y * scale,
        width: SOLUTION_BOX.w * scale, height: SOLUTION_BOX.h * scale,
        padding: SOLUTION_PAD * scale, borderRadius: 14 * scale,
      }]}
    >
      {items.map((item, i) => (
        <Line key={i} item={item} first={i === 0} fontSize={layout.fontSize} solution={solution} isRTL={isRTL} />
      ))}
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
  const size = small ? fontSize * 0.8 : fontSize;
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
          {item.text}
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
});
