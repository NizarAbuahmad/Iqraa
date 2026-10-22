/**
 * The geometry sketchpad: points, segments, polygons and circles on the same
 * plane the grapher draws, with lengths, angles, area and the circle's
 * equation worked out live. Drag a point and everything through it follows.
 *
 * The model, the measurements and what a tap means are `services/mathGeometry`
 * (tested, free of react-native); the view is `mathViewport`. This file draws
 * the scene and turns touches into calls on them. Shapes are made by tapping
 * their points, not by dragging, so a fingertip is never the thing that decides
 * where an edge starts. First-party react-native-svg, no GeoGebra embed.
 *
 * Nothing is saved: the scene lives in memory for the visit (v1).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import type { TranslationKey } from '@/services/i18n';
import { toArabicDigits } from '@/services/labFormat';
import { forceLtr, formatCalcNumber } from '@/services/mathCalc';
import {
  MAX_POINTS,
  circleEquationText,
  closePolygon,
  commit,
  commitFrom,
  hitTestPoint,
  initialHistory,
  measure,
  movePoint,
  redo,
  replacePresent,
  snapStep,
  sketchTap,
  undo,
  emptyScene,
  type GPoint,
  type Measure,
  type Measured,
  type Scene,
  type SketchTool,
} from '@/services/mathGeometry';
import { makeViewport, panBy, resize, toPx, toWorld, zoomAt, type Point, type Viewport } from '@/services/mathViewport';
import { useScrollLock } from '@/components/corners/CornerFrame';
import { PlaneGrid } from './PlaneGrid';
import { useCanvasGestures } from './useCanvasGestures';

type Lang = 'ar' | 'en';
type Colors = ReturnType<typeof useColors>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TOOLS: { id: SketchTool; icon: IconName; label: TranslationKey; hint: TranslationKey }[] = [
  { id: 'move', icon: 'move-outline', label: 'mathSketchMove', hint: 'mathSketchHintMove' },
  { id: 'point', icon: 'locate-outline', label: 'mathSketchPoint', hint: 'mathSketchHintPoint' },
  { id: 'segment', icon: 'remove-outline', label: 'mathSketchSegment', hint: 'mathSketchHintSegment' },
  { id: 'polygon', icon: 'triangle-outline', label: 'mathSketchPolygon', hint: 'mathSketchHintPolygon' },
  { id: 'circle', icon: 'ellipse-outline', label: 'mathSketchCircle', hint: 'mathSketchHintCircle' },
  { id: 'delete', icon: 'trash-outline', label: 'mathSketchDelete', hint: 'mathSketchHintDelete' },
];

const REASON_KEY: Record<Extract<Measured, { ok: false }>['reason'], TranslationKey> = {
  'self-intersecting': 'mathSketchSelfIntersecting',
  degenerate: 'mathSketchDegenerate',
  coincident: 'mathSketchCoincident',
};

/** Rounded for the screen, in the language's digits. */
function fmt(n: number, lang: Lang, dp = 2): string {
  return formatCalcNumber(Number(n.toFixed(dp)), lang).text;
}

/** The equation as the book writes it: س and ص in Arabic, with Arabic-Indic digits. */
function equationFor(m: Extract<Measure, { kind: 'circle' }>, lang: Lang): string {
  const latin = circleEquationText(m.a, m.b, m.r2);
  return lang === 'ar' ? toArabicDigits(latin.replace(/x/g, 'س').replace(/y/g, 'ص')) : latin;
}

// ---------------------------------------------------------------------------
// The canvas

const unit = (a: Point, b: Point): Point => {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d === 0 ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};

