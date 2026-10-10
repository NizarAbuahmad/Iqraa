import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { DECK_BG, DECK_CARD_BG } from '@/services/deckTheme';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import {
  BOARD_DEFAULT_WIDTH,
  EMPTY_DOC,
  MAX_PAGES,
  addPage,
  canUndo,
  clearBoard,
  commitStrokes,
  currentPage,
  docHasInk,
  fitCanvas,
  goToPage,
  hasInk,
  localizeDigits,
  removePage,
  undoBoard,
  updateCurrent,
  type BoardBackground as BoardBackgroundKind,
  type BoardDoc,
} from '@/services/whiteboardModel';

/**
 * The board (سبورة). Opened from the presentation; Back returns to the same
 * slide because the presentation stays mounted underneath.
 *
 * The page is a 16:9 stage fitted into the screen. `PenCanvas` measures the
 * stage, so ink is stored as fractions of the stage width and looks the same
 * on every screen; stroke widths scale with the stage (`strokeScale`).
 *
 * Nothing is saved yet, so clearing a page, deleting a page that has ink, and
 * leaving with ink on ANY page all ask first. Android's hardware back, the
 * close button and (on web) Escape are intercepted; the browser's own back
 * button and closing the tab are not.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<BoardDoc>(EMPTY_DOC);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  // Listeners registered once read the document through a ref.
  const docRef = useRef(doc);
  docRef.current = doc;

  // One confirm dialog at a time, shared by leave, clear and delete-page: a held
  // Escape key repeats, and each repeat would otherwise stack another dialog.
  const busy = useRef(false);

  const page = currentPage(doc);
  const stage = fitCanvas(area.w, area.h);

  const leave = useCallback(async () => {
    if (busy.current) return;
    if (!docHasInk(docRef.current)) {
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
    if (!hasInk(currentPage(docRef.current).board)) return;
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardClearTitle'),
        message: t('boardClearMessage'),
        confirmLabel: t('boardClearConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setDoc(d => updateCurrent(d, p => ({ ...p, board: clearBoard(p.board) })));
    } finally {
      busy.current = false;
    }
  }, [t]);

  const onDeletePage = useCallback(async () => {
    if (busy.current) return;
    const d = docRef.current;
    if (d.pages.length <= 1) return;
    if (!hasInk(currentPage(d).board)) {
      setDoc(x => removePage(x));
      return;
    }
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('boardDeletePageTitle'),
        message: t('boardDeletePageMessage'),
        confirmLabel: t('boardDeletePageConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setDoc(x => removePage(x));
    } finally {
      busy.current = false;
    }
  }, [t]);

  const pageLabel = `${localizeDigits(String(doc.current + 1), lang)} / ${localizeDigits(String(doc.pages.length), lang)}`;

  return (
    <View style={styles.container} onLayout={e => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.stage, { left: stage.offsetX, top: stage.offsetY, width: stage.width, height: stage.height }]}>
        <BoardBackground kind={page.background} lang={lang} scale={stage.scale} />
        {/* Keyed by the current page index: prev / next / add, and deleting the
            LAST page (which moves `current` back), remount the canvas, so an
            in-flight draft and the measured canvas width reset. Deleting a
            middle page keeps `current` unchanged, so no remount — the canvas
            just receives the next page's strokes. */}
        <PenCanvas
          key={doc.current}
          strokes={page.board.strokes}
          color={color}
          width={width}
          strokeScale={stage.scale > 0 ? stage.scale : 1}
          erase={erase}
          active
          onChange={next => setDoc(d => updateCurrent(d, p => ({ ...p, board: commitStrokes(p.board, next) })))}
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
        canUndo={canUndo(page.board)}
        onUndo={() => setDoc(d => updateCurrent(d, p => ({ ...p, board: undoBoard(p.board) })))}
        hasInk={hasInk(page.board)}
        onClear={onClear}
        background={page.background}
        onBackground={(b: BoardBackgroundKind) => setDoc(d => updateCurrent(d, p => (p.background === b ? p : { ...p, background: b })))}
        onClose={leave}
        pageLabel={pageLabel}
        canPrevPage={doc.current > 0}
        canNextPage={doc.current < doc.pages.length - 1}
        canAddPage={doc.pages.length < MAX_PAGES}
        canDeletePage={doc.pages.length > 1}
        onPrevPage={() => setDoc(d => goToPage(d, d.current - 1))}
        onNextPage={() => setDoc(d => goToPage(d, d.current + 1))}
        onAddPage={() => setDoc(d => addPage(d))}
        onDeletePage={onDeletePage}
        labels={{
          close: t('close'),
          pen: t('penTool'),
          eraser: t('boardEraser'),
          undo: t('penUndo'),
          clear: t('penClear'),
          colors: [t('penRed'), t('penTeal'), t('penBlack')],
          widths: [t('boardWidthThin'), t('boardWidthMedium'), t('boardWidthThick')],
          backgrounds: { blank: t('boardBgBlank'), grid: t('boardBgGrid'), axes: t('boardBgAxes') },
          prevPage: t('boardPrevPage'),
          nextPage: t('boardNextPage'),
          addPage: t('boardAddPage'),
          deletePage: t('boardDeletePage'),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The letterbox around the page is the deck's cream; the page itself is white.
  container: { flex: 1, backgroundColor: DECK_BG },
  stage: { position: 'absolute', backgroundColor: DECK_CARD_BG, overflow: 'hidden' },
});
