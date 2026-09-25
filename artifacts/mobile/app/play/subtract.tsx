import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MathDrillGame } from '@/components/publicGames/MathDrillGame';
import { parseDrillParams } from '@/services/publicGames/mathDrill';

export default function SubtractGameScreen() {
  const params = useLocalSearchParams<{ max?: string; secs?: string }>();
  return <MathDrillGame initial={parseDrillParams('sub', params)} />;
}
