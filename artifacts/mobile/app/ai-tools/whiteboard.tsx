import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { DECK_ACCENT, DECK_BG, DECK_CARD_BG } from '@/services/deckTheme';
import { getItem, saveItem, updateItem } from '@/services/workspace';
import { BOARD_FILE_VERSION, boardFileOf, docOfFile, isBoardDirty, parseBoard, serializeBoard } from '@/services/boardFile';
import { PEN_COLORS, PenCanvas } from '@/components/classroom/PenLayer';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { exportAsPDF } from '@/services/share';
import { exportFilename } from '@/services/exportFilename';
import { buildBoardHTML } from '@/services/boardExportHtml';
import { BoardToolbar } from '@/components/classroom/BoardToolbar';
import { BoardSaveDialog } from '@/components/classroom/BoardSaveDialog';
import { SolveDialog } from '@/components/classroom/SolveDialog';
import { SolutionBlock } from '@/components/classroom/SolutionBlock';
import { Toast } from '@/components/ui/Toast';
import type { BoardSolution } from '@workspace/math-verify';
import { remoteAIService as aiService } from '@/services/ai/RemoteAIService';
import { isAbortError } from '@/services/ai/aiProvenance';
import { solveErrorKey } from '@/services/solve';
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
  docHasSolution,
  fitCanvas,
  goToPage,
  hasInk,
  localizeDigits,
  removePage,
  undoBoard,
  updateCurrent,
  withSolution,
  type BoardBackground as BoardBackgroundKind,
  type BoardDoc,
} from '@/services/whiteboardModel';

type Saved = { id: string; title: string; json: string };

/**
 * The board (سبورة). Opened from the presentation (Back returns to the same
 * slide, which stays mounted underneath) or from «موادي» with `savedId`.
 *
 * The page is a 16:9 stage fitted into the screen. `PenCanvas` measures the
 * stage, so ink is stored as fractions of the stage width and looks the same
 * on every screen; stroke widths scale with the stage (`strokeScale`).
 *
 * Save writes a `'board'` material (`services/boardFile.ts`): the first save
 * asks for a name, later ones update the same material. What counts as
 * unsaved work is "the board no longer serialises to what was saved" — so
 * clearing a page, deleting a page that has ink, and leaving with unsaved
 * changes on ANY page all ask first. Android's hardware back, the close
 * button and (on web) Escape are intercepted; the browser's own back button
 * and closing the tab are not.
 *
 * A page can also carry an AI-solved problem («حلّ مسألة»): the teacher types
 * a problem, the model's steps appear as a block over the page and are revealed
 * one at a time. The solution is saved with the board (file v2) and exported
 * with it; the block takes no touches, so ink passes straight through it.
 *
 * A saved board that fails validation is refused with a message and the
 * screen stays blank; Save then creates a NEW material and never overwrites
 * the unreadable one.
 */
