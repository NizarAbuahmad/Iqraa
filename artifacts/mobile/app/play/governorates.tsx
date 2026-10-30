import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { JordanMap } from '@/components/publicGames/JordanMap';
import { buildGovernorateRound } from '@/services/publicGames/governorates';

export default function GovernoratesGameScreen() {
  return (
    <TextQuizGame
      titleKey="playGovernoratesTitle"
      accent="#1E3A8A"
      build={buildGovernorateRound}
      reveal={(q, picked, accent) => <JordanMap correctId={q.correctId} pickedId={picked} accent={accent} />}
    />
  );
}
