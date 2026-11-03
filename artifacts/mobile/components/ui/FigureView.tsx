/**
 * A drawn figure (function graph or vectors) on a card, from a gated spec.
 *
 * The geometry is `layoutFigure` in lib/figure — the same numbers the review
 * script's SVG uses — and the backdrop is the Math Corner's `PlaneGrid`, so a
 * figure reads like the grapher. The plane is not mirrored in RTL (x grows to
 * the right in both languages); only the axis names and tick digits change.
 * Colour is never the only cue: every curve and vector carries its letter.
 *
 * `layoutFigure` puts coordinates far outside the box on purpose (a curve climbs
 * off the canvas), so the drawing is clipped twice: by the parent View's
 * `overflow: 'hidden'` and by a `ClipPath` over the canvas rectangle, because a
 * native `Svg` child can paint outside its own bounds.
 */
import React, { useId, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Circle, Defs, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { figureAltText, layoutFigure, type Figure } from '@workspace/figure';
import { toPx } from '@workspace/figure/viewport';
import { PlaneGrid } from '@/components/math/PlaneGrid';
import { TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';

const SERIES = ['#2563EB', '#DC2626', '#15803D'];
const HEIGHT = 240;

export function FigureView({ figure, lang }: { figure: Figure; lang: 'ar' | 'en' }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  // Several figures can share a screen, so the clip id must be unique per instance.
  const clipId = `figclip${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const layout = useMemo(() => (width > 0 ? layoutFigure(figure, { w: width, h: HEIGHT }) : null), [figure, width]);
  const series = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 3)), [colors.card]);
  const color = (i: number) => series[i % series.length]!;

  const origin = layout ? toPx(layout.viewport, 0, 0) : null;
  const axisName = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, fill: colors.foreground };

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={figureAltText(figure, lang)}
      style={{ marginTop: 12, height: HEIGHT, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden' }}
    >
      {layout ? (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={0} width={width} height={HEIGHT} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <PlaneGrid vp={layout.viewport} lang={lang} colors={colors} />
            {origin && origin.y >= 0 && origin.y <= HEIGHT ? (
              <SvgText x={width - 14} y={origin.y - 5} {...axisName}>{lang === 'ar' ? 'س' : 'x'}</SvgText>
            ) : null}
            {origin && origin.x >= 0 && origin.x <= width ? (
              <SvgText x={origin.x + 6} y={14} {...axisName}>{lang === 'ar' ? 'ص' : 'y'}</SvgText>
            ) : null}
            {layout.curves.map((c, i) => (
              <React.Fragment key={`c${i}`}>
                {c.segments.map((s, j) => (
                  <Polyline key={j} points={s.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color(c.colorIndex)} strokeWidth={2} />
                ))}
                {c.label && c.labelAt ? <SvgText x={c.labelAt.x} y={c.labelAt.y} fill={color(c.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{c.label}</SvgText> : null}
              </React.Fragment>
            ))}
            {layout.components.map((c, i) => (
              <Line key={`d${i}`} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke={colors.mutedForeground} strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
            {layout.arrows.map((a, i) => (
              <React.Fragment key={`a${i}`}>
                <Line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke={color(a.colorIndex)} strokeWidth={2} />
                <Polygon points={a.head.map(p => `${p.x},${p.y}`).join(' ')} fill={color(a.colorIndex)} />
                {a.label && a.labelAt ? <SvgText x={a.labelAt.x} y={a.labelAt.y} fill={color(a.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{a.label}</SvgText> : null}
              </React.Fragment>
            ))}
            {layout.points.map((p, i) => (
              <React.Fragment key={`p${i}`}>
                <Circle cx={p.at.x} cy={p.at.y} r={4} fill={color(p.colorIndex)} />
                <SvgText x={p.labelAt.x} y={p.labelAt.y} fill={color(p.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{p.label}</SvgText>
              </React.Fragment>
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
