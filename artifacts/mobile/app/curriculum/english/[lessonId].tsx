/**
 * One lesson in the English hub: its vocabulary activities, its grammar
 * activities once a teacher has reviewed the unit (`offeredGrammar`), its
 * Grade 1 reading activities likewise (`offeredReading`), and the end-of-round
 * card.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { hubLesson } from '@workspace/curriculum/englishHub';
import { hubLessonVisible, offeredGrammar } from '@workspace/curriculum/englishGrammar';
import { offeredReading, offeredReadingSentences } from '@workspace/curriculum/englishReading';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { GRAMMAR_ACTIVITIES, HUB_ACTIVITIES, READING_ACTIVITIES, dayOf, grammarActivityAvailable, lessonHasPictureMatch, newlyEarnedBadges, progressKey, readSentenceAvailable, readingActivityAvailable, recordResult, starsFor, trueFalseDescKey, yesNoDescKey, type BadgeId, type HubActivity } from '@/services/englishHub/games';
import { useHubProgress } from '@/services/englishHub/progressStore';
import { goBack } from '@/services/navigation';
import { prefetchLessonAudio } from '@/services/englishAudio';
import { trackEvent } from '@/services/analytics';
import { unitNames } from '@/services/contentLanguage';
import { Flashcards, ListenChoose, MatchMeaning, PictureMatch, Scramble, Speaking, SpellIt } from '@/components/englishHub/Activities';
import { BuildSentence, GrammarChoose, TrueFalse, YesNo } from '@/components/englishHub/GrammarActivities';
import { FirstLetter, ReadFind, ReadSentence, StartsWith } from '@/components/englishHub/ReadingActivities';
import { BADGE_META } from '@/components/englishHub/badgeMeta';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { SPACE } from '@/constants/theme';

const META: Record<HubActivity, { icon: keyof typeof Ionicons.glyphMap; title: TranslationKey; desc: TranslationKey }> = {
  flashcards: { icon: 'albums-outline', title: 'hubFlashcards', desc: 'hubFlashcardsDesc' },
  listen: { icon: 'ear-outline', title: 'hubListen', desc: 'hubListenDesc' },
  match: { icon: 'git-compare-outline', title: 'hubMatch', desc: 'hubMatchDesc' },
  spell: { icon: 'create-outline', title: 'hubSpell', desc: 'hubSpellDesc' },
  scramble: { icon: 'shuffle-outline', title: 'hubScramble', desc: 'hubScrambleDesc' },
  picture: { icon: 'image-outline', title: 'hubPicture', desc: 'hubPictureDesc' },
  speaking: { icon: 'mic-outline', title: 'hubSpeaking', desc: 'hubSpeakingDesc' },
  'grammar-choose': { icon: 'checkbox-outline', title: 'hubGChoose', desc: 'hubGChooseDesc' },
  'grammar-build': { icon: 'reorder-four-outline', title: 'hubGBuild', desc: 'hubGBuildDesc' },
  'grammar-true': { icon: 'thumbs-up-outline', title: 'hubGTrue', desc: 'hubGTrueDesc' },
  'grammar-yesno': { icon: 'chatbubbles-outline', title: 'hubGYesNo', desc: 'hubGYesNoDesc' },
  'read-find': { icon: 'book-outline', title: 'hubRFind', desc: 'hubRFindDesc' },
  'first-letter': { icon: 'text-outline', title: 'hubRLetter', desc: 'hubRLetterDesc' },
  'starts-with': { icon: 'search-outline', title: 'hubRStarts', desc: 'hubRStartsDesc' },
  'read-sentence': { icon: 'document-text-outline', title: 'hubRSentence', desc: 'hubRSentenceDesc' },
};

/** Never scored — no star count, no place in `lessonStars`. Kept separate from
 *  `HUB_ACTIVITIES` filtering below rather than folded into it, since the two
 *  reasons an activity might be hidden (never scored vs. this lesson lacks the
 *  content it needs) are different facts about it. */
const UNSCORED: HubActivity[] = ['flashcards', 'speaking'];

