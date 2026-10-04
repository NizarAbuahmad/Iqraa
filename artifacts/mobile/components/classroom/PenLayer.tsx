import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { appendInkPoint, scaleInkPoints } from '@/services/penInk';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED, DECK_TEXT, TIMER_RED } from '@/services/deckTheme';

// Ink over a projected slide — the teacher circles a term, underlines a step,
// sketches a quick arrow. Deliberately not a whiteboard: no shapes, no eraser,
// no saving. Strokes live only as long as the presentation.

/**
 * `points` are fractions of the canvas width, not pixels (`services/penInk.ts`),
 * so a stroke follows the slide when the stage is resized instead of staying
 * where it was drawn.
 */
export type Stroke = { color: string; points: string };

export const PEN_COLORS = [TIMER_RED, DECK_ACCENT, DECK_TEXT];

/**
 * Transparent drawing surface. Sits inside the slide's ScrollView content so
 * ink scrolls with what it marks. When `active` is false it neither draws nor
 * takes touches, so reveal buttons under the ink still work.
 */
export function PenCanvas({ strokes, color, active, onChange }: {
  strokes: Stroke[];
  color: string;
  active: boolean;
  onChange: (next: Stroke[]) => void;
}) {
  // The canvas follows the slide's content box, so its width changes with the
  // stage. Strokes are stored relative to it and drawn at whatever it is now.
  const [width, setWidth] = useState(0);
  // PanResponder is built once; read the latest props through a ref.
  const latest = useRef({ strokes, color, onChange, width });
  latest.current = { strokes, color, onChange, width };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const { strokes: s, color: c, onChange: set, width: w } = latest.current;
      // A single point would draw nothing; start with a zero-length segment
      // so a tap leaves a dot.
      const first = appendInkPoint('', x, y, w);
      if (!first) return; // not laid out yet — nothing to anchor the stroke to
      set([...s, { color: c, points: `${first} ${first}` }]);
    },
    onPanResponderMove: e => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const { strokes: s, onChange: set, width: w } = latest.current;
      const last = s[s.length - 1];
      if (!last) return;
      set([...s.slice(0, -1), { ...last, points: appendInkPoint(last.points, x, y, w) }]);
    },
  }), []);

  return (
    <View
      {...(active ? responder.panHandlers : {})}
      // box-only: the Svg children never become the event target, so
      // locationX/Y are always relative to this view (on web a child target
      // would make them relative to the polyline instead).
      pointerEvents={active ? 'box-only' : 'none'}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, active && Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'crosshair' } as any)]}
    >
      <Svg width="100%" height="100%">
        {strokes.map((s, i) => (
          <Polyline
            key={i}
            points={scaleInkPoints(s.points, width)}
            fill="none"
            stroke={s.color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
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
