import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildGovernorateRound } from '@/services/publicGames/governorates';

export default function GovernoratesGameScreen() {
  return <TextQuizGame titleKey="playGovernoratesTitle" accent="#1E3A8A" build={buildGovernorateRound} />;
}
