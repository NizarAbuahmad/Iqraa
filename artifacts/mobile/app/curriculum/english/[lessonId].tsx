/**
 * One lesson in the English hub: its four activities, and the end-of-round card.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hubLesson } from '@workspace/curriculum/englishHub';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/services/i18n';
import { HUB_ACTIVITIES, progressKey, starsFor, type HubActivity } from '@/services/englishHub/games';
import { useHubProgress } from '@/services/englishHub/progressStore';
import { goBack } from '@/services/navigation';
import { Flashcards, ListenChoose, MatchMeaning, Scramble, SpellIt } from '@/components/englishHub/Activities';

const META: Record<HubActivity, { icon: keyof typeof Ionicons.glyphMap; title: TranslationKey; desc: TranslationKey }> = {
  flashcards: { icon: 'albums-outline', title: 'hubFlashcards', desc: 'hubFlashcardsDesc' },
  listen: { icon: 'ear-outline', title: 'hubListen', desc: 'hubListenDesc' },
  match: { icon: 'git-compare-outline', title: 'hubMatch', desc: 'hubMatchDesc' },
  spell: { icon: 'create-outline', title: 'hubSpell', desc: 'hubSpellDesc' },
  scramble: { icon: 'shuffle-outline', title: 'hubScramble', desc: 'hubScrambleDesc' },
};

export default function EnglishHubLessonScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL, lang } = useLanguage();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const lesson = hubLesson(lessonId ?? '');
  const { progress, record } = useHubProgress();
  const [activity, setActivity] = useState<HubActivity | null>(null);
  // Bumped to remount an activity for "play again" with a fresh shuffle.
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ correct: number; total: number; stars: number } | null>(null);
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
    if (activity) record(lesson.id, activity, stars);
    setResult({ correct, total, stars });
  };

  const back = () => {
    if (activity) {
      setActivity(null);
      setResult(null);
    // Public page: with no history, `goBack()` lands a visitor on login.
    } else if (router.canGoBack()) goBack();
    else router.replace('/curriculum/english' as never);
  };

  const body = () => {
    if (result && activity) {
      return (
        <View style={styles.done}>
          <Text style={{ fontSize: 44 }}>{'⭐'.repeat(result.stars) || '🙂'}</Text>
          <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 22 }}>{t('hubDone')}</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15 }}>
            {activity === 'match' ? t('hubMoves', result.total) : t('hubScore', result.correct, result.total)}
          </Text>
          <Pressable
            onPress={() => { setResult(null); setRound(r => r + 1); }}
            style={[styles.primary, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryText}>{t('hubAgain')}</Text>
          </Pressable>
          <Pressable onPress={back} hitSlop={8}>
            <Text style={{ color: colors.primary, fontFamily: 'Cairo_600SemiBold', fontSize: 15 }}>{t('hubBackToLesson')}</Text>
          </Pressable>
        </View>
      );
    }
    const props = { words: lesson.words, onFinish: finish };
    if (activity === 'flashcards') return <Flashcards key={round} words={lesson.words} />;
    if (activity === 'listen') return <ListenChoose key={round} {...props} />;
    if (activity === 'match') return <MatchMeaning key={round} {...props} />;
    if (activity === 'spell') return <SpellIt key={round} {...props} />;
    if (activity === 'scramble') return <Scramble key={round} {...props} />;

    return (
      <View style={{ gap: 10 }}>
        {HUB_ACTIVITIES.map(a => {
          const best = progress.stars[progressKey(lesson.id, a)] ?? 0;
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
                <Text style={{ color: colors.foreground, fontFamily: 'Cairo_700Bold', fontSize: 16, textAlign: align }}>{t(META[a].title)}</Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>{t(META[a].desc)}</Text>
              </View>
              {best > 0 ? <Text style={{ fontSize: 14 }}>{'⭐'.repeat(best)}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.hero, paddingTop: insets.top + 12 }]}>
        <Pressable onPress={back} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.eyebrow, { textAlign: align }]}>
          {t('hubGrade', lesson.grade)} · {t('hubUnit', lesson.unitNumber)}
        </Text>
        <Text style={[styles.title, { textAlign: align }]} numberOfLines={2}>
          {activity ? t(META[activity].title) : lang === 'ar' ? lesson.unitTitleAr || lesson.unitTitle : lesson.unitTitle}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {body()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: { marginBottom: 12, width: 40, height: 40, justifyContent: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.95)', fontFamily: 'Almarai_400Regular', fontSize: 13, marginBottom: 4 },
  title: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 22 },
  card: { alignItems: 'center', gap: 12, borderWidth: 1, padding: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  done: { alignItems: 'center', gap: 12, paddingTop: 24 },
  primary: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 },
  primaryText: { color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 16 },
});
