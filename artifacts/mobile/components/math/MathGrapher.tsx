/**
 * The function grapher: up to four functions on an equal-aspect plane you can
 * drag, pinch and wheel-zoom, with the zeros, maximum and minimum values and
 * intersections found and marked, and a tap that reads a point off the curves.
 *
 * Everything that is arithmetic is a tested pure module — `mathExpr.compile`
 * (the function), `mathViewport` (the view), `mathGraph` (the curve and its
 * special points), `mathGeogebra` (the link-out). This file draws them and
 * turns touches into calls on them. Drawn with react-native-svg, so it works
 * offline on web and Android, with no GeoGebra embed.
 *
 * The special points are computed from the view the user last *settled* on
 * (finger up, wheel stopped, button pressed), not on every frame of a drag.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import type { TranslationKey } from '@/services/i18n';
import { scheme } from '@/constants/colors';
import { seriesColor } from '@/services/deckVisuals';
import { toArabicDigits } from '@/services/labFormat';
import { forceLtr, formatCalcNumber } from '@/services/mathCalc';
import { openGeogebraWithCommands } from '@/services/geogebra';
import { geogebraCommands, type GraphCurve } from '@/services/mathGeogebra';
import { compile, type AngleMode } from '@/services/mathExpr';
import {
  curveSegments,
  findExtrema,
  findIntersections,
  findRoots,
  parseCurveInput,
  toPathD,
  traceAt,
  verticalLine,
  type Extremum,
} from '@/services/mathGraph';
import {
  bounds,
  equalize,
  gridTicks,
  makeViewport,
  panBy,
  resize,
  toPx,
  toWorld,
  zoomAt,
  type Point,
  type Viewport,
} from '@/services/mathViewport';
import { MATH_ERROR_KEY } from './mathErrors';
import { useScrollLock } from './MathFrame';
import { useCanvasGestures } from './useCanvasGestures';

type Lang = 'ar' | 'en';
type Colors = ReturnType<typeof useColors>;

const MAX_ROWS = 4;

/**
 * The slide palette (`seriesColor`) is chosen for white paper; its first teal
 * is dim on the dark card, so dark mode gets brighter relatives of the same hues.
 */
const DARK_CURVE_COLORS = ['#5EEAD4', '#FB923C', '#A5B4FC', '#F9A8D4'];
const curveColor = (i: number): string => (scheme === 'dark' ? DARK_CURVE_COLORS[i % DARK_CURVE_COLORS.length] : seriesColor(i));
const SHOWN_POINTS = 6;

type Row = { id: number; text: string };

type Curve =
  | { id: number; color: string; kind: 'explicit'; text: string; expr: string; f: (x: number) => number }
  | { id: number; color: string; kind: 'vertical'; text: string; x: number }
  | { id: number; color: string; kind: 'error'; text: string; message: TranslationKey }
  | { id: number; color: string; kind: 'empty'; text: string };

function parseRow(row: Row, index: number, angle: AngleMode): Curve {
  const base = { id: row.id, color: curveColor(index), text: row.text };
  const parsed = parseCurveInput(row.text);
  if (!parsed.ok) {
    if (parsed.reason === 'empty') return { ...base, kind: 'empty' };
    return {
      ...base,
      kind: 'error',
      message: parsed.reason === 'implicit-unsupported' ? 'mathGraphUnsupported' : 'mathGraphBadVertical',
    };
  }
  if (parsed.kind === 'vertical') return { ...base, kind: 'vertical', x: parsed.x };
  const c = compile(parsed.expr, { angle });
  return c.ok ? { ...base, kind: 'explicit', expr: parsed.expr, f: c.f } : { ...base, kind: 'error', message: MATH_ERROR_KEY[c.reason] };
}

/** Digits for the screen: Arabic-Indic in Arabic, a real minus sign in both. */
function num(n: number, lang: Lang): string {
  const q = formatCalcNumber(n, lang);
  return q.exponent === null ? q.text : `${q.text}^${q.exponent}`;
}
const pointText = (p: Point, lang: Lang): string => `(${num(p.x, lang)}, ${num(p.y, lang)})`;

// ---------------------------------------------------------------------------
// What is found on the settled view

type Found = {
  roots: number[];
  extrema: Extremum[];
  yIntercept: Point | null;
};

type PairFound = { a: number; b: number; points: Point[] };

