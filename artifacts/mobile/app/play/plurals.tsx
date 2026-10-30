import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildPluralRound } from '@/services/publicGames/plurals';

export default function PluralsGameScreen() {
  return <TextQuizGame titleKey="playPluralsTitle" accent="#334155" build={buildPluralRound} />;
}
