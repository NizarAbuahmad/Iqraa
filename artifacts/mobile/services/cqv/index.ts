export * from './types';
export * from './artifacts';
export * from './catalog';
export * from './reports';
export * from './thresholds';
export * from './progress';
export * from './batch';

/** Internal CQV is never shown in Investor MVP chrome. Enable via env or __DEV__. */
export function isCqvEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_ENABLE_CQV === '1') return true;
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  return false;
}
