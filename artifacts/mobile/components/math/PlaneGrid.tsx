/**
 * The coordinate plane's backdrop — paper, grid lines, axes and tick labels —
 * shared by the grapher and the geometry sketchpad so the two read as one
 * family. Render it as the first child of an `<Svg>`; the tool draws on top.
 *
 * The ticks come from `mathViewport.gridTicks`, so the step is a "nice" number
 * at every zoom and the labels never crowd.
 */
import React from 'react';
import { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { useColors } from '@/hooks/useColors';
import { TYPE } from '@/constants/theme';
import { toArabicDigits } from '@/services/labFormat';
import { gridTicks, toPx, type Viewport } from '@/services/mathViewport';

type Colors = ReturnType<typeof useColors>;

/** An axis number for the screen: Arabic-Indic in Arabic, a real minus sign in both. */
export function axisLabel(value: number, lang: 'ar' | 'en', degrees: boolean): string {
  const s = Math.abs(value).toString();
  const body = lang === 'ar' ? toArabicDigits(s) : s;
  return `${value < 0 ? '−' : ''}${body}${degrees ? '°' : ''}`;
}

export function PlaneGrid({
  vp,
  degreeAxis = false,
  lang,
  colors,
}: {
  vp: Viewport;
  degreeAxis?: boolean;
  lang: 'ar' | 'en';
  colors: Colors;
}) {
  const { xs, ys } = gridTicks(vp, degreeAxis ? 'deg' : 'decimal');
  const origin = toPx(vp, 0, 0);
  const axisX = origin.x >= 0 && origin.x <= vp.w ? origin.x : null;
  const axisY = origin.y >= 0 && origin.y <= vp.h ? origin.y : null;
  const xLabelY = Math.min(vp.h - 4, Math.max(14, (axisY ?? vp.h) + 14));
  const yLabelX = Math.min(vp.w - 28, Math.max(4, (axisX ?? 0) + 5));
  const label = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, fill: colors.mutedForeground };

  return (
    <>
      <Rect x={0} y={0} width={vp.w} height={vp.h} fill={colors.card} />
      {xs.map(t => (
        <Line key={`gx${t.value}`} x1={t.px} y1={0} x2={t.px} y2={vp.h} stroke={colors.border} strokeWidth={1} />
      ))}
      {ys.map(t => (
        <Line key={`gy${t.value}`} x1={0} y1={t.px} x2={vp.w} y2={t.px} stroke={colors.border} strokeWidth={1} />
      ))}
      {axisX !== null ? <Line x1={axisX} y1={0} x2={axisX} y2={vp.h} stroke={colors.foreground} strokeOpacity={0.6} strokeWidth={1.5} /> : null}
      {axisY !== null ? <Line x1={0} y1={axisY} x2={vp.w} y2={axisY} stroke={colors.foreground} strokeOpacity={0.6} strokeWidth={1.5} /> : null}
      {xs.filter(t => t.value !== 0).map(t => (
        <SvgText
          key={`lx${t.value}`}
          x={t.px < 18 ? 2 : t.px > vp.w - 18 ? vp.w - 2 : t.px}
          y={xLabelY}
          textAnchor={t.px < 18 ? 'start' : t.px > vp.w - 18 ? 'end' : 'middle'}
          {...label}
        >
          {axisLabel(t.value, lang, degreeAxis)}
        </SvgText>
      ))}
      {ys.filter(t => t.value !== 0).map(t => (
        <SvgText key={`ly${t.value}`} x={yLabelX} y={t.px - 3} textAnchor="start" {...label}>
          {axisLabel(t.value, lang, false)}
        </SvgText>
      ))}
    </>
  );
}