function SketchCanvas({
  vp,
  scene,
  pending,
  lang,
  colors,
}: {
  vp: Viewport;
  scene: Scene;
  pending: string[];
  lang: Lang;
  colors: Colors;
}) {
  const px = (p: GPoint): Point => toPx(vp, p.x, p.y);
  const byId = new Map(scene.points.map(p => [p.id, p]));
  const at = (id: string): Point => px(byId.get(id) as GPoint);
  const ink = colors.primary;
  const halo = { stroke: colors.card, strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  const text = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption };

  // One label per edge, even when two shapes share it.
  const edges = new Map<string, { a: Point; b: Point; from: GPoint; to: GPoint; away: Point | null }>();
  const addEdge = (ia: string, ib: string, away: Point | null) => {
    const key = [ia, ib].sort().join('|');
    if (edges.has(key)) return;
    edges.set(key, { a: at(ia), b: at(ib), from: byId.get(ia) as GPoint, to: byId.get(ib) as GPoint, away });
  };
  const measures = measure(scene);
  // A point's name goes on the side away from the shapes through it, so it never sits on an edge.
  const joined = new Map<string, string[]>();
  const join = (a: string, b: string) => {
    joined.set(a, [...(joined.get(a) ?? []), b]);
    joined.set(b, [...(joined.get(b) ?? []), a]);
  };
  for (const s of scene.shapes) {
    if (s.kind === 'segment') join(s.a, s.b);
    if (s.kind === 'circle') join(s.center, s.through);
    if (s.kind === 'polygon') s.ids.forEach((id, i) => join(id, s.ids[(i + 1) % s.ids.length]));
  }
  const nameSpot = (p: GPoint): Point => {
    const q = px(p);
    const away = (joined.get(p.id) ?? []).reduce((acc, id) => {
      const u = unit(q, at(id));
      return { x: acc.x - u.x, y: acc.y - u.y };
    }, { x: 0, y: 0 });
    const d = Math.hypot(away.x, away.y);
    const dir = d < 0.3 ? { x: 0.7, y: -0.7 } : { x: away.x / d, y: away.y / d };
    return { x: q.x + dir.x * 14, y: q.y + dir.y * 14 + 4 };
  };
  for (const s of scene.shapes) {
    if (s.kind === 'segment') addEdge(s.a, s.b, null);
    if (s.kind === 'polygon') {
      const c = s.ids.map(at).reduce((m, p) => ({ x: m.x + p.x / s.ids.length, y: m.y + p.y / s.ids.length }), { x: 0, y: 0 });
      s.ids.forEach((id, i) => addEdge(id, s.ids[(i + 1) % s.ids.length], c));
    }
  }

  return (
    <Svg width={vp.w} height={vp.h}>
      <PlaneGrid vp={vp} lang={lang} colors={colors} />

      {scene.shapes.map(s => {
        if (s.kind === 'circle') {
          const c = at(s.center);
          const t = at(s.through);
          return (
            <React.Fragment key={s.id}>
              <Circle cx={c.x} cy={c.y} r={Math.hypot(t.x - c.x, t.y - c.y)} fill={ink} fillOpacity={0.08} stroke={ink} strokeWidth={2.5} />
              <Line x1={c.x} y1={c.y} x2={t.x} y2={t.y} stroke={ink} strokeWidth={1.5} strokeDasharray="5 4" />
            </React.Fragment>
          );
        }
        if (s.kind === 'segment') {
          const a = at(s.a);
          const b = at(s.b);
          return <Line key={s.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />;
        }
        const d = s.ids.map((id, i) => `${i === 0 ? 'M' : 'L'}${at(id).x} ${at(id).y}`).join(' ') + ' Z';
        return <Path key={s.id} d={d} fill={ink} fillOpacity={0.12} stroke={ink} strokeWidth={2.5} strokeLinejoin="round" />;
      })}

      {/* the polygon being drawn */}
      {pending.length > 1 ? (
        <Path
          d={pending.map((id, i) => `${i === 0 ? 'M' : 'L'}${at(id).x} ${at(id).y}`).join(' ')}
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeDasharray="6 5"
        />
      ) : null}

      {/* right-angle markers and interior-angle labels */}
      {measures.map(m => {
        const s = scene.shapes.find(x => x.id === m.id);
        if (m.kind !== 'polygon' || !s || s.kind !== 'polygon') return null;
        const pts = s.ids.map(at);
        const centre = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
        return m.angles.map((ang, i) => {
          if (!ang.degrees.ok) return null;
          const v = pts[i];
          const prev = pts[(i + pts.length - 1) % pts.length];
          const next = pts[(i + 1) % pts.length];
          const shortest = Math.min(Math.hypot(prev.x - v.x, prev.y - v.y), Math.hypot(next.x - v.x, next.y - v.y));
          if (shortest < 44) return null;
          const u1 = unit(v, prev);
          const u2 = unit(v, next);
          let bis = { x: u1.x + u2.x, y: u1.y + u2.y };
          if (Math.hypot(bis.x, bis.y) < 0.2) bis = unit(v, centre);
          else {
            bis = unit({ x: 0, y: 0 }, bis);
            if (ang.degrees.value > 180) bis = { x: -bis.x, y: -bis.y };
          }
          const label = `${fmt(ang.degrees.value, lang, 1)}°`;
          // A sharp corner needs the label further out to clear both edges, but never past the middle of the shorter one.
          const half = (Math.min(ang.degrees.value, 360 - ang.degrees.value) * Math.PI) / 360;
          const dist = Math.min(Math.max(26, 24 / Math.max(Math.sin(half), 0.05)), shortest * 0.5);
          const lx = v.x + bis.x * dist;
          const ly = v.y + bis.y * dist + 4;
          return (
            <React.Fragment key={`${m.id}${i}`}>
              {ang.right ? (
                <Path
                  d={`M${v.x + u1.x * 11} ${v.y + u1.y * 11} L${v.x + (u1.x + u2.x) * 11} ${v.y + (u1.y + u2.y) * 11} L${v.x + u2.x * 11} ${v.y + u2.y * 11}`}
                  fill="none"
                  stroke={ink}
                  strokeWidth={1.5}
                />
              ) : null}
              <SvgText x={lx} y={ly} textAnchor="middle" {...text} {...halo} fill={colors.card}>
                {label}
              </SvgText>
              <SvgText x={lx} y={ly} textAnchor="middle" {...text} fill={colors.mutedForeground}>
                {label}
              </SvgText>
            </React.Fragment>
          );
        });
      })}

      {/* edge lengths */}
      {[...edges.values()].map(e => {
        const len = Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y);
        if (len < 40) return null;
        const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
        let n = { x: -(e.b.y - e.a.y) / len, y: (e.b.x - e.a.x) / len };
        if (e.away ? n.x * (mid.x - e.away.x) + n.y * (mid.y - e.away.y) < 0 : n.y > 0) n = { x: -n.x, y: -n.y };
        const label = fmt(Math.hypot(e.from.x - e.to.x, e.from.y - e.to.y), lang);
        const lx = mid.x + n.x * 12;
        const ly = mid.y + n.y * 12 + 4;
        return (
          <React.Fragment key={`${e.from.id}${e.to.id}`}>
            <SvgText x={lx} y={ly} textAnchor="middle" {...text} {...halo} fill={colors.card}>
              {label}
            </SvgText>
            <SvgText x={lx} y={ly} textAnchor="middle" {...text} fill={colors.foreground}>
              {label}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* points last, so a fingertip's target is always on top */}
      {scene.points.map(p => {
        const q = px(p);
        const isPending = pending.includes(p.id);
        const spot = nameSpot(p);
        return (
          <React.Fragment key={p.id}>
            {isPending ? <Circle cx={q.x} cy={q.y} r={10} fill="none" stroke={ink} strokeWidth={2} /> : null}
            <Circle cx={q.x} cy={q.y} r={5} fill={colors.foreground} stroke={colors.card} strokeWidth={1.5} />
            <SvgText x={spot.x} y={spot.y} textAnchor="middle" {...text} {...halo} fill={colors.card}>
              {p.label}
            </SvgText>
            <SvgText x={spot.x} y={spot.y} textAnchor="middle" {...text} fontFamily="ReadexPro_600SemiBold" fill={colors.foreground}>
              {p.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// The screen

export function MathSketchpad() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const lock = useScrollLock();
  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';

  const [history, setHistory] = useState(initialHistory);
  const [pending, setPending] = useState<string[]>([]);
  const [tool, setTool] = useState<SketchTool>('segment');
  const [snap, setSnap] = useState(true);
  const [vp, setVp] = useState<Viewport | null>(null);
  const [full, setFull] = useState(false);

  // The gesture handlers are built once and read these on every touch.
  const live = useRef({ history, pending, tool, snap, vp });
  live.current = { history, pending, tool, snap, vp };
  const drag = useRef<{ id: string; before: Scene; dx: number; dy: number } | null>(null);

  const scene = history.present;
  const measures = useMemo(() => measure(scene), [scene]);
  const n = (i: number) => (lang === 'ar' ? toArabicDigits(String(i)) : String(i));

  // -- view ----------------------------------------------------------------
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w <= 0) return;
    const h = Math.max(240, Math.min(Math.round(w * 0.95), 420));
    setVp(v => (v ? resize(v, w, h) : makeViewport(w, h, 'standard')));
  };

  const gestures = useCanvasGestures({
    onPan: (dx, dy) => setVp(v => (v ? panBy(v, dx, dy) : v)),
    onZoom: (f, ax, ay) => setVp(v => (v ? zoomAt(v, f, ax, ay) : v)),
    onTap: (x, y) => {
      const s = live.current;
      if (!s.vp) return;
      const r = sketchTap(s.tool, s.pending, s.history.present, s.vp, x, y, { snap: s.snap });
      setPending(r.pending);
      setFull(r.notice === 'full');
      if (r.scene !== s.history.present) setHistory(commit(s.history, r.scene));
    },
    onEnd: () => {},
    onLock: lock,
    onGrab: (x, y) => {
      const s = live.current;
      if (s.tool !== 'move' || !s.vp) return false;
      const id = hitTestPoint(s.history.present, s.vp, x, y);
      const p = s.history.present.points.find(q => q.id === id);
      if (!id || !p) return false;
      // Keep the finger's offset from the point, so it does not jump to the fingertip.
      const w = toWorld(s.vp, x, y);
      drag.current = { id, before: s.history.present, dx: p.x - w.x, dy: p.y - w.y };
      return true;
    },
    onDrag: (x, y) => {
      const s = live.current;
      const d = drag.current;
      if (!d || !s.vp) return;
      const w = toWorld(s.vp, x, y);
      const step = s.snap ? snapStep(s.vp) : undefined;
      setHistory(h => replacePresent(h, movePoint(h.present, d.id, w.x + d.dx, w.y + d.dy, { snapStep: step })));
    },
    onDrop: () => {
      const d = drag.current;
      drag.current = null;
      if (d) setHistory(h => commitFrom(h, d.before));
    },
  });

  // -- editing -------------------------------------------------------------
  const chooseTool = (next: SketchTool) => {
    Haptics.selectionAsync();
    setTool(next);
    setPending([]);
    setFull(false);
  };
  const doUndo = () => {
    Haptics.selectionAsync();
    setHistory(undo);
    setPending([]);
    setFull(false);
  };
  const doRedo = () => {
    Haptics.selectionAsync();
    setHistory(redo);
    setPending([]);
    setFull(false);
  };
  const doClear = () => {
    Haptics.selectionAsync();
    if (scene.points.length > 0) setHistory(h => commit(h, emptyScene()));
    setPending([]);
    setFull(false);
  };
  const doClose = () => {
    const r = closePolygon(scene, pending);
    setPending(r.pending);
    if (r.scene !== scene) setHistory(h => commit(h, r.scene));
  };
  const zoomButton = (factor: number) => {
    Haptics.selectionAsync();
    if (vp) setVp(zoomAt(vp, factor, vp.w / 2, vp.h / 2));
  };
  const home = () => {
    Haptics.selectionAsync();
    if (vp) setVp(makeViewport(vp.w, vp.h, 'standard'));
  };

  const hintKey: TranslationKey =
    pending.length === 1 && tool === 'segment'
      ? 'mathSketchHintSegmentSecond'
      : pending.length === 1 && tool === 'circle'
        ? 'mathSketchHintCircleSecond'
        : (TOOLS.find(x => x.id === tool) as (typeof TOOLS)[number]).hint;

  // -- pieces --------------------------------------------------------------
  const ctl = (name: IconName, label: string, onPress: () => void, disabled = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      style={({ pressed }) => [styles.ctl, { backgroundColor: colors.secondary, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={name} size={20} color={colors.primary} />
    </Pressable>
  );
  const heading = (text: string) => (
    <Text style={[styles.heading, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>{text}</Text>
  );
  const chip = (key: string, text: string, tint: string = colors.border) => (
    <View key={key} style={[styles.chip, { backgroundColor: colors.muted, borderColor: tint }]}>
      <Text style={[styles.chipText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
  const valueRow = (label: string, value: string) => (
    <View style={[styles.valueRow, { flexDirection: rowDir }]}>
      <Text style={[styles.valueLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{forceLtr(value)}</Text>
    </View>
  );
  const nameText = (name: string) => <Text style={[styles.name, { color: colors.foreground }]}>{forceLtr(name)}</Text>;

  const triangleChips = (m: Extract<Measure, { kind: 'polygon' }>) => {
    if (!m.triangle) return null;
    const bySides: Record<typeof m.triangle.bySides, TranslationKey> = {
      equilateral: 'mathSketchTriEquilateral',
      isosceles: 'mathSketchTriIsosceles',
      scalene: 'mathSketchTriScalene',
    };
    const byAngles: Record<typeof m.triangle.byAngles, TranslationKey> = {
      acute: 'mathSketchTriAcute',
      right: 'mathSketchTriRight',
      obtuse: 'mathSketchTriObtuse',
    };
    return (
      <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
        {chip('tri-a', t(byAngles[m.triangle.byAngles]), colors.primary)}
        {chip('tri-s', t(bySides[m.triangle.bySides]), colors.primary)}
      </View>
    );
  };

  const card = (m: Measure) => {
    if (m.kind === 'segment') {
      return (
        <View key={m.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.cardHead, { flexDirection: rowDir }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t('mathSketchShapeSegment')}</Text>
            {nameText(m.name)}
          </View>
          {valueRow(t('mathSketchLength'), fmt(m.length, lang))}
        </View>
      );
    }
    if (m.kind === 'circle') {
      return (
        <View key={m.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.cardHead, { flexDirection: rowDir }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t('mathSketchShapeCircle')}</Text>
            {nameText(m.name)}
          </View>
          {valueRow(t('mathSketchCentre'), `(${fmt(m.a, lang)}, ${fmt(m.b, lang)})`)}
          {valueRow(t('mathSketchRadius'), fmt(m.radius, lang))}
          {valueRow(t('mathSketchCircumference'), fmt(m.circumference, lang))}
          {valueRow(t('mathSketchArea'), fmt(m.area, lang))}
          {heading(t('mathSketchEquation'))}
          <Text style={[styles.equation, { color: colors.foreground, textAlign: align }]}>{forceLtr(equationFor(m, lang))}</Text>
        </View>
      );
    }
    const kind: TranslationKey =
      m.angles.length === 3 ? 'mathSketchShapeTriangle' : m.angles.length === 4 ? 'mathSketchShapeQuad' : 'mathSketchShapePolygon';
    const failed = [m.area, ...m.angles.map(a => a.degrees)].find((x): x is Extract<Measured, { ok: false }> => !x.ok);
    return (
      <View key={m.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.cardHead, { flexDirection: rowDir }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t(kind)}</Text>
          {nameText(m.name)}
        </View>
        {triangleChips(m)}
        {valueRow(t('mathSketchPerimeter'), fmt(m.perimeter, lang))}
        {m.area.ok ? valueRow(t('mathSketchArea'), fmt(m.area.value, lang)) : null}
        {m.angles.some(a => a.degrees.ok) ? (
          <>
            {heading(t('mathSketchAngles'))}
            <View style={[styles.chipWrap, { flexDirection: rowDir }]}>
              {m.angles.map((a, i) =>
                a.degrees.ok ? chip(`${a.vertex}${i}`, forceLtr(`${a.vertex} ${fmt(a.degrees.value, lang)}°`)) : null,
              )}
            </View>
          </>
        ) : null}
        {failed ? (
          <Text style={[styles.note, { color: colors.destructive, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t(REASON_KEY[failed.reason])}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* tools */}
      <View accessibilityRole="toolbar" accessibilityLabel={t('mathSketchTools')} style={[styles.toolRow, { flexDirection: rowDir }]}>
        {TOOLS.map(x => {
          const active = tool === x.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => chooseTool(x.id)}
              accessibilityRole="button"
              accessibilityLabel={t(x.label)}
              aria-selected={active}
              style={({ pressed }) => [styles.tool, { backgroundColor: active ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name={x.icon} size={20} color={active ? colors.primaryForeground : colors.primary} />
              <Text
                numberOfLines={1}
                style={{ color: active ? colors.primaryForeground : colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro }}
              >
                {t(x.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* actions */}
      <View style={[styles.ctlRow, { flexDirection: rowDir }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSnap(s => !s);
          }}
          accessibilityRole="switch"
          accessibilityLabel={t('mathSketchSnap')}
          aria-checked={snap}
          style={({ pressed }) => [styles.ctl, { backgroundColor: snap ? colors.primary : colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="grid-outline" size={20} color={snap ? colors.primaryForeground : colors.primary} />
        </Pressable>
        {ctl('arrow-undo-outline', t('mathSketchUndo'), doUndo, history.past.length === 0)}
        {ctl('arrow-redo-outline', t('mathSketchRedo'), doRedo, history.future.length === 0)}
        {tool === 'polygon' && pending.length >= 3 ? ctl('checkmark', t('mathSketchClose'), doClose) : null}
        <View style={{ flex: 1 }} />
        {ctl('add', t('mathGraphZoomIn'), () => zoomButton(1.5))}
        {ctl('remove', t('mathGraphZoomOut'), () => zoomButton(1 / 1.5))}
        {ctl('home-outline', t('mathGraphHome'), home)}
        {ctl('trash-bin-outline', t('mathSketchClear'), doClear, scene.points.length === 0)}
      </View>

      {/* the canvas */}
      <View onLayout={onLayout} style={[styles.canvasWrap, { borderColor: colors.border }]}>
        {vp ? (
          <View
            ref={gestures.viewRef}
            pointerEvents="box-only"
            accessibilityLabel={t('mathSketchCanvas')}
            {...gestures.panHandlers}
            style={[{ width: vp.w, height: vp.h }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: tool === 'move' ? 'grab' : 'crosshair', userSelect: 'none' } as object) : null]}
          >
            <SketchCanvas vp={vp} scene={scene} pending={pending} lang={lang} colors={colors} />
          </View>
        ) : (
          <View style={{ height: 240 }} />
        )}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t(hintKey)}</Text>
      {full ? (
        <Text accessibilityRole="alert" style={[styles.note, { color: colors.destructive, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {t('mathSketchFull', n(MAX_POINTS))}
        </Text>
      ) : null}

      {/* the numbers */}
      {heading(t('mathSketchMeasure'))}
      {measures.length === 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t('mathSketchEmpty')}</Text>
      ) : (
        <>
          {measures.map(card)}
          <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>{t('mathSketchUnitsNote')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACE.lg, gap: SPACE.sm },
  toolRow: { flexWrap: 'wrap', gap: SPACE.sm },
  tool: { minWidth: 96, flexGrow: 1, flexBasis: 96, minHeight: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: SPACE.xs },
  ctlRow: { alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  ctl: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  canvasWrap: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden', width: '100%' },
  hint: { fontSize: TYPE.caption },
  note: { fontSize: TYPE.caption },
  heading: { fontSize: TYPE.caption, marginTop: SPACE.xs },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.md, gap: SPACE.xs },
  cardHead: { alignItems: 'center', gap: SPACE.sm },
  cardTitle: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
  name: { fontSize: TYPE.body, fontFamily: 'ReadexPro_600SemiBold' },
  valueRow: { justifyContent: 'space-between', alignItems: 'center', gap: SPACE.md },
  valueLabel: { fontSize: TYPE.label, fontFamily: 'Almarai_400Regular', flexShrink: 1 },
  value: { fontSize: TYPE.label, fontFamily: 'ReadexPro_500Medium', flexShrink: 1, minWidth: 0 },
  equation: { fontSize: TYPE.body, fontFamily: 'ReadexPro_500Medium' },
  chipWrap: { flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  chipText: { fontSize: TYPE.label, fontFamily: 'ReadexPro_500Medium' },
});
