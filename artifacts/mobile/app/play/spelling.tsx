import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildSpellingRound } from '@/services/publicGames/spelling';

export default function SpellingGameScreen() {
  return <TextQuizGame titleKey="playSpellingTitle" accent="#78350F" build={buildSpellingRound} />;
}
