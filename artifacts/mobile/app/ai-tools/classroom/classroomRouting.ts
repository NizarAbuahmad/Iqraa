/**
 * Pure routing helpers for the classroom hub → builder flow.
 *
 * Extracted so they can be imported by both the index and builder screens
 * and exercised directly in unit tests without React-Native dependencies.
 */

export interface ActivityCard {
  id: string;
  emoji: string;
  titleKey: string;
  descKey: string;
  available: boolean;
  difficulty: string;
  groupType: string;
  duration: string;
}

export const ACTIVITY_CARDS: ActivityCard[] = [
  {
    id: 'escape-challenge',
    emoji: '🔐',
    titleKey: 'activityEscapeTitle',
    descKey: 'activityEscapeDesc',
    available: true,
    difficulty: 'Easy–Advanced',
    groupType: 'Groups',
    duration: '10–30 min',
  },
  {
    id: 'bingo',
    emoji: '🎱',
    titleKey: 'activityBingoTitle',
    descKey: 'activityBingoDesc',
    available: true,
    difficulty: 'Easy–Medium',
    groupType: 'Whole Class',
    duration: '15–25 min',
  },
  {
    id: 'relay',
    emoji: '🏃',
    titleKey: 'activityRelayTitle',
    descKey: 'activityRelayDesc',
    available: true,
    difficulty: 'Medium–Advanced',
    groupType: 'Teams',
    duration: '20–35 min',
  },
  {
    id: 'exit-ticket',
    emoji: '🎫',
    titleKey: 'activityExitTitle',
    descKey: '',
    available: false,
    difficulty: '',
    groupType: '',
    duration: '',
  },
];

/**
 * Builds the Expo Router push payload for navigating from the hub to the
 * builder.  The `activityType` param carries the selected card's id.
 *
 * Accepts any object that has at least an `id` string so it works with both
 * the minimal ActivityCard exported from this module and the richer local
 * ActivityCard used by the marketplace UI in index.tsx.
 *
 * Mirrors the router.push() call in ClassroomHubScreen.handleSelect().
 */
export function buildBuilderRoute(card: { id: string }): {
  pathname: string;
  params: { activityType: string };
} {
  return {
    pathname: '/ai-tools/classroom/builder',
    params: { activityType: card.id },
  };
}

/**
 * Resolves the activityType that the builder passes to generateClassroomActivity.
 *
 * Mirrors builder.tsx line 67:
 *   activityType: params.activityType ?? 'escape-challenge'
 */
export function resolveActivityType(params: { activityType?: string }): string {
  return params.activityType ?? 'escape-challenge';
}
