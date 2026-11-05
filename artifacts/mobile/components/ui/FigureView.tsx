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
import { gridTicks, toPx } from '@workspace/figure/viewport';
import { PlaneGrid } from '@/components/math/PlaneGrid';
import { TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';

const SERIES = ['#2563EB', '#DC2626', '#15803D'];
const HEIGHT = 240;
/** The View's own border; the drawing is sized to what is inside it, or the last pixel row and column are cropped. */
const BORDER = 1;
/** A wider figure only shrinks the vectors on a desktop (the plane is equal-aspect), so it stops growing here. */
const MAX_WIDTH = 520;

export function FigureView({ figure, lang }: { figure: Figure; lang: 'ar' | 'en' }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  // Several figures can share a screen, so the clip id must be unique per instance.
  const clipId = `figclip${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  // The inner box: the measured outer size less the border on both sides.
  const W = Math.max(0, width - 2 * BORDER);
  const H = HEIGHT - 2 * BORDER;
  const layout = useMemo(() => (W > 0 ? layoutFigure(figure, { w: W, h: H }) : null), [figure, W, H]);
  // Lines need 3:1 on the card; a 13px letter needs 4.5:1, or «A» and «f» sink into the dark card.
  const series = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 3)), [colors.card]);
  const ink = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 4.5)), [colors.card]);
  const color = (i: number) => series[i % series.length]!;
  const letter = (i: number) => ink[i % ink.length]!;
  // `layoutFigure` already puts every letter inside the box and off its own line (`placeLabel`); this is only the
  // last-resort net for a box that changed size under it, with the same bounds: the whole glyph stays inside.
  const inBox = (p: { x: number; y: number }) => ({ x: Math.min(Math.max(p.x, 2), W - 12), y: Math.min(Math.max(p.y, 13), H - 4) });

  const origin = layout ? toPx(layout.viewport, 0, 0) : null;
  const axisName = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, fill: colors.foreground };
  // The axis names must not sit on a tick number. «س» is above the x axis (the numbers are below it) and ends
  // inside the box whatever the glyph's width. «ص» goes left of the y axis (its numbers are on the right); only
  // when the axis is at the left edge does it take the right side, and then only if no tick number is there.
  const yNameLeft = origin !== null && origin.x >= 24;
  const yNameFree =
    layout !== null &&
    origin !== null &&
    origin.x >= 0 &&
    origin.x <= W &&
    // an x axis within the top rows shares them with its own numbers, where the name would sit
    !(origin.y >= 0 && origin.y < 28) &&
    (yNameLeft || !gridTicks(layout.viewport).ys.some(t => t.value !== 0 && Math.abs(t.px - 3 - 14) < 12));

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={figureAltText(figure, lang)}
      // RTL here is hand-made (text-align and row-reverse), so a narrower figure is pushed to the text's edge by hand.
      style={{ marginTop: 12, height: HEIGHT, width: '100%', maxWidth: MAX_WIDTH, alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start', borderWidth: BORDER, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden' }}
    >
      {layout ? (
        <Svg width={W} height={H}>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={0} width={W} height={H} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <PlaneGrid vp={layout.viewport} lang={lang} colors={colors} />
            {origin && origin.y >= 14 && origin.y <= H ? (
              <SvgText x={W - 6} y={origin.y - 5} textAnchor="end" {...axisName}>{lang === 'ar' ? 'س' : 'x'}</SvgText>
            ) : null}
            {yNameFree && origin ? (
              <SvgText x={yNameLeft ? origin.x - 6 : origin.x + 6} y={14} textAnchor={yNameLeft ? 'end' : 'start'} {...axisName}>{lang === 'ar' ? 'ص' : 'y'}</SvgText>
            ) : null}
            {layout.curves.map((c, i) => (
              <React.Fragment key={`c${i}`}>
                {c.segments.map((s, j) => (
                  <Polyline key={j} points={s.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color(c.colorIndex)} strokeWidth={2} />
                ))}
                {c.label && c.labelAt ? <SvgText {...inBox(c.labelAt)} fill={letter(c.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{c.label}</SvgText> : null}
              </React.Fragment>
            ))}
            {layout.components.map((c, i) => (
              <Line key={`d${i}`} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke={colors.mutedForeground} strokeWidth={1.5} strokeDasharray="4 3" />
            ))}
            {layout.arrows.map((a, i) => (
              <React.Fragment key={`a${i}`}>
                <Line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke={color(a.colorIndex)} strokeWidth={2} />
                <Polygon points={a.head.map(p => `${p.x},${p.y}`).join(' ')} fill={color(a.colorIndex)} />
                {a.label && a.labelAt ? <SvgText {...inBox(a.labelAt)} fill={letter(a.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{a.label}</SvgText> : null}
              </React.Fragment>
            ))}
            {layout.points.map((p, i) => (
              <React.Fragment key={`p${i}`}>
                <Circle cx={p.at.x} cy={p.at.y} r={4} fill={color(p.colorIndex)} />
                <SvgText {...inBox(p.labelAt)} fill={letter(p.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{p.label}</SvgText>
              </React.Fragment>
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