export default function EnglishHubLessonScreen() {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  // A grammar-only lesson is not reachable, even by its URL, until a teacher has signed its grammar.
  const lesson = lessonId && hubLessonVisible(lessonId) ? hubLesson(lessonId) : undefined;
  const { progress, record } = useHubProgress();
  const [activity, setActivity] = useState<HubActivity | null>(null);
  // Bumped to remount an activity for "play again" with a fresh shuffle.
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ correct: number; total: number; stars: number } | null>(null);
  const [unlocked, setUnlocked] = useState<BadgeId[]>([]);
  // Null until a teacher has signed the unit off — the only switch. Memoised so a
  // re-render (a progress write) does not hand the activity a new list and reshuffle it.
  const grammar = useMemo(() => offeredGrammar(lessonId ?? ''), [lessonId]);
  const reading = useMemo(() => offeredReading(lessonId ?? ''), [lessonId]);
  const readingSentences = useMemo(() => offeredReadingSentences(lessonId ?? ''), [lessonId]);
  // On a phone, fetch this lesson's clips ahead so its activities play without the network
  // (a no-op on the web). Grammar strings only once the grammar is offered: they are not shown before.
  const lessonShown = Boolean(lesson);
  const grammarShown = grammar !== null;
  useEffect(() => {
    if (lessonId && lessonShown) prefetchLessonAudio(lessonId, { grammar: grammarShown });
  }, [lessonId, lessonShown, grammarShown]);
  const row = isRTL ? 'row-reverse' : 'row';
  const align = isRTL ? 'right' : 'left';

  if (!lesson) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }}>{t('lessonNotFound')}</Text>
      </View>
    );
  }

  const finish = (correct: number, total: number) => {
    const stars = starsFor(correct, total);
    if (activity) {
      // `recordResult` here only PREVIEWS the next state, purely, to diff
      // against — `record()` below is what actually persists it. Calling the
      // pure function twice (progressStore does it again internally) is
      // cheaper than plumbing a return value through the store just for this.
      const after = recordResult(progress, lesson.id, activity, stars, dayOf(new Date()));
      setUnlocked(newlyEarnedBadges(progress, after));
      record(lesson.id, activity, stars);
      trackEvent('game_finished', { game: `english-${activity}`, lessonId: lesson.id, score: correct, total });
    }
    setResult({ correct, total, stars });
  };

  const back = () => {
    if (activity) {
      setActivity(null);
      setResult(null);
      setUnlocked([]);
    // Public page: with no history, `goBack()` lands a visitor on login.
    } else if (router.canGoBack()) goBack();
    else router.replace({ pathname: '/curriculum/english', params: { grade: String(lesson.grade) } } as never);
  };

  const body = () => {
    if (result && activity) {
      return (
        <View style={styles.done}>
          <Text style={{ fontSize: 44 }}>{'⭐'.repeat(result.stars) || '🙂'}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 22 }}>{t('hubDone')}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15 }}>
            {activity === 'match' || activity === 'picture' ? t('hubMoves', result.total) : t('hubScore', result.correct, result.total)}
          </Text>
          {unlocked.length > 0 ? (
            <View style={[styles.unlockRow, { flexDirection: row }]}>
              {unlocked.map(b => (
                <View key={b} style={[styles.unlockBadge, { backgroundColor: colors.primary + '14', borderColor: colors.primary }]}>
                  <Ionicons name={BADGE_META[b].icon} size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{t(BADGE_META[b].label)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => { setResult(null); setUnlocked([]); setRound(r => r + 1); }}
            style={[styles.primary, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{t('hubAgain')}</Text>
          </Pressable>
          <Pressable onPress={back} hitSlop={8}>
            <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>{t('hubBackToLesson')}</Text>
          </Pressable>
        </View>
      );
    }
    const props = { words: lesson.words, onFinish: finish };
    if (activity === 'flashcards') return <Flashcards key={round} words={lesson.words} />;
    if (activity === 'speaking') return <Speaking key={round} words={lesson.words} />;
    if (activity === 'listen') return <ListenChoose key={round} {...props} />;
    if (activity === 'match') return <MatchMeaning key={round} {...props} />;
    if (activity === 'spell') return <SpellIt key={round} {...props} />;
    if (activity === 'scramble') return <Scramble key={round} {...props} />;
    if (activity === 'picture') return <PictureMatch key={round} {...props} />;
    if (grammar && activity === 'grammar-choose') return <GrammarChoose key={round} sentences={grammar} onFinish={finish} />;
    if (grammar && activity === 'grammar-build') return <BuildSentence key={round} sentences={grammar} onFinish={finish} />;
    if (grammar && activity === 'grammar-true') return <TrueFalse key={round} sentences={grammar} onFinish={finish} />;
    if (grammar && activity === 'grammar-yesno') return <YesNo key={round} sentences={grammar} onFinish={finish} />;
    if (reading && activity === 'read-find') return <ReadFind key={round} words={reading} onFinish={finish} />;
    if (reading && activity === 'first-letter') return <FirstLetter key={round} words={reading} onFinish={finish} />;
    if (reading && activity === 'starts-with') return <StartsWith key={round} words={reading} onFinish={finish} />;
    if (readingSentences && activity === 'read-sentence') return <ReadSentence key={round} pool={readingSentences} onFinish={finish} />;

    const card = (a: HubActivity) => {
      const best = UNSCORED.includes(a) ? 0 : progress.stars[progressKey(lesson.id, a)] ?? 0;
      return (
        <Pressable
          key={a}
          onPress={() => { setActivity(a); setRound(r => r + 1); }}
          style={({ pressed }) => [
            styles.card,
            { flexDirection: row, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name={META[a].icon} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 16, textAlign: align }}>{t(META[a].title)}</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{t(grammar && a === 'grammar-true' ? trueFalseDescKey(grammar) : grammar && a === 'grammar-yesno' ? yesNoDescKey(grammar) : META[a].desc)}</Text>
          </View>
          {best > 0 ? <Text style={{ fontSize: 14 }}>{'⭐'.repeat(best)}</Text> : null}
        </Pressable>
      );
    };
    const grammarCards = grammar ? GRAMMAR_ACTIVITIES.filter(a => grammarActivityAvailable(a, grammar)) : [];
    const readingCards: HubActivity[] = [
      ...(reading ? READING_ACTIVITIES.filter(a => readingActivityAvailable(a, reading)) : []),
      ...(readingSentences && readSentenceAvailable(readingSentences) ? (['read-sentence'] as HubActivity[]) : []),
    ];

    return (
      <View style={{ gap: 10 }}>
        {/* A grammar-only lesson has too few words for the word and reading activities: grammar cards only. */}
        {lesson.grammarOnly ? null : HUB_ACTIVITIES.filter(a => a !== 'picture' || lessonHasPictureMatch(lesson.words)).map(card)}
        {!lesson.grammarOnly && readingCards.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.foreground, textAlign: align }]}>{t('hubReading')}</Text>
            {readingCards.map(card)}
          </>
        ) : null}
        {grammarCards.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.foreground, textAlign: align }]}>{t('hubGrammar')}</Text>
            {grammarCards.map(card)}
          </>
        ) : null}
      </View>
    );
  };

  return (
    <CornerFrame
      eyebrow={`${t('hubGrade', lesson.grade)} · ${t('hubUnit', lesson.unitNumber)}`}
      title={activity ? t(META[activity].title) : unitNames({ name: lesson.unitTitle, nameAr: lesson.unitTitleAr }, 'english', lang).title}
      onBack={back}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.body}>{body()}</View>
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.xl },
  card: { alignItems: 'center', gap: 12, borderWidth: 1, padding: 14 },
  section: { fontFamily: 'ReadexPro_700Bold', fontSize: 17, marginTop: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  done: { alignItems: 'center', gap: 12, paddingTop: 24 },
  unlockRow: { flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  unlockBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  primary: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  primaryText: { fontFamily: 'ReadexPro_700Bold', fontSize: 16 },
});
