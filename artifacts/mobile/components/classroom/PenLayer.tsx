import React, { memo, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { appendInkPoint, scaleInkPoints } from '@/services/penInk';
import { DECK_BORDER, DECK_CARD_BG, DECK_MUTED } from '@/services/deckTheme';
import { PEN_COLORS } from '@/services/penColors';
import {
  DEFAULT_STROKE_WIDTH,
  ERASER_RADIUS,
  TEXT_LINE_HEIGHT,
  eraseAlong,
  eraseAt,
  isText,
  moveText,
  parsePoints,
  replaceStrokeAt,
  textAt,
  textDirection,
  type Stroke,
} from '@/services/whiteboardModel';

// Ink over a projected slide — the teacher circles a term, underlines a step,
// sketches a quick arrow. The slide pen stays deliberately simple: three
// colours, undo, clear, nothing saved. The full board (eraser, widths, grid)
// is `app/ai-tools/whiteboard.tsx`, which drives this same canvas.

/**
 * `points` are fractions of the canvas width, not pixels (`services/penInk.ts`),
 * so a stroke follows the slide when the stage is resized instead of staying
 * where it was drawn. `width`, when present, is in width units: slide strokes
 * keep pixel widths (`strokeScale` 1), board strokes are in canvas units of the
 * 1280x720 page and are multiplied by `strokeScale` to get pixels.
 */
export type { Stroke };

// The colour lists live in services/penColors.ts (pure, so a test can load them).
export { PEN_COLORS };

/**
 * Committed strokes, drawn at the canvas's current width. Memoised so a
 * touch-move that only changes the draft never re-renders them.
 */
const StrokeLines = memo(function StrokeLines({ strokes, canvasW, strokeScale }: { strokes: Stroke[]; canvasW: number; strokeScale: number }) {
  return (
    <>
      {strokes.map((s, i) => isText(s) ? null : (
        <Polyline
          key={i}
          points={scaleInkPoints(s.points, canvasW)}
          fill="none"
          stroke={s.color}
          strokeWidth={(s.width ?? DEFAULT_STROKE_WIDTH) * strokeScale}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});

/**
 * Typed text items (board only), drawn as React Native text over the ink's
 * SVG — RN text shapes Arabic and lays out bidi properly on every platform,
 * which SVG text on Android does not reliably do. Each sits in a wide box
 * anchored at its start corner so it never wraps: a saved text looks the same
 * on every screen and in the PDF, which cannot wrap either. The page clips it.
 */
const TextItems = memo(function TextItems({ strokes, canvasW, strokeScale }: { strokes: Stroke[]; canvasW: number; strokeScale: number }) {
  if (!(canvasW > 0)) return null;
  return (
    <>
      {strokes.map((s, i) => {
        if (!isText(s)) return null;
        const [at] = parsePoints(s.points);
        if (!at) return null;
        const rtl = textDirection(s.text) === 'rtl';
        const size = (s.width ?? DEFAULT_STROKE_WIDTH) * strokeScale;
        const x = at.x * canvasW;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.textBox,
              { top: at.y * canvasW, width: canvasW * 2, alignItems: rtl ? 'flex-end' : 'flex-start' },
              rtl ? { right: canvasW - x } : { left: x },
            ]}
          >
            <Text
              selectable={false}
              style={[
                {
                  color: s.color,
                  fontSize: size,
                  lineHeight: size * TEXT_LINE_HEIGHT,
                  fontFamily: 'Almarai_400Regular',
                  writingDirection: rtl ? 'rtl' : 'ltr',
                  textAlign: rtl ? 'right' : 'left',
                },
                Platform.OS === 'web' && ({ whiteSpace: 'pre', userSelect: 'none' } as any),
              ]}
            >
              {s.text}
            </Text>
          </View>
        );
      })}
    </>
  );
});

/** Moving a text starts once the finger has travelled this many pixels; less is a tap. */
const TEXT_DRAG_SLOP = 6;

/**
 * Transparent drawing surface. Sits inside the slide's ScrollView content so
 * ink scrolls with what it marks. When `active` is false it neither draws nor
 * takes touches, so reveal buttons under the ink still work.
 *
 * The stroke being drawn (or the list left after erasing) lives in this
 * component while the finger is down and is handed to `onChange` once, on
 * release — so a long board does not rebuild every polyline on every touch event.
 */
export function PenCanvas({ strokes, color, active, onChange, width = DEFAULT_STROKE_WIDTH, erase = false, strokeScale = 1, textMode = false, onTextTap }: {
  strokes: Stroke[];
  color: string;
  active: boolean;
  onChange: (next: Stroke[]) => void;
  /** Stroke width in width units (pixels when `strokeScale` is 1). Slides leave this alone. */
  width?: number;
  /** Touches remove strokes instead of drawing. */
  erase?: boolean;
  /**
   * Pixels per width unit. The board passes its stage's scale so a stroke keeps
   * its thickness relative to the PAGE on every screen; slides leave it at 1.
   */
  strokeScale?: number;
  /**
   * The board's text tool: a tap reports where it landed (stored units) and
   * which text item it hit (`index`, -1 for none) through `onTextTap`, which
   * opens the editor; dragging a text item moves it (committed through
   * `onChange`, so it is one undo step). Nothing is drawn or erased.
   */
  textMode?: boolean;
  onTextTap?: (at: { x: number; y: number }, index: number) => void;
}) {
  // The canvas follows the slide's content box, so its width changes with the
  // stage. Strokes are stored relative to it and drawn at whatever it is now.
  const [canvasW, setCanvasW] = useState(0);
  // PanResponder is built once; read the latest props through a ref.
  const latest = useRef({ strokes, color, width, erase, onChange, canvasW, strokeScale, textMode, onTextTap });
  latest.current = { strokes, color, width, erase, onChange, canvasW, strokeScale, textMode, onTextTap };

  const [draft, setDraft] = useState<Stroke | null>(null);
  const [erased, setErased] = useState<Stroke[] | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasedRef = useRef<Stroke[] | null>(null);
  /** The committed strokes at the moment the finger went down — the identity reference for "erased nothing". */
  const base = useRef<Stroke[]>([]);
  /** Where the eraser was last applied (in stored units), so a fast drag is swept rather than sampled. */
  const lastErase = useRef<{ x: number; y: number } | null>(null);
  /**
   * A text-tool gesture: the item under the finger (-1 for none), where it went
   * down in stored units and in pixels, and whether it has become a drag. While
   * dragging, the moved list is previewed through `erased` like an erase.
   */
  const textGesture = useRef<{ index: number; x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  const responder = useMemo(() => {
    const finish = (tap: boolean) => {
      const g = textGesture.current;
      if (g) {
        textGesture.current = null;
        const e = erasedRef.current;
        erasedRef.current = null;
        setErased(null);
        const { onChange: set, onTextTap: onTap, strokes: now } = latest.current;
        // Commit only if the list did not change under the gesture (an undo
        // mid-drag); an index into a changed list could name another item.
        if (g.moved) {
          if (e && e !== base.current && now === base.current) set(e);
        } else if (tap) {
          onTap?.({ x: g.x, y: g.y }, now === base.current ? g.index : -1);
        }
        return;
      }
      const d = draftRef.current;
      const e = erasedRef.current;
      draftRef.current = null;
      erasedRef.current = null;
      lastErase.current = null;
      setDraft(null);
      setErased(null);
      // Commit against the LATEST strokes, not the pen-down snapshot: an undo or
      // a clear during the gesture must not be overwritten by the old list.
      const { onChange: set, strokes: now } = latest.current;
      if (d) set([...now, d]);
      else if (e && e !== base.current && now === base.current) set(e); // only if the list did not change under the gesture
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: ev => {
        const { locationX: x, locationY: y } = ev.nativeEvent;
        const cur = latest.current;
        base.current = cur.strokes;
        if (cur.textMode) {
          if (!(cur.canvasW > 0)) return;
          const fx = x / cur.canvasW;
          const fy = y / cur.canvasW;
          textGesture.current = { index: textAt(cur.strokes, fx, fy, cur.strokeScale / cur.canvasW), x: fx, y: fy, px: x, py: y, moved: false };
          return;
        }
        if (cur.erase) {
          // Strokes are stored as fractions of the canvas width, so the touch
          // and the eraser's reach are converted to the same units. `unit` is
          // one WIDTH unit in those units (a stroke's `width` times
          // `strokeScale` pixels), which is what turns a stroke's width into
          // the right reach. The eraser's own reach is a fixed number of
          // screen pixels, whatever the scale.
          if (!(cur.canvasW > 0)) return; // not laid out yet — nothing to erase against
          const px = 1 / cur.canvasW;                  // one pixel, in stored units
          const unit = cur.strokeScale / cur.canvasW;  // one WIDTH unit, in stored units
          const fx = x * px;
          const fy = y * px;
          const next = eraseAt(cur.strokes, fx, fy, ERASER_RADIUS * px, unit);
          lastErase.current = { x: fx, y: fy };
          erasedRef.current = next;
          setErased(next);
        } else {
          // A single point would draw nothing; start with a zero-length
          // segment so a tap leaves a dot.
          const first = appendInkPoint('', x, y, cur.canvasW);
          if (!first) return; // not laid out yet — nothing to anchor the stroke to
          const s: Stroke = { color: cur.color, width: cur.width, points: `${first} ${first}` };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderMove: ev => {
        const { locationX: x, locationY: y } = ev.nativeEvent;
        const cw = latest.current.canvasW;
        const g = textGesture.current;
        if (g) {
          const item = base.current[g.index];
          if (!item || !(cw > 0)) return;
          if (!g.moved && Math.hypot(x - g.px, y - g.py) < TEXT_DRAG_SLOP) return;
          g.moved = true;
          const next = replaceStrokeAt(base.current, g.index, moveText(item, x / cw - g.x, y / cw - g.y));
          erasedRef.current = next;
          setErased(next);
          return;
        }
        if (erasedRef.current) {
          if (!(cw > 0)) return;
          const px = 1 / cw;
          const unit = latest.current.strokeScale / cw;
          const fx = x * px;
          const fy = y * px;
          const from = lastErase.current ?? { x: fx, y: fy };
          const next = eraseAlong(erasedRef.current, from.x, from.y, fx, fy, ERASER_RADIUS * px, unit);
          lastErase.current = { x: fx, y: fy };
          if (next !== erasedRef.current) {
            erasedRef.current = next;
            setErased(next);
          }
        } else if (draftRef.current) {
          const s: Stroke = { ...draftRef.current, points: appendInkPoint(draftRef.current.points, x, y, cw) };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderRelease: () => finish(true),
      onPanResponderTerminate: () => finish(false),
    });
  }, []);

  return (
    <View
      {...(active ? responder.panHandlers : {})}
      // box-only: the Svg children never become the event target, so
      // locationX/Y are always relative to this view (on web a child target
      // would make them relative to the polyline instead).
      pointerEvents={active ? 'box-only' : 'none'}
      onLayout={e => setCanvasW(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, active && Platform.OS === 'web' && ({ touchAction: 'none', cursor: textMode ? 'text' : 'crosshair' } as any)]}
    >
      <Svg width="100%" height="100%">
        <StrokeLines strokes={erased ?? strokes} canvasW={canvasW} strokeScale={strokeScale} />
        {draft && <StrokeLines strokes={[draft]} canvasW={canvasW} strokeScale={strokeScale} />}
      </Svg>
      <TextItems strokes={erased ?? strokes} canvasW={canvasW} strokeScale={strokeScale} />
    </View>
  );
}

/** Colour swatches + undo + clear, floated over the stage while the pen is on. */
export function PenPalette({ color, onColor, onUndo, onClear, canUndo, labels }: {
  color: string;
  onColor: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  labels: { undo: string; clear: string; colors: string[] };
}) {
  return (
    <View style={styles.palette}>
      {PEN_COLORS.map((c, i) => (
        <Pressable
          key={c}
          onPress={() => onColor(c)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={labels.colors[i]}
          aria-selected={c === color}
          style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
        />
      ))}
      <View style={styles.divider} />
      <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.undo} style={{ opacity: canUndo ? 1 : 0.35 }}>
        <Ionicons name="arrow-undo-outline" size={20} color={DECK_MUTED} />
      </Pressable>
      <Pressable onPress={onClear} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: canUndo ? 1 : 0.35 }}>
        <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  textBox: { position: 'absolute' },
  palette: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  swatchOn: { borderWidth: 3, borderColor: DECK_BORDER, transform: [{ scale: 1.2 }] },
  divider: { width: 1, height: 20, backgroundColor: DECK_BORDER },
});