function findAll(curves: Curve[], view: Viewport): { perCurve: Map<number, Found>; pairs: PairFound[] } {
  const b = bounds(view);
  const perCurve = new Map<number, Found>();
  const explicit = curves.filter((c): c is Extract<Curve, { kind: 'explicit' }> => c.kind === 'explicit');
  for (const c of explicit) {
    perCurve.set(c.id, {
      roots: findRoots(c.f, b.xMin, b.xMax),
      extrema: findExtrema(c.f, b.xMin, b.xMax),
      yIntercept: traceAt(c.f, 0),
    });
  }
  const pairs: PairFound[] = [];
  explicit.forEach((ca, i) => {
    explicit.slice(i + 1).forEach(cb => {
      const points = findIntersections(ca.f, cb.f, b.xMin, b.xMax);
      if (points.length > 0) pairs.push({ a: curves.indexOf(ca) + 1, b: curves.indexOf(cb) + 1, points });
    });
  });
  return { perCurve, pairs };
}

// ---------------------------------------------------------------------------
// The canvas

function axisLabel(value: number, lang: Lang, degrees: boolean): string {
  const s = Math.abs(value).toString();
  const body = lang === 'ar' ? toArabicDigits(s) : s;
  return `${value < 0 ? '−' : ''}${body}${degrees ? '°' : ''}`;
}

