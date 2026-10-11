/**
 * Maps a Math Corner tool id to its component. A `Record` over the closed id
 * set, so adding an id to `MATH_TOOL_IDS` without a component here is a
 * compile error, not a blank screen.
 */
import React from 'react';
import type { MathToolId } from '@/services/mathTools';
import { MathCalculator } from './MathCalculator';
import { MathFormulaSheet } from './MathFormulaSheet';
import { MathUnitConverter } from './MathUnitConverter';

const TOOLS: Record<MathToolId, React.ComponentType> = {
  calculator: MathCalculator,
  converter: MathUnitConverter,
  formulas: MathFormulaSheet,
};

export function MathTool({ toolId }: { toolId: MathToolId }) {
  const Tool = TOOLS[toolId];
  return <Tool />;
}
