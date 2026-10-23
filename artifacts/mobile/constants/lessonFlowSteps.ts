/**
 * The six steps of a lesson flow, as pure data: the icon and colour each wears.
 *
 * Two screens draw them, the builder (`app/ai-tools/lesson-flow.tsx`) and the
 * saved-material viewer (`app/workspace/view.tsx`), and each kept its own
 * literals. They agreed on nothing but the warm-up, and disagreed with
 * `CONCEPTS` about the two steps that ARE teaching concepts: the worksheet was
 * `document-text-outline` in `#6D28D9` (the lesson plan's icon, a violet no
 * concept has) and the activity `flash-outline` in `#4F46E5` (a twin of the lesson
 * plan's indigo). The exit ticket wore `palette.warning`, `#B54708` on light
 * and a true amber on dark: amber means "now" and nothing else.
 *
 * - `activity` and `worksheet` are concepts and read `CONCEPTS`.
 * - `warmup`, `guided` and `exitTicket` are steps of this flow, not tools, and
 *   have a colour of their own: each carries white at 4.5:1, none is amber, and
 *   all are at least CIEDE2000 7 from every concept and 8 apart from each other
 *   and from the two concept steps (`iconSystem.test.ts`).
 * - `objectives` has no colour here (`color: null`): it is ink, which each
 *   screen takes from its own palette so it still reads on the dark card.
 *
 * A glyph drawn on a card goes through `readableOn(color, colors.card, 3)`.
 */
import { conceptOf, type ConceptId, type IconName } from './icons.ts';

export type FlowStepKey = 'objectives' | 'warmup' | 'activity' | 'guided' | 'worksheet' | 'exitTicket';

export const FLOW_STEP_KEYS = ['objectives', 'warmup', 'activity', 'guided', 'worksheet', 'exitTicket'] as const satisfies readonly FlowStepKey[];

/** Which concept a step is. The others are steps of the flow only. */
export const FLOW_STEP_CONCEPT: Partial<Record<FlowStepKey, ConceptId>> = {
  activity: 'activity',
  worksheet: 'worksheet',
};

const OWN_LOOK: Partial<Record<FlowStepKey, { icon: IconName; color: string | null }>> = {
  objectives: { icon: 'flag-outline', color: null },
  warmup: { icon: 'flame-outline', color: '#96412C' },
  guided: { icon: 'pencil-outline', color: '#20576F' },
  exitTicket: { icon: 'ticket-outline', color: '#9C0D71' },
};

export const FLOW_STEP: Record<FlowStepKey, { icon: IconName; color: string | null }> = Object.fromEntries(
  FLOW_STEP_KEYS.map(k => {
    const concept = FLOW_STEP_CONCEPT[k];
    return [k, concept ? conceptOf(concept) : OWN_LOOK[k]!];
  }),
) as Record<FlowStepKey, { icon: IconName; color: string | null }>;

/** The step's colour, or `ink` for the one step (objectives) that has none of its own. */
export const flowStepColor = (key: FlowStepKey, ink: string): string => FLOW_STEP[key].color ?? ink;
