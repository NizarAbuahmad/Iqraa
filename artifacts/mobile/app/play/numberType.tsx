import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildNumberRound } from '@/services/publicGames/numberType';

export default function NumberTypeGameScreen() {
  return <TextQuizGame titleKey="playNumberTypeTitle" accent="#4D7C0F" build={buildNumberRound} />;
}
