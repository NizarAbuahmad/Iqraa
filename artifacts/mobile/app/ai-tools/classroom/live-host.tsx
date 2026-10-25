/**
 * Live game, teacher's side — meant for a projector.
 *
 * Students join from any browser device with the code on this screen (a
 * school computer lab, tablets, or at home); the teacher drives. Four states,
 * all read from one polled `HostGame`:
 *
 *   lobby    big code + QR + joined names (tap a name to remove it)
 *   question the question, coloured options, a countdown, who has answered
 *   reveal   how many chose each option, the correct one marked, top 5
 *   ended    podium and the full list
 *
 * The countdown is anchored to the server's clock (`remainingMs`), and a
 * question is closed once — when time runs out or every joined player has
 * answered — by `shouldAutoReveal`, with a ref so a slow response cannot send
 * a second «reveal».
 *
 * Teacher-only: it sits under /ai-tools, not /live, so route gating sends a
 * parent or student away. The server owns who may host.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSurface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/BackButton';
import { LiveText, OptionTile, RankRow } from '@/components/live/LiveBits';
import { useLivePoll, useNow } from '@/hooks/useLivePoll';
import { advanceGame, getHostGame, kickPlayer } from '@/services/liveGameApi';
import {
  barFractions,
  joinPageLabel,
  joinUrl,
  leaderboard,
  liveNum,
  ranksFor,
  remainingMs,
  shouldAutoReveal,
  type HostGame,
  type LiveAction,
} from '@/services/liveGame';
import { labQrSvg } from '@/services/labQr';
import { trackEvent } from '@/services/analytics';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LiveHostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = typeof id === 'string' ? id : '';

  // Everything scales with the window: a laptop gets a readable board, a
  // projector at 1920 wide gets one the back row can read.
  const k = Math.min(1.7, Math.max(0.85, width / 1100));
  const S = (n: number) => Math.round(n * k);
  const wide = width >= 900;

  const fetcher = useCallback(() => getHostGame(gameId), [gameId]);
  // Once the game has ended the podium is final: stop polling and keep it on screen.
  const [ended, setEnded] = useState(false);
  const { data: game, serverOffset, offline, fatal, mutate, refresh } = useLivePoll<HostGame>(gameId && !ended ? fetcher : null, gameId);
  useEffect(() => { if (game?.state === 'ended') setEnded(true); }, [game?.state]);

  const running = game?.state === 'question';
  const now = useNow(running);
  const leftMs = game && running ? remainingMs(game, serverOffset, now) : 0;
  const leftSec = Math.ceil(leftMs / 1000);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const qrSvg = useMemo(() => (game?.code ? labQrSvg(joinUrl(game.code)) : ''), [game?.code]);

  const act = useCallback(async (action: LiveAction) => {
    if (!gameId) return false;
    setBusy(true);
    try {
      mutate(await advanceGame(gameId, action));
      setNotice('');
      return true;
    } catch (e) {
      // bad_transition: the poll already moved on (an auto-reveal landed first).
      if ((e as { status?: number })?.status === 409) refresh();
      else setNotice(t('liveActionFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [gameId, mutate, refresh, t]);

  // Close a question once: time out, or everyone answered.
  const revealedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!game || !shouldAutoReveal(game, leftSec)) return;
    if (revealedFor.current === game.currentIndex) return;
    revealedFor.current = game.currentIndex;
    const index = game.currentIndex;
    void act('reveal').then(ok => {
      // Let the next tick try again if it did not land.
      if (!ok) setTimeout(() => { if (revealedFor.current === index) revealedFor.current = null; }, 1500);
    });
  }, [game, leftSec, act]);

  const finishedTracked = useRef(false);
  useEffect(() => {
    if (game?.state !== 'ended' || finishedTracked.current) return;
    finishedTracked.current = true;
    trackEvent('game_finished', { game: 'live', players: game.players.length, total: game.questionCount });
  }, [game]);

  const start = async () => {
    if (!game) return;
    const ok = await act('start');
    if (ok) trackEvent('game_started', { game: 'live', players: game.players.length, total: game.questionCount });
  };

  const reveal = () => {
    if (!game) return;
    revealedFor.current = game.currentIndex;
    void act('reveal');
  };

  const exit = useCallback(async () => {
    if (game && (game.state === 'question' || game.state === 'reveal')) {
      const ok = await confirm({
        title: t('liveExitTitle'),
        message: t('liveExitMsg'),
        confirmLabel: t('liveExitConfirm'),
        cancelLabel: t('cancel'),
        destructive: true,
      });
      if (!ok) return;
    }
    if (game && game.state !== 'ended') {
      try { await advanceGame(gameId, 'end'); } catch { /* the game may already be over */ }
    }
    goBack();
  }, [game, gameId, t]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { void exit(); return true; });
    return () => sub.remove();
  }, [exit]);

  const kick = async (playerId: string, name: string) => {
    const ok = await confirm({
      title: t('liveKickTitle', name),
      message: t('liveKickMsg'),
      confirmLabel: t('liveKickConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try { await kickPlayer(gameId, playerId); refresh(); } catch { setNotice(t('liveActionFailed')); }
  };

  const rowDir = isRTL ? ('row-reverse' as const) : ('row' as const);
  const pageStyle = [styles.page, { backgroundColor: colors.background, paddingTop: insets.top }];

  if (!gameId || fatal) {
    return (
      <View style={[pageStyle, styles.center]}>
        <Text style={[styles.message, { color: colors.foreground, fontSize: S(TYPE.title) }]}>{t('liveHostGone')}</Text>
        <Button label={t('back')} onPress={goBack} />
      </View>
    );
  }
  if (!game) {
    return (
      <View style={[pageStyle, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const lang = game.lang;
  const total = game.questionCount;
  const players = game.players;
  const ranked = leaderboard(players);
  const q = game.current;
  const lastQuestion = game.currentIndex >= total - 1;

  // ── header ──
  const header = (
    <View style={[styles.header, { flexDirection: rowDir }]}>
      <BackButton color={colors.foreground} onPress={() => void exit()} />
      <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.foreground, fontSize: S(TYPE.bodyLg), textAlign: isRTL ? 'right' : 'left' }]}>
        {game.title}
      </Text>
      {(game.state === 'question' || game.state === 'reveal') && (
        <Text style={[styles.pill, { color: colors.mutedForeground, backgroundColor: colors.muted, fontSize: S(TYPE.label) }]}>
          {t('liveQuestionOf', game.currentIndex + 1, total)}
        </Text>
      )}
      {game.state !== 'lobby' && (
        <Text style={[styles.pill, { color: colors.mutedForeground, backgroundColor: colors.muted, fontSize: S(TYPE.label) }]}>
          {t('liveJoinedN', players.length)}
        </Text>
      )}
    </View>
  );

  // ── footer actions ──
  let footer: React.ReactNode = null;
  if (game.state === 'lobby') {
    footer = (
      <>
        {players.length === 0 && <Text style={[styles.hint, { color: colors.mutedForeground, fontSize: S(TYPE.label) }]}>{t('liveStartNeedPlayer')}</Text>}
        <Button label={t('liveStart')} size="lg" onPress={() => void start()} disabled={players.length < 1 || busy} loading={busy} />
      </>
    );
  } else if (game.state === 'question') {
    footer = <Button label={t('liveRevealAnswer')} size="lg" onPress={reveal} disabled={busy} />;
  } else if (game.state === 'reveal') {
    footer = (
      <Button
        label={lastQuestion ? t('liveFinalResults') : t('liveNext')}
        size="lg"
        onPress={() => void act(lastQuestion ? 'end' : 'next')}
        disabled={busy}
        loading={busy}
      />
    );
  } else {
    footer = <Button label={t('back')} size="lg" onPress={goBack} />;
  }

  // ── body ──
  let body: React.ReactNode = null;

  if (game.state === 'lobby') {
    body = (
      <View style={[styles.lobby, wide && { flexDirection: rowDir }]}>
        <View style={[surface, styles.joinCard, { padding: S(SPACE.xl) }]}>
          <Text style={[styles.centerText, { color: colors.mutedForeground, fontSize: S(TYPE.bodyLg) }]}>{t('liveJoinAt')}</Text>
          <Text style={[styles.centerText, styles.ltr, { color: colors.primary, fontSize: S(TYPE.headline), fontFamily: 'ReadexPro_700Bold' }]}>
            {joinPageLabel()}
          </Text>
          <Text style={[styles.centerText, { color: colors.mutedForeground, fontSize: S(TYPE.bodyLg) }]}>{t('liveEnterCode')}</Text>
          <Text
            accessibilityLabel={`${t('liveCode')}: ${game.code.split('').join(' ')}`}
            style={[styles.centerText, styles.ltr, { color: colors.foreground, fontSize: S(TYPE.hero * 2), letterSpacing: S(8), fontFamily: 'ReadexPro_700Bold' }]}
          >
            {game.code}
          </Text>
          {!!qrSvg && (
            <View style={[styles.qrBox, { padding: S(SPACE.md) }]}>
              <SvgXml xml={qrSvg} width={S(200)} height={S(200)} />
            </View>
          )}
          <Text style={[styles.centerText, { color: colors.mutedForeground, fontSize: S(TYPE.label) }]}>{t('liveOrScan')}</Text>
        </View>

        <View style={[surface, styles.playersCard, { padding: S(SPACE.xl) }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: S(TYPE.title), textAlign: isRTL ? 'right' : 'left' }]}>
            {players.length === 0 ? t('liveNoPlayers') : t('liveJoinedN', players.length)}
          </Text>
          {players.length > 0 && (
            <Text style={[styles.hint, { color: colors.mutedForeground, fontSize: S(TYPE.caption), textAlign: isRTL ? 'right' : 'left' }]}>{t('liveKickHint')}</Text>
          )}
          <View style={[styles.chips, { flexDirection: rowDir }]}>
            {players.map(p => (
              <Pressable
                key={p.id}
                onPress={() => void kick(p.id, p.name)}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}. ${t('liveKickConfirm')}`}
                style={[styles.chip, { backgroundColor: colors.secondary, flexDirection: rowDir }]}
              >
                <Text style={{ color: colors.secondaryForeground, fontSize: S(TYPE.bodyLg), fontFamily: 'ReadexPro_600SemiBold' }}>{p.name}</Text>
                {p.signedIn && (
                  <Ionicons name="checkmark-circle" size={S(16)} color={colors.secondaryForeground} accessibilityLabel={t('liveSignedInMark')} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  } else if (game.state === 'question' && q) {
    const cols = wide ? 2 : 1;
    body = (
      <View style={styles.stack}>
        <View style={[styles.timerRow, { flexDirection: rowDir }]}>
          <View style={[styles.timerPill, { backgroundColor: leftSec <= 5 ? colors.warning : colors.primary }]}>
            <Text style={{ color: leftSec <= 5 ? colors.background : colors.primaryForeground, fontSize: S(TYPE.headline), fontFamily: 'ReadexPro_700Bold' }}>
              {liveNum(leftSec, lang)}
            </Text>
          </View>
          <View style={[styles.timerTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.timerFill,
                { backgroundColor: leftSec <= 5 ? colors.warning : colors.primary, width: `${Math.round((leftMs / Math.max(1, game.seconds * 1000)) * 100)}%` },
                isRTL ? { alignSelf: 'flex-end' } : null,
              ]}
            />
          </View>
          <Text style={[styles.pill, { color: colors.foreground, backgroundColor: colors.secondary, fontSize: S(TYPE.bodyLg) }]}>
            {t('liveAnsweredOf', game.answeredCount, players.length)}
          </Text>
        </View>
        <View style={[surface, { padding: S(SPACE.xl) }]}>
          <LiveText text={q.content} size={S(TYPE.display)} color={colors.foreground} lang={lang} bold centered />
        </View>
        <View style={styles.stack}>
          {chunk(q.options, cols).map((row, r) => (
            <View key={r} style={[styles.optionRow, { flexDirection: rowDir }]}>
              {row.map((text, c) => (
                <View key={c} style={styles.optionCell}>
                  <OptionTile index={r * cols + c} text={text} lang={lang} scale={k} />
                </View>
              ))}
              {row.length < cols && <View style={styles.optionCell} />}
            </View>
          ))}
        </View>
      </View>
    );
  } else if (game.state === 'reveal' && q) {
    const fractions = barFractions(game.answerCounts);
    const top = ranked.slice(0, 5);
    const topRanks = ranksFor(top.map(p => p.score));
    body = (
      <View style={[styles.stack, wide && { flexDirection: rowDir, alignItems: 'flex-start' }]}>
        <View style={[styles.stack, wide && { flex: 3 }]}>
          <View style={[surface, { padding: S(SPACE.lg) }]}>
            <LiveText text={q.content} size={S(TYPE.title)} color={colors.foreground} lang={lang} bold centered />
          </View>
          {q.options.map((text, i) => {
            const correct = i === q.correctIndex;
            return (
              <View key={i} style={styles.stack}>
                <OptionTile
                  index={i}
                  text={text}
                  lang={lang}
                  scale={k * 0.85}
                  dim={!correct}
                  mark={correct ? 'correct' : null}
                  count={game.answerCounts[i] ?? 0}
                />
                <View style={[styles.barTrack, { backgroundColor: colors.muted, flexDirection: rowDir }]}>
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: correct ? colors.success : colors.mutedForeground, width: `${Math.round(fractions[i]! * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
        <View style={[styles.stack, wide && { flex: 2 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: S(TYPE.title), textAlign: isRTL ? 'right' : 'left' }]}>{t('liveTopFive')}</Text>
          {top.map((p, i) => (
            <RankRow key={p.id} rank={topRanks[i]!} name={p.name} score={p.score} lang={lang} scale={k} />
          ))}
        </View>
      </View>
    );
  } else if (game.state === 'ended') {
    const ranks = ranksFor(ranked.map(p => p.score));
    // Podium order on screen: 2nd, 1st, 3rd.
    const order = [1, 0, 2].filter(i => ranked[i]);
    body = (
      <View style={styles.stack}>
        <Text style={[styles.centerText, { color: colors.foreground, fontSize: S(TYPE.hero), fontFamily: 'ReadexPro_700Bold' }]}>{t('liveEndedTitle')}</Text>
        <View style={[styles.podium, { flexDirection: 'row' }]}>
          {order.map(i => {
            const p = ranked[i]!;
            return (
              <View key={p.id} style={styles.podiumCol}>
                <Text style={{ fontSize: S(TYPE.hero * 1.5) }}>{MEDALS[i]}</Text>
                <Text numberOfLines={1} style={[styles.centerText, { color: colors.foreground, fontSize: S(TYPE.title), fontFamily: 'ReadexPro_700Bold' }]}>{p.name}</Text>
                <Text style={[styles.centerText, { color: colors.primary, fontSize: S(TYPE.bodyLg), fontFamily: 'ReadexPro_700Bold' }]}>{t('liveScorePts', p.score)}</Text>
                <View style={[styles.podiumBlock, { height: S(i === 0 ? 150 : i === 1 ? 110 : 80), backgroundColor: colors.primary }]} />
              </View>
            );
          })}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: S(TYPE.title), textAlign: isRTL ? 'right' : 'left' }]}>{t('liveAllPlayers')}</Text>
        {ranked.map((p, i) => (
          <RankRow key={p.id} rank={ranks[i]!} name={p.name} score={p.score} lang={lang} scale={k} />
        ))}
      </View>
    );
  }

  return (
    <View style={pageStyle}>
      {header}
      {offline && (
        <Text style={[styles.banner, { backgroundColor: colors.warning, color: colors.background, fontSize: S(TYPE.label) }]}>{t('liveReconnecting')}</Text>
      )}
      {!!notice && (
        <Text style={[styles.banner, { backgroundColor: colors.destructive, color: colors.destructiveForeground, fontSize: S(TYPE.label) }]}>{notice}</Text>
      )}
      <ScrollView contentContainerStyle={[styles.scroll, { padding: S(SPACE.xl) }]} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
        {footer}
      </View>
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, padding: SPACE.xl },
  message: { fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  header: { alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  headerTitle: { flex: 1, fontFamily: 'ReadexPro_700Bold' },
  pill: {
    fontFamily: 'ReadexPro_600SemiBold',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  banner: { textAlign: 'center', fontFamily: 'ReadexPro_600SemiBold', paddingVertical: SPACE.xs },
  scroll: { flexGrow: 1 },
  stack: { gap: SPACE.md },
  lobby: { gap: SPACE.lg, alignItems: 'stretch' },
  joinCard: { flex: 1, alignItems: 'center', gap: SPACE.sm },
  playersCard: { flex: 1, gap: SPACE.md },
  centerText: { textAlign: 'center', fontFamily: 'ReadexPro_600SemiBold' },
  ltr: { writingDirection: 'ltr' },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.md },
  sectionTitle: { fontFamily: 'ReadexPro_700Bold' },
  hint: { fontFamily: 'ReadexPro_500Medium' },
  chips: { flexWrap: 'wrap', gap: SPACE.sm },
  chip: { alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill },
  timerRow: { alignItems: 'center', gap: SPACE.md },
  timerPill: { minWidth: 72, alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill },
  timerTrack: { flex: 1, height: SPACE.md, borderRadius: RADIUS.pill, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: RADIUS.pill },
  optionRow: { gap: SPACE.md },
  optionCell: { flex: 1 },
  barTrack: { height: SPACE.md, borderRadius: RADIUS.pill, overflow: 'hidden' },
  barFill: { height: '100%' },
  podium: { alignItems: 'flex-end', justifyContent: 'center', gap: SPACE.md },
  podiumCol: { flex: 1, alignItems: 'center', gap: SPACE.xs },
  podiumBlock: { width: '100%', borderTopLeftRadius: RADIUS.md, borderTopRightRadius: RADIUS.md },
  footer: { borderTopWidth: 1, padding: SPACE.md, gap: SPACE.sm, alignItems: 'stretch' },
});
