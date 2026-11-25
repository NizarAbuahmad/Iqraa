import React, { useMemo, useRef } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DECK_ACCENT, DECK_BORDER, TIMER_RED } from '@/services/deckTheme';
import { CANVAS_W, TEXT_LINE_HEIGHT, textLines, type TextItem } from '@/services/whiteboardModel';

/** What a touch on the page does to the texts: nothing (the pen is down), place and edit them, or erase them. */
export type TextLayerMode = 'none' | 'text' | 'erase';

/** A touch that moves less than this many pixels between going down and coming up is a tap. */
const TAP_SLOP = 8;

/**
 * The page's typed texts, drawn over the ink, and the touches that place, edit and erase them.
 *
 * Every line is its own single-line `Text` that clips at the page edge instead of wrapping, so
 * it breaks where the teacher typed and where the PDF breaks (`textsSVG` in boardExportHtml.ts).
 * An English item hangs from its left edge, an Arabic one from its right (`TextItem.rtl`), and
 * each box shrinks to its longest line, so a tap on empty page beside a text places a new one
 * and does not open the old.
 *
 * `x`, `y` and sizes are canvas units of the 1280x720 page; `scale` is screen pixels per unit.
 * In `none` the whole layer lets touches through to the pen below. In `text` an empty-page tap
 * reports where (in canvas units) and a tap on a text reports which; in `erase` a tap on a text
 * removes it (the pen layer under it erases ink as usual).
 */
export function TextLayer({ texts, scale, mode, onTapEmpty, onTapText, onEraseText, labels }: {
  texts: readonly TextItem[];
  scale: number;
  mode: TextLayerMode;
  onTapEmpty: (x: number, y: number) => void;
  onTapText: (index: number) => void;
  onEraseText: (index: number) => void;
  /** `text`: the accessibility label of an item (its first line is appended). */
  labels: { edit: string; erase: string };
}) {
  const latest = useRef({ scale, onTapEmpty });
  latest.current = { scale, onTapEmpty };

  const tap = useMemo(() => {
    let down: { x: number; y: number } | null = null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: ev => {
        down = { x: ev.nativeEvent.locationX, y: ev.nativeEvent.locationY };
      },
      onPanResponderRelease: (ev, g) => {
        const from = down;
        down = null;
        const { scale: s, onTapEmpty: report } = latest.current;
        if (!from || !(s > 0) || Math.hypot(g.dx, g.dy) > TAP_SLOP) return;
        report(from.x / s, from.y / s);
      },
      onPanResponderTerminate: () => {
        down = null;
      },
    });
  }, []);

  if (!(scale > 0)) return null;
  const active = mode !== 'none';
  return (
    <View pointerEvents={active ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
      {mode === 'text' ? (
        <View
          {...tap.panHandlers}
          pointerEvents="box-only"
          style={[StyleSheet.absoluteFill, Platform.OS === 'web' && ({ touchAction: 'none', cursor: 'text' } as any)]}
        />
      ) : null}
      {texts.map((t, i) => {
        const font = t.size * scale;
        const box = t.rtl
          ? { right: (CANVAS_W - t.x) * scale, maxWidth: Math.max(0, t.x * scale) }
          : { left: t.x * scale, maxWidth: Math.max(0, (CANVAS_W - t.x) * scale) };
        const first = textLines(t.text)[0] ?? '';
        return (
          <Pressable
            key={i}
            disabled={!active}
            onPress={() => (mode === 'erase' ? onEraseText(i) : onTapText(i))}
            accessibilityRole="button"
            accessibilityLabel={`${mode === 'erase' ? labels.erase : labels.edit}: ${first}`}
            style={[styles.box, { top: t.y * scale }, box]}
          >
            {active ? (
              <View
                pointerEvents="none"
                style={[styles.outline, { borderColor: mode === 'erase' ? TIMER_RED + '66' : DECK_ACCENT + '66' }]}
              />
            ) : null}
            {textLines(t.text).map((line, li) => (
              <Text
                key={li}
                numberOfLines={1}
                ellipsizeMode="clip"
                style={{
                  fontSize: font,
                  lineHeight: font * TEXT_LINE_HEIGHT,
                  color: t.color,
                  textAlign: t.rtl ? 'right' : 'left',
                  writingDirection: t.rtl ? 'rtl' : 'ltr',
                  fontFamily: 'Almarai_400Regular',
                }}
              >
                {line === '' ? ' ' : line}
              </Text>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  outline: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 4, borderColor: DECK_BORDER,
  },
});
