import React, { memo, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT, TIMER_RED } from '@/services/deckTheme';
import { DEFAULT_STROKE_WIDTH, ERASER_RADIUS, eraseAlong, eraseAt, type Stroke } from '@/services/whiteboardModel';

// Ink over a projected slide — the teacher circles a term, underlines a step,
// sketches a quick arrow. The slide pen stays deliberately simple: three
// colours, undo, clear, nothing saved. The full board (eraser, widths, grid)
// is `app/ai-tools/whiteboard.tsx`, which drives this same canvas.

export type { Stroke };

export const PEN_COLORS = [TIMER_RED, DECK_ACCENT, DECK_TEXT];

/** Committed strokes. Memoised so a touch-move that only changes the draft never re-renders them. */
const StrokeLines = memo(function StrokeLines({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      {strokes.map((s, i) => (
        <Polyline
          key={i}
          points={s.points}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? DEFAULT_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
});

/**
 * Transparent drawing surface. Sits inside the slide's ScrollView content so
 * ink scrolls with what it marks. When `active` is false it neither draws nor
 * takes touches, so reveal buttons under the ink still work.
 *
 * The stroke being drawn (or the list left after erasing) lives in this
 * component while the finger is down and is handed to `onChange` once, on
 * release — so a long board does not rebuild every polyline on every touch event.
 */
export function PenCanvas({ strokes, color, active, onChange, width = DEFAULT_STROKE_WIDTH, erase = false }: {
  strokes: Stroke[];
  color: string;
  active: boolean;
  onChange: (next: Stroke[]) => void;
  /** Stroke width in pixels. Slides leave this alone. */
  width?: number;
  /** Touches remove strokes instead of drawing. */
  erase?: boolean;
}) {
  // PanResponder is built once; read the latest props through a ref.
  const latest = useRef({ strokes, color, width, erase, onChange });
  latest.current = { strokes, color, width, erase, onChange };

  const [draft, setDraft] = useState<Stroke | null>(null);
  const [erased, setErased] = useState<Stroke[] | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const erasedRef = useRef<Stroke[] | null>(null);
  /** The committed strokes at the moment the finger went down — the identity reference for "erased nothing". */
  const base = useRef<Stroke[]>([]);
  /** Where the eraser was last applied, so a fast drag is swept rather than sampled. */
  const lastErase = useRef<{ x: number; y: number } | null>(null);

  const responder = useMemo(() => {
    const finish = () => {
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
        if (cur.erase) {
          const next = eraseAt(cur.strokes, x, y, ERASER_RADIUS);
          lastErase.current = { x, y };
          erasedRef.current = next;
          setErased(next);
        } else {
          // A single point would draw nothing; start with a zero-length
          // segment so a tap leaves a dot.
          const s: Stroke = { color: cur.color, width: cur.width, points: `${x},${y} ${x},${y}` };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderMove: ev => {
        const { locationX: x, locationY: y } = ev.nativeEvent;
        if (erasedRef.current) {
          const from = lastErase.current ?? { x, y };
          const next = eraseAlong(erasedRef.current, from.x, from.y, x, y, ERASER_RADIUS);
          lastErase.current = { x, y };
          if (next !== erasedRef.current) {
            erasedRef.current = next;
            setErased(next);
          }
        } else if (draftRef.current) {
          const s: Stroke = { ...draftRef.current, points: `${draftRef.current.points} ${x},${y}` };
          draftRef.current = s;
          setDraft(s);
        }
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

  return (
    <View
      {...(active ? responder.panHandlers : {})}
      // box-only: the Svg children never become the event target, so
      // locationX/Y are always relative to this view (on web a child target
      // would make them relative to the polyline instead).
      pointerEvents={active ? 'box-only' : 'none'}
      style={[StyleSheet.absoluteFill, active && Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'crosshair' } as any)]}
    >
      <Svg width="100%" height="100%">
        <StrokeLines strokes={erased ?? strokes} />
        {draft && <StrokeLines strokes={[draft]} />}
      </Svg>
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
          accessibilityState={{ selected: c === color }}
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
