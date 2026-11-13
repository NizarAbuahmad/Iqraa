/**
 * A physics figure (forces, attraction, projectile, circular motion, wave) on a
 * card. The geometry is `layoutScene` in lib/figure — the same primitives the
 * PDF's `figureSvg` draws — so the screen and the paper show one picture.
 * Colours follow the card (`readableOn`), and colour is never the only cue:
 * every arrow and mark carries its letter. Numbers and units are Latin, as in
 * the book; only «قمة» / «قاع» are Arabic.
 */
import React, { useId, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { figureAltText, layoutScene, type SceneFigure, type Tone } from '@workspace/figure';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';

const SERIES = ['#2563EB', '#DC2626', '#15803D'];
const HEIGHT = 240;
const BORDER = 1;
const MAX_WIDTH = 520;

export function SceneFigureView({ figure, lang }: { figure: SceneFigure; lang: 'ar' | 'en' }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const clipId = `scene${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const W = Math.max(0, width - 2 * BORDER);
  const H = HEIGHT - 2 * BORDER;
  const layout = useMemo(() => (W > 0 ? layoutScene(figure, { w: W, h: H }, lang) : null), [figure, W, H, lang]);
  const series = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 3)), [colors.card]);
  const ink = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 4.5)), [colors.card]);
  const stroke = (t: Tone) => (t === 'ink' ? colors.foreground : t === 'muted' ? colors.mutedForeground : series[t]!);
  const letter = (t: Tone) => (t === 'ink' ? colors.foreground : t === 'muted' ? colors.mutedForeground : ink[t]!);

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={figureAltText(figure, lang)}
      style={{ marginTop: 12, height: HEIGHT, width: '100%', maxWidth: MAX_WIDTH, alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start', borderWidth: BORDER, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden', backgroundColor: colors.card }}
    >
      {layout ? (
        <Svg width={W} height={H}>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={0} width={W} height={H} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            {layout.prims.map((p, i) => {
              const dash = 'dash' in p && p.dash ? '5 4' : undefined;
              const sw = p.tone === 'muted' ? 1.5 : 2;
              if (p.t === 'line') return <Line key={i} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />;
              if (p.t === 'arrow') {
                return (
                  <React.Fragment key={i}>
                    <Line x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />
                    <Polygon points={p.head.map(q => `${q.x},${q.y}`).join(' ')} fill={stroke(p.tone)} />
                  </React.Fragment>
                );
              }
              if (p.t === 'poly') {
                const pts = p.pts.map(q => `${q.x},${q.y}`).join(' ');
                return p.closed
                  ? <Polygon key={i} points={pts} fill="none" stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />
                  : <Polyline key={i} points={pts} fill="none" stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />;
              }
              if (p.t === 'circle') return <Circle key={i} cx={p.c.x} cy={p.c.y} r={p.r} fill={p.fill ? stroke(p.tone) : 'none'} stroke={stroke(p.tone)} strokeWidth={sw} />;
              return (
                <SvgText key={i} x={p.at.x} y={p.at.y} textAnchor={p.anchor} fill={letter(p.tone)} fontSize={13} fontFamily="ReadexPro_600SemiBold">
                  {p.text}
                </SvgText>
              );
            })}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
