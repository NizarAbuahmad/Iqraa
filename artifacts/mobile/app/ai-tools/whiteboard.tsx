import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { DECK_CARD_BG } from '@/services/deckTheme';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import {
  BOARD_DEFAULT_WIDTH,
  EMPTY_BOARD,
  canUndo,
  clearBoard,
  commitStrokes,
  hasInk,
  undoBoard,
  type BoardBackground as BoardBackgroundKind,
  type BoardState,
} from '@/services/whiteboardModel';

/**
 * The blank board (سبورة). Opened from the presentation; Back returns to the
 * same slide because the presentation stays mounted underneath.
 *
 * Nothing is saved yet, so clearing and leaving with ink both ask first. That
 * is the only protection against losing a board by accident: Android's
 * hardware back and the close button are intercepted, but the browser's own
 * back button and closing the tab are not.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [background, setBackground] = useState<BoardBackgroundKind>('blank');
  const [size, setSize] = useState({ w: 0, h: 0 });

  // The hardware-back listener is registered once; it reads the board through a ref.
  const boardRef = useRef(board);
  boardRef.current = board;

  // One confirm dialog at a time, shared by leave and clear: a held Escape key
  // repeats, and each repeat would otherwise stack another dialog.
  const busy = useRef(false);

  const leave = useCallback(async () => {
    if (busy.current) return;
    if (!hasInk(boardRef.current)) {
      goBack();
      return;
    }
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardLeaveTitle'),
        message: t('boardLeaveMessage'),
        confirmLabel: t('boardLeaveConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) goBack();
    } finally {
      busy.current = false;
    }
  }, [t]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  // Esc is a reflex key on web; without this it would fall through to the
  // presentation's handler and drop the board's ink unasked.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  const onClear = useCallback(async () => {
    if (busy.current) return;
    if (!hasInk(boardRef.current)) return;
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardClearTitle'),
        message: t('boardClearMessage'),
        confirmLabel: t('boardClearConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setBoard(b => clearBoard(b));
    } finally {
      busy.current = false;
    }
  }, [t]);

  return (
    <View style={styles.container}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <BoardBackground kind={background} width={size.w} height={size.h} lang={lang} />
        <PenCanvas
          strokes={board.strokes}
          color={color}
          width={width}
          erase={erase}
          active
          onChange={next => setBoard(b => commitStrokes(b, next))}
        />
      </View>
      <BoardToolbar
        isRTL={isRTL}
        topInset={insets.top}
        bottomInset={insets.bottom}
        color={color}
        onColor={setColor}
        width={width}
        onWidth={setWidth}
        erase={erase}
        onErase={setErase}
        canUndo={canUndo(board)}
        onUndo={() => setBoard(b => undoBoard(b))}
        hasInk={hasInk(board)}
        onClear={onClear}
        background={background}
        onBackground={setBackground}
        onClose={leave}
        labels={{
          close: t('close'),
          pen: t('penTool'),
          eraser: t('boardEraser'),
          undo: t('penUndo'),
          clear: t('penClear'),
          colors: [t('penRed'), t('penTeal'), t('penBlack')],
          widths: [t('boardWidthThin'), t('boardWidthMedium'), t('boardWidthThick')],
          backgrounds: { blank: t('boardBgBlank'), grid: t('boardBgGrid'), axes: t('boardBgAxes') },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DECK_CARD_BG },
});
