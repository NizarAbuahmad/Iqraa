/**
 * Crash reporting on Android and iOS, through Firebase Crashlytics. Web gets the
 * no-op in `crashReporting.ts`. What is scrubbed, what is attached and what is not
 * is explained in `crashReportingCore.ts`.
 *
 * Three things to know before changing this file:
 *
 * 1. **The library installs its own handlers** for fatal JavaScript errors and
 *    unhandled promise rejections the first time `getCrashlytics()` runs. This
 *    file therefore adds NO global handler — a second one would report every
 *    crash twice. What the library cannot see is an error React's error boundary
 *    has already caught; `recordError` is for that (see `ErrorBoundary`).
 *
 * 2. **The native module only exists in binaries built from `app.json` version
 *    1.5.0.** An OTA update (JavaScript only) also reaches older binaries that
 *    share the runtime version, so every access is inside try/catch and quietly
 *    does nothing when the module is missing. Do not "simplify" that away: the
 *    failure mode is a launch crash that survives restarts (CLAUDE.md, «`app.json`'s
 *    `version` is the OTA compatibility key»).
 *
 * 3. **Reporting must never throw.** It runs inside error handlers.
 */
import { clearAttribute, safeRole, scrubbedError, type CrashContext } from './crashReportingCore';

type CrashlyticsModule = typeof import('@react-native-firebase/crashlytics');
type Loaded = { mod: CrashlyticsModule; crashlytics: ReturnType<CrashlyticsModule['getCrashlytics']> };

let loaded: Loaded | null | undefined;

function crashlytics(): Loaded | null {
  if (loaded !== undefined) return loaded;
  try {
    const mod = require('@react-native-firebase/crashlytics') as CrashlyticsModule;
    // Constructing the instance is what registers the library's global handlers.
    loaded = { mod, crashlytics: mod.getCrashlytics() };
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Call once, as early as possible (module scope of the root layout). */
export function initCrashReporting(): void {
  try {
    const c = crashlytics();
    if (!c) return;
    // Only builds people actually run: a red screen in development is not a crash worth counting.
    const enabled = !(typeof __DEV__ !== 'undefined' && __DEV__);
    void c.mod.setCrashlyticsCollectionEnabled(c.crashlytics, enabled).catch(() => {});
  } catch {
    // never throw from reporting
  }
}

/** For an error something already caught — an error boundary, say. `where` groups reports. */
export function recordError(error: unknown, where?: string): void {
  try {
    const c = crashlytics();
    if (!c) return;
    const clean = scrubbedError(error);
    if (!clean) return;
    c.mod.recordError(c.crashlytics, clean, where);
  } catch {
    // never throw from reporting
  }
}

/** The role is the only context attached. No id, no email, no name — see the core file. */
export function setCrashContext(context: CrashContext): void {
  try {
    const c = crashlytics();
    const role = safeRole(context.role);
    if (!c || !role) return;
    void c.mod.setAttribute(c.crashlytics, 'role', role).catch(() => {});
  } catch {
    // never throw from reporting
  }
}

/** On sign-out, so the next person on the phone does not inherit the last one's role. */
export function clearCrashContext(): void {
  try {
    const c = crashlytics();
    if (!c) return;
    void c.mod.setAttribute(c.crashlytics, 'role', clearAttribute).catch(() => {});
  } catch {
    // never throw from reporting
  }
}
