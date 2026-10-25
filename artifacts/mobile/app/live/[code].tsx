/**
 * A student playing a live game, on whatever device they have.
 *
 * One route, four states read from one polled `PlayerState`: waiting for the
 * teacher, a question to answer, the result of that question, and the final
 * standing. The player token is kept per code in storage, so a reload — which
 * on the web is a cold boot — resumes the same player instead of asking for a
 * name that is now "taken".
 *
 * Correctness is shown by an icon and words (✓ / ✗), never by colour alone,
 * and every option carries its own shape and letter.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useSurface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { LiveText, OptionTile, RankRow, type OptionMark } from '@/components/live/LiveBits';
import { useLivePoll, useNow } from '@/hooks/useLivePoll';
import {
  LiveApiError,
  clearLiveToken,
  getPlayerState,
  loadLiveToken,
  submitAnswer,
} from '@/services/liveGameApi';
import {
  normalizeCode,
  ranksFor,
  remainingMs,
  remainingSeconds,
  type PlayerState,
} from '@/services/liveGame';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';

export default function LivePlayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const surface = useSurface();
  const { t, isRTL } = useLanguage();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = normalizeCode(params.code);

  // undefined: still reading storage; null: no player token for this code.
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadLiveToken(code).then(tk => { if (alive) setToken(tk); });
    return () => { alive = false; };
  }, [code]);
  useEffect(() => {
    if (token === null) router.replace(`/live?code=${code}` as never);
  }, [token, code]);

  const [ended, setEnded] = useState(false);
  const fetcher = useCallback(() => getPlayerState(code, token as string), [code, token]);
  const { data: game, serverOffset, offline, fatal } = useLivePoll<PlayerState>(
    token && !ended ? fetcher : null,
    `${code}:${token ?? ''}`,
  );
  useEffect(() => { if (game?.state === 'ended') setEnded(true); }, [game?.state]);
  // A refused token is no use next time either; a kick or a closed game leaves nothing to resume.
  useEffect(() => { if (fatal) void clearLiveToken(code); }, [fatal, code]);

  const asking = game?.state === 'question';
  const now = useNow(asking);
  const leftSec = game && asking ? remainingSeconds(game, serverOffset, now) : 0;
  const leftMs = game && asking ? remainingMs(game, serverOffset, now) : 0;

  // What this device has sent for the question on screen. The server's
  // `answered` catches up on the next poll; this makes the tap feel instant.
  const [sent, setSent] = useState<{ index: number; choice: number } | null>(null);
  const [answerNote, setAnswerNote] = useState('');
  const mine = game && sent && sent.index === game.currentIndex ? sent : null;
  useEffect(() => { setAnswerNote(''); }, [game?.currentIndex, game?.state]);

  const choose = async (choice: number) => {
    if (!game || !token || mine || game.answered || leftSec <= 0) return;
    const index = game.currentIndex;
    setSent({ index, choice });
    setAnswerNote('');
    try {
      await submitAnswer(code, token, index, choice);
    } catch (e) {
      const err = e instanceof LiveApiError ? e : null;
      if (err?.code === 'already_answered') return; // the server has one; the next poll shows it
      setSent(null);
      setAnswerNote(t(err?.code === 'too_late' ? 'liveTooLate' : 'liveAnswerFailed'));
    }
  };

  const playAgain = async () => {
    await clearLiveToken(code);
    router.replace('/live' as never);
  };

  const pageStyle = { flex: 1, backgroundColor: colors.background } as const;
  const scroll = [styles.scroll, { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.xxl }];

  // ── the game is gone, or this player is ──
  if (fatal) {
    const err = fatal as { status?: number; code?: string };
    const kicked = err.code === 'kicked';
    const gone = err.status === 404;
    return (
      <View style={[pageStyle, styles.center, { padding: SPACE.xl }]}>
        <Ionicons name={kicked ? 'hand-left-outline' : 'alert-circle-outline'} size={64} color={colors.mutedForeground} />
        <Text style={[styles.message, { color: colors.foreground }]}>
          {t(kicked ? 'liveKicked' : gone ? 'liveGameGone' : 'liveTokenInvalid')}
        </Text>
        <Button
          label={t('liveBackToJoin')}
          size="lg"
          onPress={() => router.replace((kicked || gone ? '/live' : `/live?code=${code}`) as never)}
        />
      </View>
    );
  }

  if (token === undefined || !game) {
    return (
      <View style={[pageStyle, styles.center]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('liveLoading')}</Text>
      </View>
    );
  }

  const lang = game.lang;
  const offlineBanner = offline ? (
    <Text style={[styles.banner, { backgroundColor: colors.warning, color: colors.background }]}>{t('liveReconnecting')}</Text>
  ) : null;
  const q = game.question;

  // ── waiting for the teacher ──
  if (game.state === 'lobby') {
    return (
      <View style={pageStyle}>
        {offlineBanner}
        <View style={[styles.center, { flex: 1, padding: SPACE.xl }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.title, { color: colors.foreground }]}>{t('liveWaiting')}</Text>
          <Text style={[styles.name, { color: colors.primary }]}>{t('liveYouAre', game.me.name)}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('liveWatchScreen')}</Text>
        </View>
      </View>
    );
  }

  // ── a question ──
  if (game.state === 'question' && q) {
    const answered = game.answered || !!mine;
    const fraction = leftMs / Math.max(1, game.seconds * 1000);
    const urgent = leftSec <= 5;
    return (
      <View style={pageStyle}>
        {offlineBanner}
        <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.topRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.pill, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
              {t('liveQuestionOf', game.currentIndex + 1, game.questionCount)}
            </Text>
            <Text style={[styles.pill, { color: urgent ? colors.background : colors.primaryForeground, backgroundColor: urgent ? colors.warning : colors.primary }]}>
              {t('liveSecondsShort', leftSec)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View style={[styles.fill, { backgroundColor: urgent ? colors.warning : colors.primary, width: `${Math.round(fraction * 100)}%` }, isRTL ? { alignSelf: 'flex-end' } : null]} />
          </View>
          <View style={[surface, { padding: SPACE.lg }]}>
            <LiveText text={q.content} size={TYPE.title} color={colors.foreground} lang={lang} bold centered />
          </View>
          {q.options.map((text, i) => (
            <OptionTile
              key={i}
              index={i}
              text={text}
              lang={lang}
              onPress={() => void choose(i)}
              disabled={answered || leftSec <= 0}
              dim={answered && mine?.choice !== i}
              mark={answered && mine?.choice === i ? 'picked' : null}
            />
          ))}
          {answered && (
            <View style={[surface, styles.noteCard]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <View style={styles.noteText}>
                <Text style={[styles.noteTitle, { color: colors.foreground }]}>{t('liveAnswerReceived')}</Text>
                <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left' }]}>{t('liveWaitOthers')}</Text>
              </View>
            </View>
          )}
          {!!answerNote && (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{answerNote}</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── the result of that question ──
  if (game.state === 'reveal') {
    const r = game.reveal;
    const picked = r?.myChoice ?? mine?.choice ?? null;
    const outcome = !r || picked === null ? 'none' : r.myCorrect ? 'right' : 'wrong';
    const tone = outcome === 'right' ? colors.success : outcome === 'wrong' ? colors.destructive : colors.mutedForeground;
    const marks = (i: number): OptionMark =>
      r && i === r.correctIndex ? 'correct' : picked === i ? 'wrong' : null;
    return (
      <View style={pageStyle}>
        {offlineBanner}
        <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
          <View style={[surface, styles.resultCard]}>
            <Ionicons
              name={outcome === 'right' ? 'checkmark-circle' : outcome === 'wrong' ? 'close-circle' : 'remove-circle'}
              size={64}
              color={tone}
            />
            <Text style={[styles.title, { color: tone }]}>
              {t(outcome === 'right' ? 'liveCorrect' : outcome === 'wrong' ? 'liveWrong' : 'liveNoAnswer')}
            </Text>
            {!!r && r.myPoints > 0 && (
              <Text style={[styles.points, { color: colors.primary }]}>{t('livePointsGained', r.myPoints)}</Text>
            )}
            <Text style={[styles.rank, { color: colors.foreground }]}>{t('liveRank', game.me.rank, game.playerCount)}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('liveTotalScore', game.me.score)}</Text>
          </View>
          {q && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{t('liveCorrectMark')}</Text>
              {q.options.map((text, i) => (
                <OptionTile key={i} index={i} text={text} lang={lang} dim={!!r && i !== r.correctIndex && picked !== i} mark={marks(i)} />
              ))}
            </>
          )}
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('liveWatchScreen')}</Text>
        </ScrollView>
      </View>
    );
  }

  // ── the end ──
  const ranks = ranksFor(game.top.map(p => p.score));
  return (
    <View style={pageStyle}>
      {offlineBanner}
      <ScrollView contentContainerStyle={scroll} showsVerticalScrollIndicator={false}>
        <View style={[surface, styles.resultCard]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t('liveEndedTitle')}</Text>
          <Text style={{ fontSize: TYPE.hero * 1.5 }}>{game.me.rank === 1 ? '🥇' : game.me.rank === 2 ? '🥈' : game.me.rank === 3 ? '🥉' : '🏁'}</Text>
          <Text style={[styles.rank, { color: colors.primary }]}>{t('liveRank', game.me.rank, game.playerCount)}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{t('liveTotalScore', game.me.score)}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left' }]}>{t('liveTopFive')}</Text>
        {game.top.map((p, i) => (
          <RankRow key={`${p.name}-${i}`} rank={ranks[i]!} name={p.name} score={p.score} lang={lang} me={p.name === game.me.name} />
        ))}
        <Button label={t('livePlayAgain')} size="lg" onPress={() => void playAgain()} />
        <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: 'center' }]}>{game.title}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: SPACE.md, paddingHorizontal: SPACE.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACE.lg },
  title: { fontSize: TYPE.headline, fontFamily: 'ReadexPro_700Bold', textAlign: 'center' },
  name: { fontSize: TYPE.title, fontFamily: 'ReadexPro_700Bold', textAlign: 'center' },
  sub: { fontSize: TYPE.body, fontFamily: 'ReadexPro_500Medium', textAlign: 'center' },
  message: { fontSize: TYPE.title, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  banner: { textAlign: 'center', fontSize: TYPE.label, fontFamily: 'ReadexPro_600SemiBold', paddingVertical: SPACE.xs },
  topRow: { alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    fontSize: TYPE.label,
    fontFamily: 'ReadexPro_700Bold',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  track: { height: SPACE.sm, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  noteText: { flex: 1, gap: SPACE.xxs },
  noteTitle: { fontSize: TYPE.bodyLg, fontFamily: 'ReadexPro_700Bold' },
  error: { fontSize: TYPE.label, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  resultCard: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.xl },
  points: { fontSize: TYPE.headline, fontFamily: 'ReadexPro_700Bold' },
  rank: { fontSize: TYPE.title, fontFamily: 'ReadexPro_700Bold' },
  sectionTitle: { fontSize: TYPE.bodyLg, fontFamily: 'ReadexPro_700Bold' },
});
