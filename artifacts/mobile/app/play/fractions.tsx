import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildFractionRound } from '@/services/publicGames/fractions';

export default function FractionsGameScreen() {
  return <TextQuizGame titleKey="playFractionsTitle" accent="#B91C1C" build={buildFractionRound} />;
}
