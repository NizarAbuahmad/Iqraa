import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MathDrillGame } from '@/components/publicGames/MathDrillGame';
import { parseDrillParams } from '@/services/publicGames/mathDrill';

export default function MultiplyGameScreen() {
  const params = useLocalSearchParams<{ tables?: string; secs?: string }>();
  return <MathDrillGame initial={parseDrillParams(params)} />;
}