function GraphCanvas({
  vp,
  curves,
  markers,
  traceX,
  degreeAxis,
  lang,
  colors,
}: {
  vp: Viewport;
  curves: Curve[];
  markers: { perCurve: Map<number, Found>; pairs: PairFound[] };
  traceX: number | null;
  degreeAxis: boolean;
  lang: Lang;
  colors: Colors;
}) {
  const { xs, ys } = gridTicks(vp, degreeAxis ? 'deg' : 'decimal');
  const origin = toPx(vp, 0, 0);
  const axisX = origin.x >= 0 && origin.x <= vp.w ? origin.x : null;
  const axisY = origin.y >= 0 && origin.y <= vp.h ? origin.y : null;
  const xLabelY = Math.min(vp.h - 4, Math.max(14, (axisY ?? vp.h) + 14));
  const yLabelX = Math.min(vp.w - 28, Math.max(4, (axisX ?? 0) + 5));
  const inView = (p: Point) => p.x >= 0 && p.x <= vp.w && p.y >= 0 && p.y <= vp.h;
  const label = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, fill: colors.mutedForeground };

  return (
    <Svg width={vp.w} height={vp.h}>
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

      {curves.map(c => {
        if (c.kind === 'explicit') {
          return (
            <Path key={c.id} d={toPathD(curveSegments(c.f, vp))} stroke={c.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          );
        }
        if (c.kind === 'vertical') {
          const [a, b] = verticalLine(c.x, vp);
          return <Line key={c.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.color} strokeWidth={2.5} />;
        }
        return null;
      })}

      {curves.map(c => {
        const f = markers.perCurve.get(c.id);
        if (c.kind !== 'explicit' || !f) return null;
        return (
          <React.Fragment key={`m${c.id}`}>
            {f.roots.map(x => {
              const p = toPx(vp, x, 0);
              return inView(p) ? <Circle key={`r${x}`} cx={p.x} cy={p.y} r={4.5} fill={colors.card} stroke={c.color} strokeWidth={2} /> : null;
            })}
            {f.extrema.map(e => {
              const p = toPx(vp, e.x, e.y);
              return inView(p) ? <Circle key={`e${e.kind}${e.x}`} cx={p.x} cy={p.y} r={4.5} fill={c.color} /> : null;
            })}
          </React.Fragment>
        );
      })}
      {markers.pairs.flatMap(pair =>
        pair.points.map(pt => {
          const p = toPx(vp, pt.x, pt.y);
          return inView(p) ? <Circle key={`i${pair.a}${pair.b}${pt.x}`} cx={p.x} cy={p.y} r={5} fill={colors.foreground} stroke={colors.card} strokeWidth={1.5} /> : null;
        }),
      )}

      {traceX !== null ? (
        <>
          <Line x1={toPx(vp, traceX, 0).x} y1={0} x2={toPx(vp, traceX, 0).x} y2={vp.h} stroke={colors.foreground} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 4" />
          {curves.map(c => {
            if (c.kind !== 'explicit') return null;
            const hit = traceAt(c.f, traceX);
            if (!hit) return null;
            const p = toPx(vp, hit.x, hit.y);
            return inView(p) ? <Circle key={`t${c.id}`} cx={p.x} cy={p.y} r={5} fill={c.color} stroke={colors.card} strokeWidth={2} /> : null;
          })}
        </>
      ) : null}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// The screen

const INSERTS: { text: string; label: string; arLabel?: string }[] = [
  { text: 'x', label: 'x', arLabel: 'س' },
  { text: '^', label: '^' },
  { text: 'sqrt(', label: '√' },
  { text: 'pi', label: 'π' },
  { text: 'sin(', label: 'sin', arLabel: 'جا' },
  { text: 'cos(', label: 'cos', arLabel: 'جتا' },
  { text: 'tan(', label: 'tan', arLabel: 'ظا' },
  { text: 'abs(', label: '|x|' },
  { text: 'ln(', label: 'ln' },
];

export function MathGrapher() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const lock = useScrollLock();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const nextId = useRef(2);
  const [rows, setRows] = useState<Row[]>([{ id: 1, text: 'x^2' }]);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [angle, setAngle] = useState<AngleMode>('deg');
  const [trig, setTrig] = useState(false);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [settled, setSettled] = useState<Viewport | null>(null);
  const [traceX, setTraceX] = useState<number | null>(null);

  const vpRef = useRef<Viewport | null>(null);
  vpRef.current = vp;

  const curves = useMemo(() => rows.map((r, i) => parseRow(r, i, angle)), [rows, angle]);
  const markers = useMemo(() => (settled ? findAll(curves, settled) : { perCurve: new Map<number, Found>(), pairs: [] }), [curves, settled]);

  // -- view ----------------------------------------------------------------
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w <= 0) return;
    const h = Math.max(240, Math.min(Math.round(w * 0.95), 420));
    setVp(v => {
      const next = v ? resize(v, w, h) : makeViewport(w, h, 'standard');
      if (!v) setSettled(next);
      return next;
    });
  };

  /** Set the view and settle on it at once (a button, not a drag). */
  const apply = useCallback((next: Viewport) => {
    setVp(next);
    setSettled(next);
  }, []);

  const gestures = useCanvasGestures({
    onPan: (dx, dy) => setVp(v => (v ? panBy(v, dx, dy) : v)),
    onZoom: (f, ax, ay) => setVp(v => (v ? zoomAt(v, f, ax, ay) : v)),
    onTap: (x, y) => {
      const v = vpRef.current;
      if (v) setTraceX(toWorld(v, x, y).x);
    },
    onEnd: () => {
      if (vpRef.current) setSettled(vpRef.current);
    },
    onLock: lock,
  });

  const zoomButton = (factor: number) => {
    Haptics.selectionAsync();
    if (vp) apply(zoomAt(vp, factor, vp.w / 2, vp.h / 2));
  };
  const home = () => {
    Haptics.selectionAsync();
    setTrig(false);
    setTraceX(null);
    if (vp) apply(makeViewport(vp.w, vp.h, 'standard'));
  };
  const trigView = (a: AngleMode = angle) => {
    Haptics.selectionAsync();
    setTrig(true);
    if (vp) apply(makeViewport(vp.w, vp.h, a === 'deg' ? 'trig-deg' : 'trig-rad'));
  };
  const chooseAngle = (a: AngleMode) => {
    setAngle(a);
    if (trig) trigView(a);
  };

  // -- rows ----------------------------------------------------------------
  const setText = (id: number, text: string) => setRows(rs => rs.map(r => (r.id === id ? { ...r, text } : r)));
  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    const id = nextId.current++;
    setRows(rs => [...rs, { id, text: '' }]);
    setFocusId(id);
  };
  const removeRow = (id: number) => setRows(rs => (rs.length > 1 ? rs.filter(r => r.id !== id) : rs));
  const insert = (text: string) => {
    const target = focusId ?? rows[0]?.id;
    if (target !== undefined) setRows(rs => rs.map(r => (r.id === target ? { ...r, text: r.text + text } : r)));
  };

  // -- readouts ------------------------------------------------------------
  const graphCurves: GraphCurve[] = curves.flatMap((c): GraphCurve[] =>
    c.kind === 'explicit' ? [{ kind: 'explicit', expr: c.expr }] : c.kind === 'vertical' ? [{ kind: 'vertical', x: c.x }] : [],
  );
  const link = geogebraCommands(graphCurves, angle);
  const traceRows = traceX === null ? [] : curves.filter((c): c is Extract<Curve, { kind: 'explicit' }> => c.kind === 'explicit');

  const ctl = (name: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.ctl, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={name} size={20} color={colors.primary} />
    </Pressable>
  );
  const textCtl = (label: string, a11y: string, onPress: () => void, active = false) => (
    <Pressable
      key={a11y}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      aria-selected={active}
      style={({ pressed }) => [styles.ctlText, { backgroundColor: active ? colors.primary : colors.secondary, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={{ color: active ? colors.primaryForeground : colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label }}>{label}</Text>
    </Pressable>
  );

  const heading = (text: string) => (
    <Text style={[styles.heading, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>{text}</Text>
  );
  const chip = (key: string, body: React.ReactNode, color: string) => (
    <View key={key} style={[styles.pointChip, { backgroundColor: colors.muted, borderColor: color, flexDirection: rowDir }]}>
      {body}
    </View>
  );
  const pointChip = (key: string, p: Point, color: string, tag?: string) =>
    chip(
      key,
      <>
        <Text style={[styles.pointText, { color: colors.foreground }]}>{forceLtr(pointText(p, lang))}</Text>
        {tag ? <Text style={[styles.pointTag, { color: colors.mutedForeground }]}>{tag}</Text> : null}
      </>,
      color,
    );
  const none = <Text style={[styles.none, { color: colors.mutedForeground, textAlign: align }]}>{t('mathGraphNone')}</Text>;
  const n = (i: number) => (lang === 'ar' ? toArabicDigits(String(i)) : String(i));

  return (
    <View style={styles.wrap}>
      {/* functions */}
      {rows.map((row, i) => {
        const c = curves[i];
        return (
          <View key={row.id} style={styles.rowBlock}>
            <View style={[styles.inputRow, { flexDirection: rowDir }]}>
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <TextInput
                value={row.text}
                onChangeText={text => setText(row.id, text)}
                onFocus={() => setFocusId(row.id)}
                placeholder={t('mathGraphPlaceholder')}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t('mathGraphFunctionN', n(i + 1))}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}
              />
              {rows.length > 1 ? (
                <Pressable
                  onPress={() => removeRow(row.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('mathGraphRemove')}
                  style={({ pressed }) => [styles.remove, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name="close" size={20} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {c.kind === 'error' ? (
              <Text style={[styles.error, { color: colors.destructive, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t(c.message)}</Text>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.insertRow, { flexDirection: rowDir }]}>
        {INSERTS.map(k => (
          <Pressable
            key={k.text}
            onPress={() => insert(k.text)}
            accessibilityRole="button"
            accessibilityLabel={k.label}
            style={({ pressed }) => [styles.insertKey, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.label }}>{lang === 'ar' && k.arLabel ? k.arLabel : k.label}</Text>
          </Pressable>
        ))}
        {rows.length < MAX_ROWS ? textCtl('+', t('mathGraphAdd'), addRow) : null}
      </View>

      {/* angle unit + view controls */}
      <View style={[styles.ctlRow, { flexDirection: rowDir }]}>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('mathCalcAngleMode')} style={[styles.segment, { backgroundColor: colors.muted, flexDirection: rowDir }]}>
          {(['deg', 'rad'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => chooseAngle(m)}
              accessibilityRole="radio"
              aria-checked={angle === m}
              style={[styles.segmentItem, angle === m && { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: angle === m ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>
                {t(m === 'deg' ? 'mathCalcDeg' : 'mathCalcRad')}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        {ctl('add', t('mathGraphZoomIn'), () => zoomButton(1.5))}
        {ctl('remove', t('mathGraphZoomOut'), () => zoomButton(1 / 1.5))}
        {ctl('home-outline', t('mathGraphHome'), home)}
        {textCtl('1:1', t('mathGraphEqual'), () => vp && apply(equalize(vp)))}
        {textCtl(lang === 'ar' ? 'جا' : 'sin', t('mathGraphTrigView'), () => trigView(), trig)}
      </View>

      {/* the canvas */}
      <View onLayout={onLayout} style={[styles.canvasWrap, { borderColor: colors.border }]}>
        {vp ? (
          <View
            ref={gestures.viewRef}
            pointerEvents="box-only"
            {...gestures.panHandlers}
            style={[{ width: vp.w, height: vp.h }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as object) : null]}
          >
            <GraphCanvas vp={vp} curves={curves} markers={markers} traceX={traceX} degreeAxis={trig && angle === 'deg'} lang={lang} colors={colors} />
          </View>
        ) : (
          <View style={{ height: 240 }} />
        )}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t('mathGraphTapHint')}</Text>

      {/* a tapped point */}
      {traceX !== null && traceRows.length > 0 ? (
        <View style={styles.block}>
          {heading(`${t('mathGraphTrace')}: x = ${forceLtr(num(traceX, lang))}`)}
          <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
            {traceRows.map(c => {
              const hit = traceAt(c.f, traceX);
              return hit
                ? pointChip(`tr${c.id}`, hit, c.color)
                : chip(`tr${c.id}`, <Text style={[styles.pointTag, { color: colors.mutedForeground }]}>{t('mathGraphUndefined')}</Text>, c.color);
            })}
          </View>
        </View>
      ) : null}

      {/* what was found, per function */}
      {curves.map((c, i) => {
        if (c.kind === 'vertical') {
          return (
            <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: c.color }]}>
              {heading(`${t('mathGraphFunctionN', n(i + 1))} — ${t('mathGraphVertical')}`)}
              <Text style={[styles.pointText, { color: colors.foreground, textAlign: align }]}>{forceLtr(`x = ${num(c.x, lang)}`)}</Text>
            </View>
          );
        }
        if (c.kind !== 'explicit') return null;
        const f = markers.perCurve.get(c.id);
        if (!f) return null;
        return (
          <View key={c.id} style={[styles.card, { backgroundColor: colors.card, borderColor: c.color }]}>
            {heading(`${t('mathGraphFunctionN', n(i + 1))}`)}
            <Text style={[styles.exprText, { color: colors.foreground, textAlign: align }]}>{forceLtr(c.text)}</Text>
            {heading(t('mathGraphRoots'))}
            {f.roots.length === 0 ? none : (
              <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
                {f.roots.slice(0, SHOWN_POINTS).map(x => pointChip(`root${x}`, { x, y: 0 }, c.color))}
                {f.roots.length > SHOWN_POINTS ? <Text style={{ color: colors.mutedForeground }}>…</Text> : null}
              </View>
            )}
            {heading(t('mathGraphExtrema'))}
            {f.extrema.length === 0 ? none : (
              <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
                {f.extrema.slice(0, SHOWN_POINTS).map(e => pointChip(`ex${e.kind}${e.x}`, e, c.color, t(e.kind === 'max' ? 'mathGraphMaxLabel' : 'mathGraphMinLabel')))}
              </View>
            )}
            {f.yIntercept ? (
              <>
                {heading(t('mathGraphYIntercept'))}
                <View style={[styles.chipWrap, { flexDirection: rowDir }]}>{pointChip('yint', f.yIntercept, c.color)}</View>
              </>
            ) : null}
          </View>
        );
      })}
      {markers.pairs.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {heading(t('mathGraphIntersections'))}
          {markers.pairs.map(pair => (
            <View key={`${pair.a}-${pair.b}`} style={styles.pairBlock}>
              <Text style={[styles.pointTag, { color: colors.mutedForeground, textAlign: align }]}>{t('mathGraphIntersectionOf', n(pair.a), n(pair.b))}</Text>
              <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
                {pair.points.slice(0, SHOWN_POINTS).map(p => pointChip(`ip${p.x}`, p, colors.foreground))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* hand off to GeoGebra's own site */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          void openGeogebraWithCommands(link.commands);
        }}
        accessibilityRole="link"
        accessibilityLabel={t('mathGraphOpenGeogebra')}
        style={({ pressed }) => [styles.link, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: rowDir, opacity: pressed ? 0.8 : 1 }]}
      >
        <Ionicons name="open-outline" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, flexShrink: 1 }}>{t('mathGraphOpenGeogebra')}</Text>
      </Pressable>
      {!link.complete ? (
        <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t('mathGraphGeogebraPartial')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACE.lg, gap: SPACE.sm },
  rowBlock: { gap: SPACE.xs },
  inputRow: { alignItems: 'center', gap: SPACE.sm },
  swatch: { width: 14, height: 14, borderRadius: RADIUS.pill },
  input: { flex: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, fontSize: TYPE.body },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: TYPE.caption },
  insertRow: { flexWrap: 'wrap', gap: SPACE.sm },
  insertKey: { minWidth: 40, minHeight: 36, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  ctlRow: { alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  segment: { borderRadius: RADIUS.pill, padding: SPACE.xs },
  segmentItem: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill },
  ctl: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  ctlText: { minWidth: 40, height: 40, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  canvasWrap: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden', width: '100%' },
  hint: { fontSize: TYPE.caption },
  block: { gap: SPACE.xs },
  card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.xs },
  heading: { fontSize: TYPE.caption, marginTop: SPACE.xs },
  exprText: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
  chipWrap: { flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'center' },
  pointChip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, gap: SPACE.sm, alignItems: 'center' },
  pointText: { fontSize: TYPE.label, fontFamily: 'ReadexPro_500Medium' },
  pointTag: { fontSize: TYPE.caption, fontFamily: 'Almarai_400Regular' },
  none: { fontSize: TYPE.caption, fontFamily: 'Almarai_400Regular' },
  pairBlock: { gap: SPACE.xs },
  link: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderWidth: 1, borderRadius: RADIUS.lg, marginTop: SPACE.sm },
});