export default function WhiteboardScreen() {
  const { t, isRTL, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ savedId?: string; topic?: string; subject?: string; grade?: string }>();
  const [doc, setDoc] = useState<BoardDoc>(EMPTY_DOC);
  const [color, setColor] = useState(PEN_COLORS[0]!);
  const [width, setWidth] = useState(BOARD_DEFAULT_WIDTH);
  const [erase, setErase] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(!!params.savedId);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [askTitle, setAskTitle] = useState(false);
  const [askSolve, setAskSolve] = useState(false);
  const [solveBusy, setSolveBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const solveAbort = useRef<AbortController | null>(null);
  // How many steps of each solution are revealed. Transient on purpose (a
  // reopened board shows its solutions fully revealed), keyed by the solution
  // object itself so adding, deleting or reordering pages cannot hand one
  // page's state to another.
  const revealRef = useRef(new WeakMap<BoardSolution, number>());
  const [, bumpReveal] = useReducer((n: number) => n + 1, 0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [toast, setToast] = useState({ msg: '', visible: false });
  const showToast = useCallback((msg: string) => setToast({ msg, visible: true }), []);
  // The reopen effect reads these through refs so a language change (a new `t`)
  // does not re-fetch the board and overwrite strokes drawn since it loaded.
  const tRef = useRef(t);
  tRef.current = t;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // Listeners registered once read the document through refs.
  const docRef = useRef(doc);
  docRef.current = doc;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const askTitleRef = useRef(askTitle);
  askTitleRef.current = askTitle;
  const askSolveRef = useRef(askSolve);
  askSolveRef.current = askSolve;

  // One confirm dialog at a time, shared by leave, clear and delete-page: a held
  // Escape key repeats, and each repeat would otherwise stack another dialog.
  const busy = useRef(false);
  const saving = useRef(false);
  const exporting = useRef(false);

  const page = currentPage(doc);
  const stage = fitCanvas(area.w, area.h);
  const dirty = useMemo(() => isBoardDirty(doc, saved?.json ?? null), [doc, saved]);

  const leave = useCallback(async () => {
    if (busy.current || askTitleRef.current || askSolveRef.current) return;
    if (!isBoardDirty(docRef.current, savedRef.current?.json ?? null)) {
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
  // presentation's handler and drop the board's ink unasked. While the name
  // dialog is open Escape belongs to the dialog (its Modal closes it).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || askTitleRef.current || askSolveRef.current) return;
      e.preventDefault();
      void leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  useEffect(() => () => solveAbort.current?.abort(), []);

  // Reopen a saved board. Nothing is drawn until it has loaded, so a stroke
  // can never be overwritten by the load finishing.
  useEffect(() => {
    const id = params.savedId;
    if (!id) return;
    let live = true;
    void getItem(id).then(item => {
      if (!live) return;
      const parsed = item && item.type === 'board' ? parseBoard(item.content) : null;
      if (item && parsed && parsed.ok) {
        const next = docOfFile(parsed.file);
        const r = serializeBoard(next);
        setDoc(next);
        setSaved(r.ok ? { id: item.id, title: item.title, json: r.json } : null);
      } else {
        showToastRef.current(tRef.current('boardOpenFailed'));
      }
      setLoading(false);
    }).catch(() => {
      if (!live) return;
      showToastRef.current(tRef.current('boardOpenFailed'));
      setLoading(false);
    });
    return () => { live = false; };
  }, [params.savedId]);

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

  const shownOf = useCallback((s: BoardSolution) => revealRef.current.get(s) ?? s.steps.length, []);

  /** Opens the dialog; a page that already has a solution asks before a model call is spent. */
  const onOpenSolve = useCallback(async () => {
    if (busy.current || loading) return;
    if (currentPage(docRef.current).solution) {
      busy.current = true;
      try {
        const ok = await confirm({
          title: t('solveReplaceTitle'),
          message: t('solveReplaceMessage'),
          confirmLabel: t('solveReplaceConfirm'),
          cancelLabel: t('cancel'),
          destructive: true,
        });
        if (!ok) return;
      } finally {
        busy.current = false;
      }
    }
    setSolveError(null);
    setAskSolve(true);
  }, [loading, t]);

  const onSolve = useCallback(async (problem: string) => {
    if (solveAbort.current) return;
    const controller = new AbortController();
    solveAbort.current = controller;
    setSolveBusy(true);
    setSolveError(null);
    try {
      const solved = await aiService.solveProblem(
        { problem, language: lang === 'ar' ? 'arabic' : 'english' },
        { signal: controller.signal },
      );
      revealRef.current.set(solved, 0);
      setDoc(d => updateCurrent(d, p => withSolution(p, solved)));
      setAskSolve(false);
    } catch (e) {
      // Cancel is not an error to explain.
      if (!isAbortError(e)) setSolveError(t(solveErrorKey(e)));
    } finally {
      solveAbort.current = null;
      setSolveBusy(false);
    }
  }, [lang, t]);

  const onCancelSolve = useCallback(() => {
    solveAbort.current?.abort();
    setAskSolve(false);
    setSolveError(null);
  }, []);

  const onNextStep = useCallback(() => {
    const s = currentPage(docRef.current).solution;
    if (!s) return;
    revealRef.current.set(s, Math.min(s.steps.length, shownOf(s) + 1));
    bumpReveal();
  }, [shownOf]);

  const onHideAll = useCallback(() => {
    const s = currentPage(docRef.current).solution;
    if (!s) return;
    revealRef.current.set(s, 0);
    bumpReveal();
  }, []);

  /** Removing a solution is not undoable, so it asks once steps are showing. */
  const onDeleteSolution = useCallback(async () => {
    if (busy.current) return;
    const s = currentPage(docRef.current).solution;
    if (!s) return;
    if (shownOf(s) === 0) {
      setDoc(d => updateCurrent(d, p => withSolution(p, null)));
      return;
    }
    busy.current = true;
    try {
      const ok = await confirm({
        title: t('solveDeleteTitle'),
        message: t('solveDeleteMessage'),
        confirmLabel: t('solveDeleteConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (ok) setDoc(d => updateCurrent(d, p => withSolution(p, null)));
    } finally {
      busy.current = false;
    }
  }, [shownOf, t]);

  /** «السبورة — <the lesson>», else «السبورة <today, Latin digits>». */
  const defaultTitle = useCallback(() => {
    const base = t('whiteboardTool');
    const topic = (params.topic ?? '').trim();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    // Local parts, not toISOString(): that is the UTC day, so before 03:00 in Jordan it is yesterday.
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return topic ? `${base} — ${topic}` : `${base} ${day}`;
  }, [params.topic, t]);

  const persist = useCallback(async (title: string) => {
    if (saving.current) return;
    const r = serializeBoard(docRef.current);
    if (!r.ok) {
      showToast(t('boardTooBig'));
      return;
    }
    // `serializeBoard` does not validate. Refuse to store a string that
    // `parseBoard` would not read back: a board that saves but cannot be
    // reopened loses the teacher's work.
    if (!parseBoard(r.json).ok) {
      showToast(t('boardTooBig'));
      return;
    }
    saving.current = true;
    setSaveBusy(true);
    try {
      let id = savedRef.current?.id ?? null;
      // `updateItem` answers false when the material is gone (deleted from
      // «موادي» while the board was open): fall through to creating a new one,
      // which is what pressing Save meant. It is given only what changed, so a
      // lesson id stamped at the first save is kept.
      if (id && (await updateItem(id, { title, content: r.json }))) {
        showToast(t('boardUpdated'));
      } else {
        const created = await saveItem({
          type: 'board',
          title,
          subject: params.subject ?? '',
          grade: params.grade ?? '',
          topic: params.topic ?? '',
          language: lang === 'ar' ? 'ar' : 'en',
          content: r.json,
          formState: { boardVersion: docHasSolution(docRef.current) ? BOARD_FILE_VERSION : 1 },
        });
        id = created.id;
        showToast(t('boardSaved'));
      }
      // `r.json` is the snapshot that was written: ink added while the request
      // was in flight leaves the board dirty, as it should.
      setSaved({ id, title, json: r.json });
    } catch {
      // `saveItem`'s device-storage fallback can throw (quota); nothing was kept.
      showToast(t('boardSaveFailed'));
    } finally {
      saving.current = false;
      setSaveBusy(false);
    }
  }, [lang, params.grade, params.subject, params.topic, showToast, t]);

  const onSave = useCallback(() => {
    if (saving.current || loading) return;
    const current = savedRef.current;
    if (current) void persist(current.title);
    else setAskTitle(true);
  }, [loading, persist]);

  // From the in-memory document, so a board can be exported before it is saved.
  // `buildBoardHTML` validates what it is given, so a bug in `boardFileOf`
  // cannot put anything unchecked into the markup.
  const onExport = useCallback(async () => {
    if (exporting.current || loading) return;
    const title = savedRef.current?.title ?? defaultTitle();
    const html = buildBoardHTML(boardFileOf(docRef.current), title, lang === 'ar', {
      ai: t('solveAiLabel'),
      verified: t('solveVerifiedLabel'),
      unchecked: t('solveUncheckedLabel'),
      understoodAs: t('solveUnderstoodAs'),
    });
    if (!html) {
      showToast(t('boardExportFailed'));
      return;
    }
    exporting.current = true;
    setExportBusy(true);
    try {
      await exportAsPDF(html, exportFilename(title, '', 'whiteboard'));
    } catch {
      showToast(t('boardExportFailed'));
    } finally {
      exporting.current = false;
      setExportBusy(false);
    }
  }, [defaultTitle, lang, loading, showToast, t]);

  const pageLabel = `${localizeDigits(String(doc.current + 1), lang)} / ${localizeDigits(String(doc.pages.length), lang)}`;

  return (
    <View style={styles.container} onLayout={e => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[styles.stage, { left: stage.offsetX, top: stage.offsetY, width: stage.width, height: stage.height }]}>
        <BoardBackground kind={page.background} lang={lang} scale={stage.scale} />
        {page.solution && (
          <SolutionBlock
            solution={page.solution}
            shown={shownOf(page.solution)}
            scale={stage.scale}
            isRTL={isRTL}
            labels={{ ai: t('solveAiLabel'), verified: t('solveVerifiedLabel'), unchecked: t('solveUncheckedLabel'), understoodAs: t('solveUnderstoodAs') }}
          />
        )}
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
          active={!loading}
          onChange={next => setDoc(d => updateCurrent(d, p => ({ ...p, board: commitStrokes(p.board, next) })))}
        />
        {loading && (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator color={DECK_ACCENT} />
          </View>
        )}
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
        onSave={onSave}
        canSave={!loading && dirty}
        saveDirty={dirty}
        saveBusy={saveBusy}
        onExport={onExport}
        canExport={!loading && (docHasInk(doc) || docHasSolution(doc))}
        exportBusy={exportBusy}
        onSolve={() => void onOpenSolve()}
        canSolve={!loading && !solveBusy}
        solution={page.solution ? {
          shown: shownOf(page.solution),
          total: page.solution.steps.length,
          onNext: onNextStep,
          onHideAll,
          onDelete: () => void onDeleteSolution(),
        } : null}
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
          save: t('boardSave'),
          exportPdf: t('boardExportPdf'),
          solve: t('boardSolve'),
          solveNext: t('solveNextStep'),
          solveHideAll: t('solveHideAll'),
          solveDelete: t('solveDelete'),
        }}
      />
      <BoardSaveDialog
        visible={askTitle}
        initialTitle={defaultTitle()}
        isRTL={isRTL}
        labels={{ title: t('boardSaveTitle'), nameLabel: t('boardSaveNameLabel'), save: t('boardSaveConfirm'), cancel: t('cancel') }}
        onSubmit={title => { setAskTitle(false); void persist(title); }}
        onCancel={() => setAskTitle(false)}
      />
      <SolveDialog
        visible={askSolve}
        isRTL={isRTL}
        busy={solveBusy}
        error={solveError}
        labels={{
          title: t('solveTitle'), fieldLabel: t('solveFieldLabel'), placeholder: t('solvePlaceholder'),
          submit: t('solveSubmit'), working: t('solveWorking'), cancel: t('cancel'),
        }}
        onSubmit={problem => void onSolve(problem)}
        onCancel={onCancelSolve}
      />
      <Toast visible={toast.visible} message={toast.msg} onHide={() => setToast(s => ({ ...s, visible: false }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The letterbox around the page is the deck's cream; the page itself is white.
  container: { flex: 1, backgroundColor: DECK_BG },
  stage: { position: 'absolute', backgroundColor: DECK_CARD_BG, overflow: 'hidden' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
