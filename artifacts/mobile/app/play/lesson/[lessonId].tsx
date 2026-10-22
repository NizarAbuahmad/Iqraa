/**
 * Games from one lesson's key terms — public like the rest of /play, so a
 * teacher can share the link with a class. Only offered where the lesson has
 * enough terms (`availableLessonGames`); see services/lessonGames.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getLessonById } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { CornerFrame } from '@/components/corners/CornerFrame';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';
import { MemoryGame } from '@/components/publicGames/MemoryGame';
import { TermScrambleGame } from '@/components/publicGames/TermScrambleGame';
import { TriviaBoard } from '@/components/publicGames/TriviaGame';
import type { TranslationKey } from '@/services/i18n';
import { TYPE } from '@/constants/theme';
import {
  availableLessonGames, buildTermSpotRound, lessonTerms, type LessonGame, type TermSpotQuestion,
} from '@/services/lessonGames';

const META: Record<LessonGame, { icon: keyof typeof Ionicons.glyphMap; color: string; titleKey: TranslationKey; descKey: TranslationKey }> = {
  memory: { icon: 'apps-outline', color: '#0369A1', titleKey: 'lessonGameMemoryTitle', descKey: 'lessonGameMemoryDesc' },
  scramble: { icon: 'shuffle-outline', color: '#7C3AED', titleKey: 'lessonGameScrambleTitle', descKey: 'lessonGameScrambleDesc' },
  spot: { icon: 'search-outline', color: '#B45309', titleKey: 'lessonGameSpotTitle', descKey: 'lessonGameSpotDesc' },
};

export default function LessonGamesScreen() {
  const colors = useColors();
  const surface = useSurface();
  const { t, lang } = useLanguage();
  const { lessonId, game: initial } = useLocalSearchParams<{ lessonId: string; game?: string }>();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const games = useMemo(() => (lesson ? availableLessonGames(lesson) : []), [lesson]);
  const [game, setGame] = useState<LessonGame | null>(
    games.includes(initial as LessonGame) ? (initial as LessonGame) : null,
  );
  const terms = useMemo(() => (lesson ? lessonTerms(lesson) : []), [lesson]);
  const spotRound = useCallback(() => (lesson ? buildTermSpotRound(lesson) : []), [lesson]);

  const title = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.title) || lesson.titleAr : '';
  const back = () => setGame(null);
  const analytics = { lessonId: lessonId ?? '' };

  if (lesson && game === 'memory') {
    return <MemoryGame words={terms} titleKey="lessonGameMemoryTitle" onBack={back} analytics={analytics} />;
  }
  if (lesson && game === 'scramble') {
    return <TermScrambleGame terms={terms} onBack={back} analytics={analytics} />;
  }
  if (lesson && game === 'spot') {
    return (
      <TriviaBoard<TermSpotQuestion>
        titleKey="lessonGameSpotTitle"
        accent={META.spot.color}
        buildRound={spotRound}
        onBack={back}
        analytics={analytics}
        renderPrompt={() => (
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: TYPE.title, textAlign: 'center', marginVertical: 16, lineHeight: 30 }}>
            {t('lessonGameSpotPrompt', title)}
          </Text>
        )}
      />
    );
  }

  return (
    <CornerFrame title={t('lessonGamesTitle')} subtitle={title}>
      {games.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 15, textAlign: 'center', padding: 24 }}>
          {t('lessonGamesNone')}
        </Text>
      ) : (
        <View style={styles.grid}>
          {games.map((g, i) => (
            <Entrance key={g} index={i} style={styles.cell}>
              <PressableScale onPress={() => setGame(g)} style={[styles.card, surface]}>
                <View style={[styles.iconWrap, { backgroundColor: `${META[g].color}1a` }]}>
                  <Ionicons name={META[g].icon} size={26} color={META[g].color} />
                </View>
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 16, textAlign: 'center' }}>
                  {t(META[g].titleKey)}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: 'center' }}>
                  {t(META[g].descKey)}
                </Text>
              </PressableScale>
            </Entrance>
          ))}
        </View>
      )}
    </CornerFrame>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, padding: 20 },
  cell: { flexBasis: '46%', flexGrow: 1 },
  card: { flexGrow: 1, padding: 18, gap: 8, alignItems: 'center' },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
