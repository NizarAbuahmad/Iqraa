import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { DECK_BORDER, DECK_MUTED } from '@/services/deckTheme';
import {
  BOARD_STEP,
  CANVAS_H,
  CANVAS_W,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground as BoardBackgroundKind,
} from '@/services/whiteboardModel';

/**
 * The paper behind the ink, drawn in canvas units (1280 × 720) inside a
 * viewBox, so it scales with the page. The parent must be the 16:9 stage.
 * Purely visual: it never takes a touch, so the canvas above it gets every
 * event. `axes` is a grid with the x and y axes and one numbered tick per
 * square (digits localised at display time only).
 */
export function BoardBackground({ kind, lang }: { kind: BoardBackgroundKind; lang: string }) {
  if (kind === 'blank') return null;
  const grid = gridLines(CANVAS_W, CANVAS_H, BOARD_STEP);
  const axes = kind === 'axes' ? axesGeometry(CANVAS_W, CANVAS_H, BOARD_STEP) : null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none">
        {grid.map((s, i) => (
          <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={DECK_BORDER} strokeWidth={1.5} />
        ))}
        {axes && (
          <>
            <Line {...axes.xAxis} stroke={DECK_MUTED} strokeWidth={3} />
            <Line {...axes.yAxis} stroke={DECK_MUTED} strokeWidth={3} />
            {axes.ticks.map((tick, i) => (
              <SvgText
                key={i}
                x={tick.axis === 'x' ? tick.x : tick.x - 8}
                y={tick.axis === 'x' ? tick.y + 22 : tick.y + 5}
                fontSize={16}
                fill={DECK_MUTED}
                textAnchor={tick.axis === 'x' ? 'middle' : 'end'}
              >
                {localizeDigits(tick.value, lang)}
              </SvgText>
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}
