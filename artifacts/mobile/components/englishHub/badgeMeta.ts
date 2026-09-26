/**
 * Icon and label per badge — shared by the hub home screen (the earned-so-far
 * shelf) and the lesson screen (the "you just unlocked" celebration), so the
 * two never drift into showing a badge differently depending on where it's seen.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { BadgeId } from '@/services/englishHub/games';
import type { TranslationKey } from '@/services/i18n';

export const BADGE_META: Record<BadgeId, { icon: keyof typeof Ionicons.glyphMap; label: TranslationKey }> = {
  first_star: { icon: 'star', label: 'hubBadgeFirstStar' },
  perfect_round: { icon: 'trophy', label: 'hubBadgePerfectRound' },
  ten_stars: { icon: 'sparkles', label: 'hubBadgeTenStars' },
  three_day_streak: { icon: 'flame-outline', label: 'hubBadgeThreeDayStreak' },
  five_lessons: { icon: 'library', label: 'hubBadgeFiveLessons' },
  week_streak: { icon: 'flame', label: 'hubBadgeWeekStreak' },
  fifty_stars: { icon: 'medal', label: 'hubBadgeFiftyStars' },
};
