import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Text as SvgText } from 'react-native-svg';
import { DECK_BORDER, DECK_MUTED } from '@/services/deckTheme';
import {
  BOARD_STEP,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground as BoardBackgroundKind,
} from '@/services/whiteboardModel';

/**
 * The paper behind the ink. Purely visual: it never takes a touch, so the
 * canvas above it gets every event. `axes` is a grid with the x and y axes and
 * one numbered tick per square (digits localised at display time only).
 */
export function BoardBackground({ kind, width, height, lang }: {
  kind: BoardBackgroundKind;
  width: number;
  height: number;
  lang: string;
}) {
  if (kind === 'blank' || !(width > 0) || !(height > 0)) return null;
  const grid = gridLines(width, height, BOARD_STEP);
  const axes = kind === 'axes' ? axesGeometry(width, height, BOARD_STEP) : null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        {grid.map((s, i) => (
          <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={DECK_BORDER} strokeWidth={1} />
        ))}
        {axes && (
          <>
            <Line {...axes.xAxis} stroke={DECK_MUTED} strokeWidth={2} />
            <Line {...axes.yAxis} stroke={DECK_MUTED} strokeWidth={2} />
            {axes.ticks.map((tick, i) => (
              <SvgText
                key={i}
                x={tick.axis === 'x' ? tick.x : tick.x - 6}
                y={tick.axis === 'x' ? tick.y + 16 : tick.y + 4}
                fontSize={12}
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
