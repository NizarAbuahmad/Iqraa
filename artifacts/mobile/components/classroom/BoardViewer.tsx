import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BoardBackground } from '@/components/classroom/BoardBackground';
import { PenCanvas } from '@/components/classroom/PenLayer';
import { SolutionBlock } from '@/components/classroom/SolutionBlock';
import { TextLayer } from '@/components/classroom/TextLayer';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { docOfFile, parseBoard } from '@/services/boardFile';
import { DECK_BORDER, DECK_CARD_BG } from '@/services/deckTheme';
import { fitCanvas, localizeDigits, CANVAS_W, CANVAS_H } from '@/services/whiteboardModel';

const NOOP = () => {};

/**
 * A saved board, read only: its pages one at a time, with strokes, typed text and
 * the solved problem shown whole (a student opening a shared board sees what the
 * class saw). Drawn from the same pieces as the whiteboard, with every layer
 * inert, so a board looks the same here as on the teacher's screen.
 */
export function BoardViewer({ content }: { content: unknown }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const parsed = useMemo(() => parseBoard(content), [content]);
  const doc = useMemo(() => (parsed.ok ? docOfFile(parsed.file) : null), [parsed]);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  if (!doc) {
    return (
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }}>
        {t('noContentAvailable')}
      </Text>
    );
  }
  const stage = fitCanvas(width, (width * CANVAS_H) / CANVAS_W);
  const current = doc.pages[Math.min(page, doc.pages.length - 1)]!;
  const label = `${localizeDigits(String(page + 1), lang)} / ${localizeDigits(String(doc.pages.length), lang)}`;
  const nav = (to: number, icon: 'chevron-back' | 'chevron-forward', name: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      aria-disabled={off}
      disabled={off}
      onPress={() => setPage(to)}
      style={[styles.nav, { borderColor: colors.border, opacity: off ? 0.4 : 1 }]}
    >
      <Ionicons name={icon} size={ICON.lg} color={colors.foreground} />
    </Pressable>
  );
  const prev = nav(page - 1, isRTL ? 'chevron-forward' : 'chevron-back', t('boardPrevPage'), page <= 0);
  const next = nav(page + 1, isRTL ? 'chevron-back' : 'chevron-forward', t('boardNextPage'), page >= doc.pages.length - 1);
  return (
    <View style={{ gap: SPACE.md }}>
      <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%', height: stage.height }}>
        {stage.scale > 0 && (
          <View style={[styles.stage, { width: stage.width, height: stage.height, borderColor: DECK_BORDER }]}>
            <BoardBackground kind={current.background} lang={lang} scale={stage.scale} />
            {current.solution && (
              <SolutionBlock
                solution={current.solution}
                shown={current.solution.steps.length}
                scale={stage.scale}
                isRTL={isRTL}
                labels={{ ai: t('solveAiLabel'), verified: t('solveVerifiedLabel'), unchecked: t('solveUncheckedLabel'), understoodAs: t('solveUnderstoodAs') }}
              />
            )}
            <PenCanvas
              key={page}
              strokes={current.board.strokes}
              color="#000000"
              strokeScale={stage.scale}
              active={false}
              onChange={NOOP}
            />
            <TextLayer
              texts={current.board.texts}
              scale={stage.scale}
              mode="none"
              onTapEmpty={NOOP}
              onTapText={NOOP}
              onMoveText={NOOP}
              onEraseText={NOOP}
              labels={{ edit: '', erase: '' }}
            />
          </View>
        )}
      </View>
      {doc.pages.length > 1 && (
        <View style={[styles.navRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {prev}
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.body }}>{label}</Text>
          {next}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: DECK_CARD_BG, overflow: 'hidden', borderWidth: 1, borderRadius: RADIUS.md },
  navRow: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg },
  nav: { width: 44, height: 44, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
