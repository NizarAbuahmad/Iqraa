/**
 * Maps an interactive id to its component. The id set is closed
 * (`LAB_INTERACTIVE_IDS`), so a new interactive needs an entry here and in the
 * manifest — the `Record` type fails to compile until both exist.
 */
import React from 'react';
import type { LabInteractiveId } from '@workspace/curriculum/lab';
import { LabPeriodicTable } from './LabPeriodicTable';
import { LabMoleCalculator } from './LabMoleCalculator';
import { LabVectorAddition } from './LabVectorAddition';

const COMPONENTS: Record<LabInteractiveId, React.ComponentType> = {
  'periodic-table': LabPeriodicTable,
  'mole-calculator': LabMoleCalculator,
  'vector-addition': LabVectorAddition,
};

export function LabInteractive({ interactiveId }: { interactiveId: LabInteractiveId }) {
  const Component = COMPONENTS[interactiveId];
  return <Component />;
}
