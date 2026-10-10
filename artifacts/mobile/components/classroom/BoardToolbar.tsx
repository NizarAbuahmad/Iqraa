import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DECK_ACCENT, DECK_BORDER, DECK_CARD_BG, DECK_MUTED } from '@/services/deckTheme';
import { PEN_COLORS } from '@/components/classroom/PenLayer';
import { BOARD_BACKGROUNDS, STROKE_WIDTHS, type BoardBackground } from '@/services/whiteboardModel';

export type BoardToolbarLabels = {
  close: string;
  pen: string;
  eraser: string;
  undo: string;
  clear: string;
  /** One per `PEN_COLORS` entry. */
  colors: string[];
  /** One per `STROKE_WIDTHS` entry. */
  widths: string[];
  backgrounds: Record<BoardBackground, string>;
  prevPage: string;
  nextPage: string;
  addPage: string;
  deletePage: string;
  save: string;
  exportPdf: string;
  solve: string;
  solveNext: string;
  solveHideAll: string;
  solveDelete: string;
};

/**
 * Floating controls for the board: a top bar (close + paper) and a bottom pill
 * (colour, width, pen/eraser, undo, clear, pages, solve, save/export). The solve
 * button (calculator) opens the problem dialog; when the page has a solution a
 * further group appears with next-step, hide-all and delete controls. The top container is `box-none` so
 * the empty gap between its two groups still lets the pen draw underneath.
 */
