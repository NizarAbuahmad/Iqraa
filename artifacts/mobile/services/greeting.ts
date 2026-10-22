/**
 * Today's greeting by the hour on the device. The small hours count as evening:
 * «صباح الخير» at 2 a.m. reads as a bug. Cosmetic, so the device clock is fine
 * here; anything that decides a DAY uses `ammanToday()` instead.
 */
export type GreetingKey = 'homeGreetMorning' | 'homeGreetAfternoon' | 'homeGreetEvening';

export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'homeGreetMorning';
  if (hour >= 12 && hour < 17) return 'homeGreetAfternoon';
  return 'homeGreetEvening';
}
