import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildAntonymRound } from '@/services/publicGames/antonyms';

export default function AntonymsGameScreen() {
  return <TextQuizGame titleKey="playAntonymsTitle" accent="#A21CAF" build={buildAntonymRound} />;
}