export function BoardToolbar({
  isRTL, topInset, bottomInset,
  color, onColor, width, onWidth, erase, onErase,
  canUndo, onUndo, hasInk, onClear,
  background, onBackground, onClose, labels,
  pageLabel, canPrevPage, canNextPage, canAddPage, canDeletePage,
  onPrevPage, onNextPage, onAddPage, onDeletePage,
  onSave, canSave, saveDirty, saveBusy,
  onExport, canExport, exportBusy,
  onSolve, canSolve, solution,
}: {
  isRTL: boolean;
  topInset: number;
  bottomInset: number;
  color: string;
  onColor: (c: string) => void;
  width: number;
  onWidth: (w: number) => void;
  erase: boolean;
  onErase: (on: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  hasInk: boolean;
  onClear: () => void;
  background: BoardBackground;
  onBackground: (b: BoardBackground) => void;
  onClose: () => void;
  labels: BoardToolbarLabels;
  /** "2 / 5", digits already localised. */
  pageLabel: string;
  canPrevPage: boolean;
  canNextPage: boolean;
  canAddPage: boolean;
  canDeletePage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onDeletePage: () => void;
  onSave: () => void;
  /** Enabled only when there is something to save. */
  canSave: boolean;
  /** Draws the icon filled and accented. */
  saveDirty: boolean;
  saveBusy: boolean;
  onExport: () => void;
  /** Enabled only when some page has ink. */
  canExport: boolean;
  exportBusy: boolean;
  onSolve: () => void;
  canSolve: boolean;
  /** Present only when the current page has a solution. */
  /** `counter` is "2/5", digits already localised. */
  solution: null | { shown: number; total: number; counter: string; onNext: () => void; onHideAll: () => void; onDelete: () => void };
}) {
  const rowDir = isRTL ? 'row-reverse' : 'row';
  return (
    <>
      <View pointerEvents="box-none" style={[styles.top, { top: topInset + 8, flexDirection: rowDir }]}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={labels.close}>
          <Ionicons name="close" size={22} color={DECK_MUTED} />
        </Pressable>
        <View style={[styles.chips, { flexDirection: rowDir }]}>
          {BOARD_BACKGROUNDS.map(b => (
            <Pressable
              key={b}
              onPress={() => onBackground(b)}
              accessibilityRole="button"
              aria-selected={b === background}
              style={[styles.chip, b === background && styles.chipOn]}
            >
              <Text style={[styles.chipText, b === background && { color: DECK_ACCENT }, { fontFamily: 'Almarai_400Regular' }]}>
                {labels.backgrounds[b]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Wrapping happens BETWEEN these groups, never inside one. There are no
          dividers on purpose: a divider between wrapping groups can end up
          dangling at the end of a row. */}
      <View style={[styles.palette, { bottom: bottomInset + 12 }]}>
        <View style={styles.group}>
          {PEN_COLORS.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => { onColor(c); onErase(false); }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.colors[i]}
              aria-selected={!erase && c === color}
              style={[styles.swatch, { backgroundColor: c }, !erase && c === color && styles.swatchOn]}
            />
          ))}
        </View>
        <View style={styles.group}>
          {STROKE_WIDTHS.map((w, i) => (
            <Pressable
              key={w}
              onPress={() => onWidth(w)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.widths[i]}
              aria-selected={w === width}
              style={styles.widthSlot}
            >
              <View style={{ width: w + 6, height: w + 6, borderRadius: (w + 6) / 2, backgroundColor: w === width ? DECK_ACCENT : DECK_MUTED }} />
            </Pressable>
          ))}
        </View>
        <View style={styles.group}>
          <Pressable onPress={() => onErase(false)} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.pen} aria-selected={!erase}>
            <Ionicons name={erase ? 'brush-outline' : 'brush'} size={20} color={erase ? DECK_MUTED : DECK_ACCENT} />
          </Pressable>
          <Pressable onPress={() => onErase(true)} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.eraser} aria-selected={erase}>
            <MaterialCommunityIcons name="eraser" size={22} color={erase ? DECK_ACCENT : DECK_MUTED} />
          </Pressable>
        </View>
        <View style={styles.group}>
          <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.undo} style={{ opacity: canUndo ? 1 : 0.35 }}>
            <Ionicons name="arrow-undo-outline" size={20} color={DECK_MUTED} />
          </Pressable>
          <Pressable onPress={onClear} disabled={!hasInk} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.clear} style={{ opacity: hasInk ? 1 : 0.35 }}>
            <Ionicons name="trash-outline" size={20} color={DECK_MUTED} />
          </Pressable>
        </View>
        <View style={[styles.group, { flexDirection: rowDir }]}>
          <Pressable onPress={onPrevPage} disabled={!canPrevPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.prevPage} style={{ opacity: canPrevPage ? 1 : 0.35 }}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={DECK_MUTED} />
          </Pressable>
          <Text style={[styles.pageLabel, { fontFamily: 'Almarai_400Regular' }]}>{pageLabel}</Text>
          <Pressable onPress={onNextPage} disabled={!canNextPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.nextPage} style={{ opacity: canNextPage ? 1 : 0.35 }}>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={DECK_MUTED} />
          </Pressable>
          <Pressable onPress={onAddPage} disabled={!canAddPage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.addPage} style={{ opacity: canAddPage ? 1 : 0.35 }}>
            <Ionicons name="add-circle-outline" size={22} color={DECK_MUTED} />
          </Pressable>
          <Pressable onPress={onDeletePage} disabled={!canDeletePage} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.deletePage} style={{ opacity: canDeletePage ? 1 : 0.35 }}>
            <Ionicons name="remove-circle-outline" size={22} color={DECK_MUTED} />
          </Pressable>
        </View>
        {solution ? (
          <View style={[styles.group, { flexDirection: rowDir }]}>
            <Pressable
              onPress={solution.onNext}
              disabled={solution.shown >= solution.total}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.solveNext}
              style={{ opacity: solution.shown >= solution.total ? 0.35 : 1 }}
            >
              <Ionicons name="chevron-down-circle-outline" size={22} color={DECK_ACCENT} />
            </Pressable>
            <Text style={[styles.pageLabel, { fontFamily: 'Almarai_400Regular', minWidth: 28 }]}>
              {solution.counter}
            </Text>
            <Pressable
              onPress={solution.onHideAll}
              disabled={solution.shown === 0}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={labels.solveHideAll}
              style={{ opacity: solution.shown === 0 ? 0.35 : 1 }}
            >
              <Ionicons name="eye-off-outline" size={20} color={DECK_MUTED} />
            </Pressable>
            <Pressable onPress={solution.onDelete} hitSlop={6} accessibilityRole="button" accessibilityLabel={labels.solveDelete}>
              <Ionicons name="trash-bin-outline" size={20} color={DECK_MUTED} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.group}>
          <Pressable
            onPress={onSolve}
            disabled={!canSolve}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.solve}
            style={{ opacity: canSolve ? 1 : 0.35 }}
          >
            <Ionicons name="calculator-outline" size={20} color={DECK_MUTED} />
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={!canSave || saveBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.save}
            style={{ opacity: canSave && !saveBusy ? 1 : 0.35 }}
          >
            <Ionicons name={saveDirty ? 'save' : 'save-outline'} size={20} color={saveDirty ? DECK_ACCENT : DECK_MUTED} />
          </Pressable>
          <Pressable
            onPress={onExport}
            disabled={!canExport || exportBusy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={labels.exportPdf}
            style={{ opacity: canExport && !exportBusy ? 1 : 0.35 }}
          >
            <Ionicons name="document-outline" size={20} color={DECK_MUTED} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 12, right: 12, justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  chips: {
    gap: 6, padding: 4, borderRadius: 20,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  chipOn: { borderColor: DECK_ACCENT + '50', backgroundColor: DECK_ACCENT + '12' },
  chipText: { fontSize: 13, color: DECK_MUTED },
  palette: {
    position: 'absolute', alignSelf: 'center', maxWidth: '96%',
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 22, rowGap: 10,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: DECK_CARD_BG, borderWidth: 1, borderColor: DECK_BORDER,
  },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  swatchOn: { borderWidth: 3, borderColor: DECK_BORDER, transform: [{ scale: 1.2 }] },
  widthSlot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  group: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pageLabel: { fontSize: 13, color: DECK_MUTED, minWidth: 40, textAlign: 'center' },
});
