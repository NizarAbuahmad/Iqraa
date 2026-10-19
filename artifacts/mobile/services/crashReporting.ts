/**
 * Crash reporting — the web build and anything without a native module.
 *
 * Metro serves `crashReporting.native.ts` on Android and iOS and this file
 * everywhere else, so the web bundle never imports `@react-native-firebase`
 * (it has no web implementation). Both files export the same four functions;
 * keep them in step. See `crashReportingCore.ts` for what is and is not sent.
 */
import type { CrashContext } from './crashReportingCore';

export function initCrashReporting(): void {}

export function recordError(_error: unknown, _where?: string): void {}

export function setCrashContext(_context: CrashContext): void {}

export function clearCrashContext(): void {}
