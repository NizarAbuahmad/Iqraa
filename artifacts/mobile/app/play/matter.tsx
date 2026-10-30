import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildMatterRound } from '@/services/publicGames/matterStates';

export default function MatterGameScreen() {
  return <TextQuizGame titleKey="playMatterTitle" accent="#0E7490" build={buildMatterRound} />;
}
