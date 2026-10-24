# Parent approval for email students — the app (PR B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app half of parent approval: a held student sees a waiting screen, the parent gets a public page that approves or declines from the mailed link, and sign-up asks for a parent's email instead of the age tick — all dark until the server flag is on.

**Architecture:** Pure decisions live in `artifacts/mobile/services/` (loadable by the bare `node --test` runner, so they are unit-tested); screens and `AuthContext` are thin. The app asks `GET /api/guardian-consent/config` whether the flag is on: **off (or unreachable) means today's behaviour, byte for byte** (age tick on sign-up and role switch); on means a parent's email at sign-up and no tick on role switches. A held student's session is routed to `/guardian-waiting` by one pure function the root layout calls; the server stays the enforcer (403 `guardian_approval_required`), and the first such 403 makes the app re-read `/auth/me`. The parent's page `/guardian` is public and reads its token from `location.hash`, never from a path or query, and is kept out of analytics and crash reports.

**Tech Stack:** Expo / React Native (also the web build), expo-router 6, TypeScript, `node --test` with `--experimental-strip-types` for `services/__tests__`.

**Spec:** `docs/superpowers/specs/2026-10-24-guardian-approval-design.md` (sections *Flows*, *Client*, *Rollout*, *Limits*). Server half: `docs/superpowers/plans/2026-10-24-guardian-approval-server.md` (already built on this branch; PR #1274).

## Global Constraints

- **Flag off changes nothing.** With `GUARDIAN_APPROVAL` unset on the server, `GET /guardian-consent/config` answers `{enabled:false}` and every screen behaves exactly as on `main` today (tick on sign-up and role switch, no waiting screen). If the config call fails, the app behaves as if it were off.
- **The token never touches a path, a query, an analytics screen name or a crash message.** The parent link is `{origin}/guardian#{token}` (43 chars, `[A-Za-z0-9_-]`); the page reads `location.hash`, posts the token in a JSON body to `POST /api/guardian-consent/lookup` and `/decide`, and `/guardian` is excluded from `trackScreen`. `crashReportingCore.scrub` removes a fragment and any 43-char token.
- **Brand and wording** (CI + `i18nTerminology.test.ts`): Arabic brand is «إقرأ» (never «اقرأ»); Latin is "Iqrra". The English word **"guardian"** is banned in `i18n.ts` copy (say "parent" / "the adult responsible for you"), as are "please", "roster", "class code" («رمز الربط» / "link code"), «طلاب» (use «طلبة»). No tanwīn written as «اً» (put the sign on the letter before the alif).
- **Design scale ratchet** (`designScale.test.ts`): new `.tsx` may use only `TYPE` (`micro 11, caption 13, label 14, body 15, bodyLg 17, title 20, headline 24, display 28, hero 32`), `SPACE` (`xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, section 32, page 40, hero 48`) and `RADIUS` (`xs 4, sm 8, md 12, lg 16, xl 24, pill 999`) tokens for font sizes, radii and padding/margins/gaps. The ratchet has 0 spare radius and 1 spare font size: **no raw numeric `fontSize`, `borderRadius`, `padding*`, `margin*`, `gap`**. No hand-written `shadowColor`; cards come from `Surface`/`useSurface`. No `accessibilityState=` (use `aria-*`). Corner colours come from `useColors()`, never the global `palette`.
- **Mobile test runner:** only `services/__tests__/**/*.test.ts` runs; it cannot import `react-native`, `expo-*`, `@expo/*` or `services/apiClient.ts`. Tests import siblings with an explicit `.ts` extension. Pure code that needs the API base URL or `apiJson` takes them as injected arguments or does `await import('./apiClient')` inside a function (as `services/features.ts` does).
- **No `sed -i`/`perl -pi` on source** (UTF-8 Arabic). Use the Edit tool.
- **Branch and PR:** work continues on `claude/nice-volta-qf1nyt` (the only branch this session may push to), i.e. on draft PR #1274, now carrying server + app. No native module is added, so `app.json` `version` is **not** bumped. Merging deploys the web bundle with the server; the flag is still unset, so users see no change.
- **Not in this PR:** `constants/legal.ts` (privacy §5 / terms §1 still describe the tick, `LEGAL_VERSION` stays `2026-10-23`): changing it re-prompts every user and needs a person to read the wording first; it is an owner step before the flag is turned on (written down in Task 9). No change to teacher-code or parent sign-up. No universal links / `associatedDomains` (the parent page is web-only; on native it says to open the link in a browser).

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `services/guardianApproval.ts` | create | Types (`GuardianStatus`), `looksLikeEmail`, `isGuardianRequiredBody`, `guardianFromApi` (pure, no imports) |
| `services/routeGating.ts` | modify | `/guardian` in `PUBLIC_ROUTES`; `needsGuardianApproval`, `guardianRedirect`, `GUARDIAN_WAITING_ROUTE` |
| `services/signupMethod.ts` | modify | `switchNeedsAgeConfirmation(from, to, guardianEnabled?)` |
| `services/apiErrorKey.ts` | modify | codes → translation keys for the new server errors |
| `services/guardianConsentLink.ts` | create | `parseConsentFragment(hash)` |
| `services/screenTracking.ts` | create | `shouldTrackScreen(pathname)` |
| `services/crashReportingCore.ts` | modify | scrub a fragment and a bare 43-char token |
| `services/guardianApi.ts` | create | `makeGuardianApi(deps)`: config, lookup, decide (public), request (authenticated) |
| `services/guardianConfig.ts` | create | cached `fetchGuardianConfig`, `useGuardianConfig()` hook |
| `services/i18n.ts` | modify | all new strings, Arabic first |
| `services/apiClient.ts` | modify | `setOnGuardianRequired(cb)`; `apiFetch` reports a `guardian_approval_required` 403 |
| `context/AuthContext.tsx` | modify | `User.guardianStatus/guardianParentEmailMasked`, `refreshUser()`, post-sign-in refresh, `parentEmail` in `register`/`loginWithGoogle` |
| `app/_layout.tsx` | modify | the guardian gate; `shouldTrackScreen`; `Stack.Screen` for the waiting screen |
| `app/guardian-waiting.tsx` | create | the waiting screen |
| `app/guardian.tsx` | create | the parent's public page |
| `app/(auth)/register.tsx` | modify | parent's-email field replaces the tick when the config is on |
| `app/claim-required.tsx`, `app/settings.tsx`, `app/setup-subjects.tsx` | modify | role-switch screens drop the tick when the config is on |
| tests under `services/__tests__/` | create/modify | one per pure module + the edited ones |
| `docs/status-log.md`, `STATUS.md`, spec | modify | write-up |

---

### Task 1: The pure core — status, gate and public route

**Files:**
- Create: `artifacts/mobile/services/guardianApproval.ts`
- Modify: `artifacts/mobile/services/routeGating.ts`, `artifacts/mobile/services/signupMethod.ts`, `artifacts/mobile/services/apiErrorKey.ts`
- Test: `artifacts/mobile/services/__tests__/guardianApproval.test.ts` (create), `routeGating.test.ts`, `signupMethod.test.ts`, `apiErrorKey.test.ts` (append)

**Interfaces:**
- Produces: `GuardianStatus`, `GuardianUserLike`, `looksLikeEmail(s)`, `isGuardianRequiredBody(text)`, `guardianFromApi(apiUser)` (guardianApproval.ts); `GUARDIAN_WAITING_ROUTE = '/guardian-waiting'`, `needsGuardianApproval(user)`, `guardianRedirect(user, pathname): string | null` (routeGating.ts); `switchNeedsAgeConfirmation(from, to, guardianEnabled = false)`.

- [ ] **Step 1: Write the failing tests**

`services/__tests__/guardianApproval.test.ts`:

```ts
/**
 * What this guards: the app's reading of the server's parent-approval answer. A status we do not know is treated
 * as "not required" (the server still enforces and the first 403 re-reads /auth/me), and the 403 detector must
 * not fire on any other 403.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { guardianFromApi, isGuardianRequiredBody, looksLikeEmail } from '../guardianApproval.ts';

describe('guardianFromApi', () => {
  it('passes the five known statuses and the masked address through', () => {
    for (const s of ['not_required', 'approved', 'needed', 'waiting', 'declined'] as const) {
      assert.deepEqual(guardianFromApi({ guardianStatus: s, guardianParentEmailMasked: 'mu***@example.test' }), {
        guardianStatus: s,
        guardianParentEmailMasked: 'mu***@example.test',
      });
    }
  });
  it('drops an unknown status and a non-string address', () => {
    assert.deepEqual(guardianFromApi({ guardianStatus: 'banana', guardianParentEmailMasked: 7 }), {});
    assert.deepEqual(guardianFromApi({}), {});
    assert.deepEqual(guardianFromApi({ guardianStatus: null }), {});
  });
});

describe('isGuardianRequiredBody', () => {
  it('is true only for the guardian_approval_required code', () => {
    assert.equal(isGuardianRequiredBody('{"code":"guardian_approval_required","error":"x"}'), true);
    assert.equal(isGuardianRequiredBody('{"code":"account_suspended"}'), false);
    assert.equal(isGuardianRequiredBody('{"error":"Forbidden"}'), false);
    assert.equal(isGuardianRequiredBody('not json'), false);
    assert.equal(isGuardianRequiredBody(''), false);
    assert.equal(isGuardianRequiredBody('null'), false);
  });
});

describe('looksLikeEmail', () => {
  it('accepts an ordinary address and refuses obvious non-addresses', () => {
    assert.equal(looksLikeEmail('mum@example.test'), true);
    assert.equal(looksLikeEmail('  mum@example.test  '), true);
    for (const bad of ['', 'mum', 'mum@', '@example.test', 'mum@example', 'mu m@example.test']) {
      assert.equal(looksLikeEmail(bad), false, JSON.stringify(bad));
    }
  });
});
```

Append to `routeGating.test.ts` (extend its existing import from `'../routeGating.ts'` with the new names):

```ts
import { GUARDIAN_WAITING_ROUTE, guardianRedirect, needsGuardianApproval } from '../routeGating.ts';

describe('/guardian is a public route', () => {
  it('is public, and a route that merely starts with the same letters is not', () => {
    assert.equal(isPublicRoute('/guardian'), true);
    assert.equal(isPublicRoute('/guardian/anything'), true);
    assert.equal(isPublicRoute('/guardian-waiting'), false);
    assert.equal(isPublicRoute('/guardians'), false);
  });
});

describe('needsGuardianApproval', () => {
  it('holds a student whose status is needed, waiting or declined, and no one else', () => {
    for (const s of ['needed', 'waiting', 'declined']) {
      assert.equal(needsGuardianApproval({ role: 'student', guardianStatus: s as any }), true, s);
    }
    for (const s of ['not_required', 'approved', undefined]) {
      assert.equal(needsGuardianApproval({ role: 'student', guardianStatus: s as any }), false, String(s));
    }
    for (const role of ['teacher', 'parent', 'school_admin', 'system_admin']) {
      assert.equal(needsGuardianApproval({ role, guardianStatus: 'needed' }), false, role);
    }
    assert.equal(needsGuardianApproval(null), false);
  });
});

describe('guardianRedirect', () => {
  const held = { role: 'student', guardianStatus: 'waiting' as const };
  it('sends a held student anywhere outside the three open screens to the waiting screen', () => {
    assert.equal(guardianRedirect(held, '/(tabs)'), GUARDIAN_WAITING_ROUTE);
    assert.equal(guardianRedirect(held, '/notifications'), GUARDIAN_WAITING_ROUTE);
    assert.equal(guardianRedirect(held, '/setup-grade'), GUARDIAN_WAITING_ROUTE);
    assert.equal(guardianRedirect(held, '/'), GUARDIAN_WAITING_ROUTE);
  });
  it('leaves the waiting screen, joining a class with a teacher code, and deleting the account alone', () => {
    for (const p of [GUARDIAN_WAITING_ROUTE, '/join-class', '/delete-account']) {
      assert.equal(guardianRedirect(held, p), null, p);
    }
  });
  it('does not treat a lookalike path as open', () => {
    assert.equal(guardianRedirect(held, '/join-classes'), GUARDIAN_WAITING_ROUTE);
    assert.equal(guardianRedirect(held, '/delete-account-now'), GUARDIAN_WAITING_ROUTE);
  });
  it('moves a student who is no longer held off the waiting screen', () => {
    assert.equal(guardianRedirect({ role: 'student', guardianStatus: 'approved' }, GUARDIAN_WAITING_ROUTE), '/(tabs)');
    assert.equal(guardianRedirect({ role: 'student', guardianStatus: 'not_required' }, GUARDIAN_WAITING_ROUTE), '/(tabs)');
    assert.equal(guardianRedirect({ role: 'teacher' }, GUARDIAN_WAITING_ROUTE), '/(tabs)');
  });
  it('does nothing for anyone not held, elsewhere', () => {
    assert.equal(guardianRedirect({ role: 'student', guardianStatus: 'approved' }, '/notifications'), null);
    assert.equal(guardianRedirect({ role: 'teacher' }, '/(tabs)'), null);
    assert.equal(guardianRedirect(null, '/(tabs)'), null);
  });
});
```

Append to `signupMethod.test.ts` (inside/after its `switchNeedsAgeConfirmation` describe; extend the import only if needed):

```ts
describe('switchNeedsAgeConfirmation with the parent-approval switch', () => {
  it('asks for the tick as before when the switch is off or unspecified', () => {
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student'), true);
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student', false), true);
  });
  it('asks for nothing when a parent approves instead', () => {
    assert.equal(switchNeedsAgeConfirmation('teacher', 'student', true), false);
    assert.equal(switchNeedsAgeConfirmation('parent', 'student', true), false);
  });
  it('still never asks for a change that is not into student', () => {
    assert.equal(switchNeedsAgeConfirmation('student', 'parent', false), false);
    assert.equal(switchNeedsAgeConfirmation('student', 'student', false), false);
  });
});
```

Append to `apiErrorKey.test.ts` (match the file's existing helper; read the first 40 lines to copy its call style — it calls the exported key function with `{code}`/`ApiError`-like objects):

```ts
describe('parent-approval codes', () => {
  it('maps each new server code to its own translation key', () => {
    const expected: Record<string, string> = {
      parent_email_required: 'errParentEmailRequired',
      parent_email_invalid: 'errParentEmailInvalid',
      parent_email_is_own: 'errParentEmailIsOwn',
      email_not_verified: 'errEmailNotVerifiedYet',
      guardian_rate_limited: 'errGuardianRateLimited',
      guardian_approval_required: 'errGuardianApprovalRequired',
    };
    for (const [code, key] of Object.entries(expected)) {
      assert.equal(errorKey({ code, status: 400 } as any, 'fallback'), key, code);
    }
  });
});
```
(Replace `errorKey` with the module's real exported function name.)

- [ ] **Step 2: Run them and see them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/guardianApproval.test.ts services/__tests__/routeGating.test.ts services/__tests__/signupMethod.test.ts services/__tests__/apiErrorKey.test.ts`
Expected: FAIL (missing module / exports).

- [ ] **Step 3: Write `services/guardianApproval.ts`**

```ts
/**
 * The app's side of the server's parent-approval answer. No imports on purpose: `node --test` loads this file.
 *
 * `/auth/me` is the only place the server reports `guardianStatus` (the sign-in answers do not carry it), so an
 * account the app has just signed in has no status until `AuthContext.refreshUser()` reads `/me`. Unknown or
 * missing means "not held": the server is the enforcer, and the first 403 `guardian_approval_required` makes
 * the app re-read `/me`.
 */
export type GuardianStatus = 'not_required' | 'approved' | 'needed' | 'waiting' | 'declined';

const STATUSES: readonly string[] = ['not_required', 'approved', 'needed', 'waiting', 'declined'];

export interface GuardianUserLike {
  role?: string | null;
  guardianStatus?: GuardianStatus | null;
}

/** The two fields the app keeps from `/auth/me`, or `{}` when the server sent nothing usable. */
export function guardianFromApi(api: { guardianStatus?: unknown; guardianParentEmailMasked?: unknown }): {
  guardianStatus?: GuardianStatus;
  guardianParentEmailMasked?: string;
} {
  const out: { guardianStatus?: GuardianStatus; guardianParentEmailMasked?: string } = {};
  if (typeof api.guardianStatus === 'string' && STATUSES.includes(api.guardianStatus)) {
    out.guardianStatus = api.guardianStatus as GuardianStatus;
    if (typeof api.guardianParentEmailMasked === 'string') out.guardianParentEmailMasked = api.guardianParentEmailMasked;
  }
  return out;
}

/** True when a 403 body is the server holding a student for a parent's approval. Never throws. */
export function isGuardianRequiredBody(text: string): boolean {
  try {
    const body = JSON.parse(text);
    return !!body && typeof body === 'object' && (body as { code?: unknown }).code === 'guardian_approval_required';
  } catch {
    return false;
  }
}

/** A convenience check for the parent's-email field; the server's validation is the real one. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
```

- [ ] **Step 4: Edit `services/routeGating.ts`**

Add `import type { GuardianUserLike } from './guardianApproval.ts';` at the top, add `'/guardian'` to `PUBLIC_ROUTES` (append, keep the order), and append at the end of the file:

```ts
// ─── Held for a parent's approval ────────────────────────────────────────────

export const GUARDIAN_WAITING_ROUTE = '/guardian-waiting';

/** A student the server is holding until a parent approves (status needed, waiting or declined). */
export function needsGuardianApproval(user: GuardianUserLike | null | undefined): boolean {
  if (!user || user.role !== 'student') return false;
  return user.guardianStatus === 'needed' || user.guardianStatus === 'waiting' || user.guardianStatus === 'declined';
}

/** The only places a held student may be: the waiting screen, joining a class with a teacher's code (which lifts
 *  the hold), and deleting the account. Everything else answers 403 from the server anyway. */
const HELD_MAY_OPEN = [GUARDIAN_WAITING_ROUTE, '/join-class', '/delete-account'];

function isHeldMayOpen(pathname: string): boolean {
  return HELD_MAY_OPEN.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Where the root layout should send a signed-in user for the parent-approval rule, or null to leave them be:
 * a held student goes to the waiting screen from anywhere else; a user who is not (or no longer) held is moved
 * off the waiting screen to the tabs.
 */
export function guardianRedirect(user: GuardianUserLike | null | undefined, pathname: string): string | null {
  if (needsGuardianApproval(user)) return isHeldMayOpen(pathname) ? null : GUARDIAN_WAITING_ROUTE;
  if (user && pathname === GUARDIAN_WAITING_ROUTE) return '/(tabs)';
  return null;
}
```

Also add `'/guardian-waiting'`, `'/delete-account'` stays, to `NON_TEACHER_ROUTES` only if it is not already matched there (it must be listed so the non-teacher bounce does not send a student away from the waiting screen): add `'/guardian-waiting'`.

- [ ] **Step 5: Edit `services/signupMethod.ts`** — change `switchNeedsAgeConfirmation`:

```ts
/** A switch into student asks for the tick, unless a parent's approval replaces it (`guardianEnabled`). */
export function switchNeedsAgeConfirmation(from: string | undefined | null, to: string, guardianEnabled = false): boolean {
  return to === 'student' && from !== 'student' && !guardianEnabled;
}
```
(Keep the real parameter types of the existing function; only add the third parameter and the `&& !guardianEnabled`.)

- [ ] **Step 6: Edit `services/apiErrorKey.ts`** — add to `BY_CODE` (after `age_confirmation_required`):

```ts
  // Parent approval for email students.
  parent_email_required: 'errParentEmailRequired',
  parent_email_invalid: 'errParentEmailInvalid',
  parent_email_is_own: 'errParentEmailIsOwn',
  email_not_verified: 'errEmailNotVerifiedYet',
  guardian_rate_limited: 'errGuardianRateLimited',
  guardian_approval_required: 'errGuardianApprovalRequired',
```

- [ ] **Step 7: Run the tests, expect pass**

Run the Step 2 command. Expected: PASS. (`i18n.test.ts` is not run yet — the keys arrive in Task 4; `apiErrorKey.ts` imports nothing, so these tests pass now.)

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services/guardianApproval.ts artifacts/mobile/services/routeGating.ts artifacts/mobile/services/signupMethod.ts artifacts/mobile/services/apiErrorKey.ts artifacts/mobile/services/__tests__/guardianApproval.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts artifacts/mobile/services/__tests__/signupMethod.test.ts artifacts/mobile/services/__tests__/apiErrorKey.test.ts
git commit -m "Guardian approval (app): the status, the gate and the public route as pure code"
```

---

### Task 2: The token stays out of analytics, crash reports and paths

**Files:**
- Create: `artifacts/mobile/services/guardianConsentLink.ts`, `artifacts/mobile/services/screenTracking.ts`
- Modify: `artifacts/mobile/services/crashReportingCore.ts`
- Test: `services/__tests__/guardianConsentLink.test.ts`, `screenTracking.test.ts` (create); `crashReportingCore.test.ts` (append — find the existing scrub test file with `grep -l scrub services/__tests__/*.ts`)

**Interfaces:**
- Produces: `parseConsentFragment(hash: string | null | undefined): string | null`; `shouldTrackScreen(pathname: string): boolean`; `scrub` also removes `#…` fragments and bare 43-char tokens.

- [ ] **Step 1: Write the failing tests**

`guardianConsentLink.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseConsentFragment } from '../guardianConsentLink.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'; // 43 chars

describe('parseConsentFragment', () => {
  it('reads the token from a location.hash, with or without the #', () => {
    assert.equal(TOKEN.length, 43);
    assert.equal(parseConsentFragment(`#${TOKEN}`), TOKEN);
    assert.equal(parseConsentFragment(TOKEN), TOKEN);
  });
  it('refuses anything that is not exactly a 43-character token', () => {
    for (const bad of ['', '#', '#short', `#${TOKEN}x`, `#${TOKEN.slice(1)}`, `#token=${TOKEN}`, `#${TOKEN.slice(0, 42)}!`, null, undefined]) {
      assert.equal(parseConsentFragment(bad as any), null, String(bad));
    }
  });
});
```

`screenTracking.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldTrackScreen } from '../screenTracking.ts';

describe('shouldTrackScreen', () => {
  it('never reports the parent consent page', () => {
    for (const p of ['/guardian', '/guardian/', '/guardian/x']) assert.equal(shouldTrackScreen(p), false, p);
  });
  it('reports every other screen, including a lookalike', () => {
    for (const p of ['/', '/(tabs)', '/guardian-waiting', '/guardians', '/take/ABC234', '/live']) {
      assert.equal(shouldTrackScreen(p), true, p);
    }
  });
});
```

Crash scrub test (append to the existing scrub test file):
```ts
describe('scrub: parent consent links', () => {
  const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
  it('removes a fragment and a bare consent token', () => {
    assert.ok(!scrub(`Failed at https://app.iqrra.com/guardian#${TOKEN}`).includes(TOKEN));
    assert.ok(!scrub(`bad token ${TOKEN} here`).includes(TOKEN));
    assert.match(scrub('see https://x.test/p#frag-ment_123456789012'), /#<fragment>/);
  });
  it('leaves ordinary words and short ids alone', () => {
    assert.equal(scrub('Cannot read property of undefined'), 'Cannot read property of undefined');
    assert.match(scrub('item #12 failed'), /#12/);
  });
});
```

- [ ] **Step 2: Run, see them fail** — `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/guardianConsentLink.test.ts services/__tests__/screenTracking.test.ts services/__tests__/crashReportingCore.test.ts`. Expected FAIL.

- [ ] **Step 3: Implement**

`services/guardianConsentLink.ts`:
```ts
/**
 * The parent's link is `{origin}/guardian#{token}`: the token is the whole fragment, 43 base64url characters.
 * A fragment never reaches a server, a proxy or an access log; reading it is the page's job and nothing else's.
 * Anything that is not exactly a token answers null, which the page shows as "this link does not work".
 */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function parseConsentFragment(hash: string | null | undefined): string | null {
  if (typeof hash !== 'string') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return TOKEN.test(raw) ? raw : null;
}
```

`services/screenTracking.ts`:
```ts
/**
 * Screen names go to analytics as the route pathname. The parent consent page must never be one of them: its
 * address carries the approval token in the fragment, and even without it "a parent opened an approval link"
 * is not something to send to a third party.
 */
export function shouldTrackScreen(pathname: string): boolean {
  return !(pathname === '/guardian' || pathname.startsWith('/guardian/'));
}
```

`crashReportingCore.ts`: add to `RULES` (before the `\?…` rule; keep the array's `[RegExp, string]` shape):
```ts
  // A parent's consent link carries its token in the fragment; the token alone is 43 base64url characters.
  [/#[A-Za-z0-9_-]{16,}/g, '#<fragment>'],
  [/\b[A-Za-z0-9_-]{43}\b/g, '<token>'],
```
Check the existing rules do not already swallow this (a 43-char token must not be rewritten by an earlier rule into something that still contains it) — the test above is the proof.

- [ ] **Step 4: Run, expect pass.** Also run `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/crashReporting*.test.ts` for regressions.

- [ ] **Step 5: Commit**
```bash
git add artifacts/mobile/services/guardianConsentLink.ts artifacts/mobile/services/screenTracking.ts artifacts/mobile/services/crashReportingCore.ts artifacts/mobile/services/__tests__/guardianConsentLink.test.ts artifacts/mobile/services/__tests__/screenTracking.test.ts artifacts/mobile/services/__tests__/crashReportingCore.test.ts
git commit -m "Guardian approval (app): keep the consent token out of analytics and crash reports"
```

---

### Task 3: The API calls and the config switch

**Files:**
- Create: `artifacts/mobile/services/guardianApi.ts`, `artifacts/mobile/services/guardianConfig.ts`
- Test: `services/__tests__/guardianApi.test.ts`, `guardianConfig.test.ts` (create)

**Interfaces:**
- Consumes: server shapes — `GET /api/guardian-consent/config` → `{enabled:boolean}`; `POST /guardian-consent/lookup {token}` → 200 `{status:'open', childFirstName}` | `{status:'expired'|'decided'|'invalid'}`; `POST /guardian-consent/decide {token, decision:'approved'|'declined', confirmGuardian?}` → 200 `{decision}` | 400 `decision_invalid`/`guardian_confirmation_required` | 410 `consent_link_unusable` | 404 `guardian_approval_disabled`; authenticated `POST /auth/guardian-request {parentEmail}` → 200 `{parentEmailMasked, emailSent, expiresAt}`.
- Produces: `makeGuardianApi({ baseUrl, fetchImpl, apiJson })` returning `{ config(), lookup(token), decide(token, decision, confirm), request(parentEmail) }`; `GuardianApiError(message, status, code)`; `fetchGuardianConfig(load?)`, `resetGuardianConfigCache()`, `useGuardianConfig(): { enabled: boolean; loading: boolean }`; default `guardianApi` (lazy imports).

- [ ] **Step 1: Write the failing tests**

`guardianApi.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GuardianApiError, makeGuardianApi } from '../guardianApi.ts';

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function api(fetchImpl: (url: string, init: RequestInit) => Promise<Response>, apiJson?: any) {
  return makeGuardianApi({ baseUrl: async () => 'https://api.test/api', fetchImpl: fetchImpl as any, apiJson });
}

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

describe('guardianApi', () => {
  it('config: GETs /guardian-consent/config and reads enabled', async () => {
    let seen = '';
    const g = api(async (url, init) => { seen = `${init.method ?? 'GET'} ${url}`; return res(200, { enabled: true }); });
    assert.deepEqual(await g.config(), { enabled: true });
    assert.equal(seen, 'GET https://api.test/api/guardian-consent/config');
  });

  it('config: anything but a boolean true is off', async () => {
    assert.deepEqual(await api(async () => res(200, { enabled: 'yes' })).config(), { enabled: false });
    assert.deepEqual(await api(async () => res(200, {})).config(), { enabled: false });
  });

  it('lookup: POSTs the token in the body, never in the URL', async () => {
    let url = ''; let body = '';
    const g = api(async (u, init) => { url = u; body = String(init.body); return res(200, { status: 'open', childFirstName: 'Sami' }); });
    assert.deepEqual(await g.lookup(TOKEN), { status: 'open', childFirstName: 'Sami' });
    assert.equal(url, 'https://api.test/api/guardian-consent/lookup');
    assert.ok(!url.includes(TOKEN));
    assert.deepEqual(JSON.parse(body), { token: TOKEN });
  });

  it('lookup: an unknown status or a malformed answer is "invalid"', async () => {
    assert.deepEqual(await api(async () => res(200, { status: 'weird' })).lookup(TOKEN), { status: 'invalid' });
    assert.deepEqual(await api(async () => res(200, null)).lookup(TOKEN), { status: 'invalid' });
  });

  it('decide: sends decision and confirmation, returns the decision', async () => {
    let body = '';
    const g = api(async (_u, init) => { body = String(init.body); return res(200, { decision: 'approved' }); });
    assert.deepEqual(await g.decide(TOKEN, 'approved', true), { decision: 'approved' });
    assert.deepEqual(JSON.parse(body), { token: TOKEN, decision: 'approved', confirmGuardian: true });
  });

  it('decide: a non-200 throws a GuardianApiError carrying status and code', async () => {
    const g = api(async () => res(410, { code: 'consent_link_unusable', error: 'x' }));
    await assert.rejects(g.decide(TOKEN, 'declined', false), (e: any) => e instanceof GuardianApiError && e.status === 410 && e.code === 'consent_link_unusable');
  });

  it('decide: a network failure is a GuardianApiError with status 0', async () => {
    const g = api(async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(g.decide(TOKEN, 'declined', false), (e: any) => e instanceof GuardianApiError && e.status === 0);
  });

  it('request: goes through the authenticated client with the parent address in the body', async () => {
    let call: any;
    const g = api(async () => res(500, {}), async (path: string, init: any) => { call = { path, init }; return { parentEmailMasked: 'mu***@example.test', emailSent: true, expiresAt: '2026-11-01T00:00:00Z' }; });
    const out = await g.request('mum@example.test');
    assert.equal(call.path, '/auth/guardian-request');
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(JSON.parse(call.init.body), { parentEmail: 'mum@example.test' });
    assert.deepEqual(out, { parentEmailMasked: 'mu***@example.test', emailSent: true, expiresAt: '2026-11-01T00:00:00Z' });
  });
});
```

`guardianConfig.test.ts`:
```ts
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchGuardianConfig, resetGuardianConfigCache } from '../guardianConfig.ts';

describe('fetchGuardianConfig', () => {
  beforeEach(() => resetGuardianConfigCache());

  it('returns what the server says and asks only once', async () => {
    let n = 0;
    const load = async () => { n += 1; return { enabled: true }; };
    assert.deepEqual(await fetchGuardianConfig(load), { enabled: true });
    assert.deepEqual(await fetchGuardianConfig(load), { enabled: true });
    assert.equal(n, 1);
  });

  it('fails off: an error answers enabled:false with failed:true, and is not cached', async () => {
    const bad = async () => { throw new Error('offline'); };
    assert.deepEqual(await fetchGuardianConfig(bad, [0]), { enabled: false, failed: true });
    assert.deepEqual(await fetchGuardianConfig(async () => ({ enabled: true })), { enabled: true });
  });

  it('retries on the delays it is given before giving up', async () => {
    let n = 0;
    const flaky = async () => { n += 1; if (n < 3) throw new Error('x'); return { enabled: true }; };
    assert.deepEqual(await fetchGuardianConfig(flaky, [0, 0]), { enabled: true });
    assert.equal(n, 3);
  });
});
```

- [ ] **Step 2: Run, see them fail** (`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/guardianApi.test.ts services/__tests__/guardianConfig.test.ts`).

- [ ] **Step 3: Write `services/guardianApi.ts`**

```ts
/**
 * Calls for parent approval. The parent's page has no account, so its three calls (config, lookup, decide) go
 * out WITHOUT the app's session and without the refresh-and-sign-out behaviour of `apiFetch`, the same rule
 * `services/studentExam.ts` follows. `request` is the student's own call and uses the authenticated client.
 *
 * Dependencies are injected so `node --test` can load this file: the real ones import `apiClient`, which pulls
 * in secure storage.
 */
import { fetchWithTimeout } from './fetchWithTimeout.ts';

export class GuardianApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'GuardianApiError';
    this.status = status;
    this.code = code;
  }
}

export type ConsentLookup =
  | { status: 'open'; childFirstName: string }
  | { status: 'expired' | 'decided' | 'invalid' };

export type GuardianRequestResult = { parentEmailMasked: string; emailSent: boolean; expiresAt: string | null };

type ApiJson = <T>(path: string, init?: RequestInit) => Promise<T>;

export interface GuardianApiDeps {
  baseUrl: () => Promise<string>;
  fetchImpl?: typeof fetch;
  apiJson?: ApiJson;
}

export function makeGuardianApi(deps: GuardianApiDeps) {
  async function publicCall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${await deps.baseUrl()}${path}`;
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    let res: Response;
    try {
      res = deps.fetchImpl ? await deps.fetchImpl(url, init) : await fetchWithTimeout(url, init);
    } catch {
      throw new GuardianApiError('Network request failed', 0);
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) throw new GuardianApiError(json?.error ?? `HTTP ${res.status}`, res.status, json?.code);
    return json as T;
  }

  return {
    async config(): Promise<{ enabled: boolean }> {
      const body = await publicCall<{ enabled?: unknown } | null>('GET', '/guardian-consent/config');
      return { enabled: body?.enabled === true };
    },

    async lookup(token: string): Promise<ConsentLookup> {
      const body = await publicCall<any>('POST', '/guardian-consent/lookup', { token });
      if (body?.status === 'open' && typeof body.childFirstName === 'string') return { status: 'open', childFirstName: body.childFirstName };
      if (body?.status === 'expired' || body?.status === 'decided') return { status: body.status };
      return { status: 'invalid' };
    },

    async decide(token: string, decision: 'approved' | 'declined', confirmGuardian: boolean): Promise<{ decision: 'approved' | 'declined' }> {
      const body = await publicCall<{ decision: 'approved' | 'declined' }>('POST', '/guardian-consent/decide', { token, decision, confirmGuardian });
      return { decision: body.decision };
    },

    async request(parentEmail: string): Promise<GuardianRequestResult> {
      if (!deps.apiJson) throw new Error('guardianApi.request needs an authenticated client');
      return deps.apiJson<GuardianRequestResult>('/auth/guardian-request', { method: 'POST', body: JSON.stringify({ parentEmail }) });
    },
  };
}

/** The real thing: the lazy imports keep `apiClient` out of what `node --test` loads. */
export const guardianApi = makeGuardianApi({
  baseUrl: async () => (await import('./apiClient')).getApiBaseUrl(),
  apiJson: async (path, init) => (await import('./apiClient')).apiJson(path, init),
});
```
(`fetchWithTimeout.ts` is node-loadable per CLAUDE.md. If `getApiBaseUrl`/`apiJson` names differ, adapt to `apiClient.ts`'s real exports; they are exported there.)

- [ ] **Step 4: Write `services/guardianConfig.ts`** (modelled on `services/features.ts` — read it first and mirror its cache/retry/hook shape):

```ts
/**
 * Whether the server asks a parent to approve email students. The register screen and the three role-switch
 * screens need the answer before anyone is signed in, so it is a public GET. Fail OFF: an unreachable server
 * leaves today's behaviour (the age tick) in place, and the server's own answer to a sign-up settles it.
 */
import { useEffect, useState } from 'react';
import { guardianApi } from './guardianApi';

export type GuardianConfig = { enabled: boolean; failed?: true };

let cached: GuardianConfig | null = null;

export function resetGuardianConfigCache(): void {
  cached = null;
}

const DEFAULT_RETRY_MS = [1000, 3000];

export async function fetchGuardianConfig(
  load: () => Promise<{ enabled: boolean }> = () => guardianApi.config(),
  retryDelaysMs: number[] = DEFAULT_RETRY_MS,
): Promise<GuardianConfig> {
  if (cached) return cached;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const out = await load();
      cached = { enabled: out.enabled === true };
      return cached;
    } catch {
      if (attempt < retryDelaysMs.length) await new Promise(r => setTimeout(r, retryDelaysMs[attempt]));
    }
  }
  return { enabled: false, failed: true };
}

export function useGuardianConfig(): { enabled: boolean; loading: boolean } {
  const [state, setState] = useState<{ enabled: boolean; loading: boolean }>(() => (cached ? { enabled: cached.enabled, loading: false } : { enabled: false, loading: true }));
  useEffect(() => {
    if (cached) return;
    let live = true;
    void fetchGuardianConfig().then(c => { if (live) setState({ enabled: c.enabled, loading: false }); });
    return () => { live = false; };
  }, []);
  return state;
}
```
Note `guardianApi` is imported without `.ts` here (esbuild/Metro) but `guardianConfig.test.ts` loads this file under `node --test`: it needs `import { guardianApi } from './guardianApi.ts';` (explicit extension) and `guardianApi.ts` must itself import with explicit extensions — it does (`./fetchWithTimeout.ts`), and its `await import('./apiClient')` only runs when called. Use the explicit `.ts` in both files; check `tsc` accepts it (other services do the same: see `features.ts` imports) and add `allowImportingTsExtensions` is already on if they do.

- [ ] **Step 5: Run the tests, expect pass; run `pnpm run typecheck` at the repo root.**

- [ ] **Step 6: Commit**
```bash
git add artifacts/mobile/services/guardianApi.ts artifacts/mobile/services/guardianConfig.ts artifacts/mobile/services/__tests__/guardianApi.test.ts artifacts/mobile/services/__tests__/guardianConfig.test.ts
git commit -m "Guardian approval (app): the calls and the config switch"
```

---

### Task 4: Copy, Arabic first

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (an `ar` block and an `en` block, each key in BOTH tables, placed together after `errAgeConfirmRequired` in each table)
- Test: existing `i18n.test.ts` and `i18nTerminology.test.ts` must pass unchanged; add `services/__tests__/guardianCopy.test.ts`

**Interfaces:** Produces the translation keys every later task uses (list below).

- [ ] **Step 1: Add the strings.** Keys (all functions take what is shown). The Arabic is a **draft to be run through the `arabic-copy-reviewer` skill** (Step 3) before commit; the English is final shape.

| Key | ar | en |
| --- | --- | --- |
| `guardianNeededTitle` | نحتاج موافقة أحد والديك | We need a parent's approval |
| `guardianNeededDesc` | حسابك جاهز، لكنه يبقى مغلقًا حتى يوافق عليه أحد والديك. أدخل بريده الإلكتروني وسنرسل له رابط الموافقة. | Your account is ready, but it stays locked until one of your parents approves it. Enter their email and we will send them an approval link. |
| `guardianWaitingTitle` | بانتظار موافقة أحد والديك | Waiting for a parent's approval |
| `guardianWaitingDesc(masked)` | أرسلنا رابط الموافقة إلى ${masked}. عندما يوافق، يُفتح حسابك هنا تلقائيًا. | We sent the approval link to ${masked}. When they approve, your account opens here by itself. |
| `guardianDeclinedTitle` | لم تتم الموافقة على الحساب | The account was not approved |
| `guardianDeclinedDesc` | يمكنك إرسال الطلب إلى بريد آخر لأحد والديك، أو الانضمام إلى صف برمز من معلّمك. | You can send the request to another parent's email, or join a class with a link code from your teacher. |
| `guardianParentEmailLabel` | البريد الإلكتروني لأحد والديك | A parent's email |
| `guardianParentEmailHint` | نرسل إليه رابط الموافقة فقط. | We only use it to send the approval link. |
| `guardianSend` | إرسال الرابط | Send the link |
| `guardianChangeEmail` | تغيير البريد | Use a different email |
| `guardianSentTo(masked)` | تم إرسال الرابط إلى ${masked}. | The link was sent to ${masked}. |
| `guardianSendFailed` | تعذّر إرسال البريد. حاول مرة أخرى بعد قليل. | The email could not be sent. Try again in a moment. |
| `guardianCheckNow` | تحديث الحالة | Check again |
| `guardianJoinWithCode` | لديّ رمز ربط من معلّمي | I have a link code from my teacher |
| `guardianWrongTypeTitle` | اخترت نوع الحساب بالخطأ؟ | Picked the wrong account type? |
| `guardianSwitchToParent` | أنا وليّ أمر | I am a parent |
| `guardianSwitchToTeacher` | أنا معلّم | I am a teacher |
| `guardianSwitchFailed` | تعذّر تغيير نوع الحساب. | The account type could not be changed. |
| `guardianSwitchNote` | سيحتاج حسابك الطالب إلى موافقة أحد والديك قبل أن يُفتح. | Your student account will need a parent's approval before it opens. |
| `registerParentEmailLabel` | البريد الإلكتروني لأحد والديك | A parent's email |
| `registerParentEmailHint` | سنرسل إليه رابطًا ليوافق على حسابك بعد أن تؤكد بريدك. | We will send them a link to approve your account once you have confirmed your own email. |
| `registerParentEmailFirst` | أدخل بريد أحد والديك أولًا. | Enter a parent's email first. |
| `errParentEmailRequired` | أدخل بريد أحد والديك. | Enter a parent's email. |
| `errParentEmailInvalid` | بريد الوالد غير صالح. | That parent email is not valid. |
| `errParentEmailIsOwn` | لا يمكن أن يكون بريد والدك هو بريدك أنت. | A parent's email cannot be your own. |
| `errEmailNotVerifiedYet` | أكّد بريدك الإلكتروني أولًا. | Confirm your own email first. |
| `errGuardianRateLimited` | وصلت إلى حدّ الطلبات لهذا اليوم. حاول غدًا. | You have reached today's limit for requests. Try again tomorrow. |
| `errGuardianApprovalRequired` | حسابك بانتظار موافقة أحد والديك. | Your account is waiting for a parent's approval. |
| `parentConsentTitle` | موافقة على حساب في إقرأ | Approve an account on Iqrra |
| `parentConsentIntro(name)` | طلب ${name} إنشاء حساب طالب في إقرأ، وهو تطبيق تعليمي للمنهاج الأردني. هل توافق؟ | ${name} asked to open a student account on Iqrra, a learning app for the Jordanian curriculum. Do you approve? |
| `parentConsentMeaning` | الموافقة تتيح للطالب استخدام التطبيق للدراسة. | Approving lets the student use the app to study. |
| `parentConsentConfirm` | أؤكد أنني والد هذا الطالب أو الشخص المسؤول عنه | I confirm I am this student's parent or the adult responsible for them |
| `parentConsentConfirmFirst` | أكّد أولًا أنك والد الطالب أو المسؤول عنه. | Confirm first that you are the student's parent or the adult responsible for them. |
| `parentConsentApprove` | أوافق | I approve |
| `parentConsentDecline` | لا أوافق | I do not approve |
| `parentConsentApprovedDone` | شكرًا. تمت الموافقة، وسيُفتح الحساب لصاحبه. | Thank you. Approved. The account will open for its owner. |
| `parentConsentDeclinedDone` | تم تسجيل قرارك. لن يُفتح الحساب. | Your decision is recorded. The account will not open. |
| `parentConsentExpired` | انتهت صلاحية هذا الرابط. اطلب من الطالب إرسال رابط جديد. | This link has expired. Ask the student to send a new one. |
| `parentConsentDecided` | سُجّل قرار على هذا الرابط من قبل. | A decision was already recorded on this link. |
| `parentConsentInvalid` | هذا الرابط لا يعمل. | This link does not work. |
| `parentConsentRetry` | تعذّر الاتصال. حاول مرة أخرى. | Could not connect. Try again. |
| `parentConsentOpenInBrowser` | افتح رابط الموافقة من المتصفح. | Open the approval link in a web browser. |

For `en`, avoid the banned words (`guardian`, `please`, `roster`, `class code`); the table already does. For `ar`, no «اقرأ» (the brand is written «إقرأ» above) and no «اً».

- [ ] **Step 2: Write `services/__tests__/guardianCopy.test.ts`** (a smoke test that every key exists in both languages and the interpolating ones return the argument):

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getT } from '../i18n.ts';

const KEYS = [
  'guardianNeededTitle', 'guardianNeededDesc', 'guardianWaitingTitle', 'guardianDeclinedTitle', 'guardianDeclinedDesc',
  'guardianParentEmailLabel', 'guardianParentEmailHint', 'guardianSend', 'guardianChangeEmail',
  'guardianSendFailed', 'guardianCheckNow', 'guardianJoinWithCode', 'guardianWrongTypeTitle', 'guardianSwitchToParent',
  'guardianSwitchToTeacher', 'guardianSwitchFailed', 'guardianSwitchNote', 'registerParentEmailLabel',
  'registerParentEmailHint', 'registerParentEmailFirst', 'errParentEmailRequired', 'errParentEmailInvalid',
  'errParentEmailIsOwn', 'errEmailNotVerifiedYet', 'errGuardianRateLimited', 'errGuardianApprovalRequired',
  'parentConsentTitle', 'parentConsentMeaning', 'parentConsentConfirm', 'parentConsentConfirmFirst',
  'parentConsentApprove', 'parentConsentDecline', 'parentConsentApprovedDone', 'parentConsentDeclinedDone',
  'parentConsentExpired', 'parentConsentDecided', 'parentConsentInvalid', 'parentConsentRetry', 'parentConsentOpenInBrowser',
] as const;

describe('parent approval copy', () => {
  for (const lang of ['ar', 'en'] as const) {
    const t = getT(lang) as (k: string, ...a: unknown[]) => string;
    it(`${lang}: every key resolves to real text`, () => {
      for (const k of KEYS) {
        const v = t(k);
        assert.ok(v && v !== k, `${lang}:${k}`);
      }
    });
    it(`${lang}: the interpolating strings carry their argument`, () => {
      assert.ok(t('guardianWaitingDesc', 'mu***@example.test').includes('mu***@example.test'));
      assert.ok(t('guardianSentTo', 'mu***@example.test').includes('mu***@example.test'));
      assert.ok(t('parentConsentIntro', 'Sami').includes('Sami'));
    });
  }
  it('the Arabic brand is spelled with hamzat qatʿ, never the verb', () => {
    const ar = getT('ar') as (k: string, ...a: unknown[]) => string;
    const OLD = String.fromCodePoint(0x0627, 0x0642, 0x0631, 0x0623);
    for (const k of ['parentConsentTitle', 'parentConsentIntro']) assert.ok(!ar(k, 'x').includes(OLD), k);
  });
});
```

- [ ] **Step 3: Run `arabic-copy-reviewer` on the Arabic column** (invoke the `anthropic-skills:arabic-copy-reviewer` skill with the Arabic strings and the context "consent screens for parents and a Jordanian-curriculum student app; Modern Standard Arabic, plain and warm, gender-neutral about the child, no tanwīn written as «اً»"). Apply its corrections to `i18n.ts`. Record the reviewer's changes in the commit message body.

- [ ] **Step 4: Run** `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/guardianCopy.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts services/__tests__/apiErrorKey.test.ts`. Expected: PASS (the apiErrorKey keys now exist; if `apiErrorKey.test.ts` cross-checks keys against `i18n`, it must pass).

- [ ] **Step 5: CI brand check locally** — read `.github/workflows/ci.yml` step "Brand is «إقرأ»" and run its `git grep` exactly; expect no match.

- [ ] **Step 6: Commit**
```bash
git add artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/guardianCopy.test.ts
git commit -m "Guardian approval (app): the words, Arabic first"
```

---

### Task 5: Session plumbing — the status in the user, a way to re-read it, and the 403 hook

**Files:**
- Modify: `artifacts/mobile/services/apiClient.ts`, `artifacts/mobile/context/AuthContext.tsx`
- No unit test is possible (React Native imports); verification is `pnpm run typecheck` plus Task 9's browser run. Keep the logic in the pure helpers from Task 1 (`guardianFromApi`, `isGuardianRequiredBody`).

**Interfaces:**
- Produces: `setOnGuardianRequired(cb: () => void)` in `apiClient.ts`; on `User`: `guardianStatus?: GuardianStatus`, `guardianParentEmailMasked?: string`; on the context: `refreshUser(): Promise<void>`; `RegisterData.parentEmail?: string`; `loginWithGoogle(credential, signup?: Pick<RegisterData,'role'|'acceptedTerms'|'ageConfirmed'|'parentEmail'>)`.

- [ ] **Step 1: `apiClient.ts`.** Next to `setOnRefreshFailed`, add:

```ts
let _onGuardianRequired: (() => void) | null = null;

/** Called when an authenticated call is answered 403 `guardian_approval_required`: the server is holding this
 *  student for a parent's approval, so the app should re-read /auth/me and let the gate move them. */
export function setOnGuardianRequired(cb: (() => void) | null) {
  _onGuardianRequired = cb;
}
```
and in `apiFetch`, just before `return res;` at the end of the function:

```ts
  if (res.status === 403 && _onGuardianRequired) {
    // A clone, so the caller can still read the body. Fire and forget: nothing waits on this.
    void res.clone().text().then(text => {
      if (isGuardianRequiredBody(text)) _onGuardianRequired?.();
    }).catch(() => {});
  }
```
with `import { isGuardianRequiredBody } from './guardianApproval';`.

- [ ] **Step 2: `AuthContext.tsx`.**
  1. `import { guardianFromApi, type GuardianStatus } from '@/services/guardianApproval';` and `setOnGuardianRequired` from the apiClient import.
  2. `User` (line ~74-122): add `guardianStatus?: GuardianStatus; guardianParentEmailMasked?: string;`.
  3. `ApiUser` (~288): add `guardianStatus?: string; guardianParentEmailMasked?: string;`.
  4. `toUser` (~296-323): spread `...guardianFromApi(apiUser),` last.
  5. `updateProfile` (~737-752): it rebuilds from the PATCH answer, which does not echo `/me`-only fields. Extend the existing re-add: `{ ...toUser(updated), hasRosterLink: updated.hasRosterLink ?? prev?.hasRosterLink, guardianStatus: toUser(updated).guardianStatus ?? prev?.guardianStatus, guardianParentEmailMasked: toUser(updated).guardianParentEmailMasked ?? prev?.guardianParentEmailMasked }` (write it with one local `const next = toUser(updated)`).
  6. `refreshUser` — add a context method and put it in the context type (~172-215):

```ts
  const refreshUser = useCallback(async () => {
    try {
      const apiUser = await apiJson<ApiUser>('/auth/me');
      setUser(prev => (prev && prev.id !== apiUser.id ? prev : toUser(apiUser)));
    } catch {
      // Offline or signed out: the next call will say so. Keeping the last known user is the safe answer.
    }
  }, []);
```
  (`prev.id` guard: do not overwrite a different account that signed in while this was in flight.)
  7. After `adoptSession` stores tokens and sets the user, kick one refresh for students: at its end add `if (apiUser.role === 'student') void refreshUser();` — the sign-in answers do not carry `guardianStatus`. `adoptSession` is defined before `refreshUser`, so define `refreshUser` above it (order matters for `useCallback` deps).
  8. Register the 403 hook with the existing `setOnRefreshFailed` registration (~379-384): 

```ts
    let lastGuardianRead = 0;
    setOnGuardianRequired(() => {
      const now = Date.now();
      if (now - lastGuardianRead < 5000) return; // a held student's tabs fire several calls at once
      lastGuardianRead = now;
      void refreshUser();
    });
    return () => setOnGuardianRequired(null);
```
  9. `RegisterData` (~143): add `parentEmail?: string;`; `register` (~569-598): add `...(payload.parentEmail ? { parentEmail: payload.parentEmail.trim() } : {}),` to the posted body next to `ageConfirmed`; `loginWithGoogle` (signature ~179 and body ~532-567): extend the `signup` pick with `'parentEmail'` and post `...(signup?.parentEmail ? { parentEmail: signup.parentEmail.trim() } : {})`.
  10. Put `refreshUser` in the value object and the `AuthContextType` interface.

- [ ] **Step 3: Typecheck** — `pnpm run typecheck` at the repo root. Expected clean.

- [ ] **Step 4: Run the whole mobile suite** (`cd artifacts/mobile && pnpm test`; minutes, silent until done). Expected: all pass.

- [ ] **Step 5: Commit**
```bash
git add artifacts/mobile/services/apiClient.ts artifacts/mobile/context/AuthContext.tsx
git commit -m "Guardian approval (app): the status in the session, a way to re-read it, and the 403 hook"
```

---

### Task 6: The gate and the waiting screen

**Files:**
- Create: `artifacts/mobile/app/guardian-waiting.tsx`
- Modify: `artifacts/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `guardianRedirect`, `GUARDIAN_WAITING_ROUTE`, `needsGuardianApproval` (Task 1); `guardianApi.request` (Task 3); `refreshUser`, `logout`, `switchRole` from `useAuth()`; copy keys (Task 4); `usePollingRefresh`.

- [ ] **Step 1: `_layout.tsx`.** Import `guardianRedirect` from `@/services/routeGating` and `shouldTrackScreen` from `@/services/screenTracking`.
  - In the big effect (lines ~53-164), directly after the `isPublicRoute(pathname)` early return and **before** the roster-claim gate, add:

```ts
    // A student the server is holding for a parent's approval goes to the waiting screen from anywhere else,
    // and a student who is no longer held is moved off it. Before the other gates, which would send a held
    // student to screens the server refuses (grade setup saves through a route that is not open to them).
    const guardianTarget = signedIn && user ? guardianRedirect(user, pathname) : null;
    if (guardianTarget) {
      router.replace(guardianTarget as any);
      return;
    }
```
  - Change the tracking effect (line ~168-170) to `useEffect(() => { if (pathname && shouldTrackScreen(pathname)) trackScreen(pathname); }, [pathname]);`.
  - Register the screen next to `claim-required` (line ~235): `<Stack.Screen name="guardian-waiting" options={{ headerShown: false, gestureEnabled: false }} />`.

- [ ] **Step 2: `app/guardian-waiting.tsx`.** Model it on `app/claim-required.tsx` / `components/ClaimWaitingCard.tsx` (read both first for the real `useLanguage`, `useColors` and `Surface` import paths and prop names; fix imports to match — the code below uses the paths seen in `ClaimWaitingCard.tsx`):

```tsx
/**
 * What a student sees while the server holds the account for a parent's approval. Three states from
 * `user.guardianStatus`: needed (no request yet: ask for a parent's email), waiting (a link is out: resend or
 * change the address) and declined (say so, and ask again with another address). The screen re-reads /auth/me
 * every 20 seconds and when the app comes back to the foreground; the root layout moves the student off it
 * the moment the status stops being a held one.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Surface } from '@/components/ui/Surface';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { usePollingRefresh } from '@/hooks/usePollingRefresh';
import { ICON } from '@/constants/icons';
import { SPACE, TYPE } from '@/constants/theme';
import { readableOn } from '@/services/readableColor';
import { apiErrorMessage } from '@/services/apiErrorKey';
import { guardianApi } from '@/services/guardianApi';
import { looksLikeEmail } from '@/services/guardianApproval';

export default function GuardianWaitingScreen() {
  const { t, isRTL } = useLanguage();
  const colors = useColors();
  const router = useRouter();
  const { user, logout, refreshUser, switchRole } = useAuth();

  const status = user?.guardianStatus;
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const poll = useCallback(async () => { await refreshUser(); }, [refreshUser]);
  usePollingRefresh(poll);

  const align = isRTL ? 'right' : 'left';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const masked = user?.guardianParentEmailMasked ?? '';
  const askForEmail = status === 'needed' || status === 'declined' || editing;
  const canSend = looksLikeEmail(email) && !busy;

  async function send(address: string) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const out = await guardianApi.request(address.trim());
      setNote(out.emailSent ? t('guardianSentTo', out.parentEmailMasked) : t('guardianSendFailed'));
      setEditing(false);
      setEmail('');
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, 'guardianSendFailed', t));
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setChecking(true);
    setError('');
    await refreshUser();
    setChecking(false);
  }

  async function leaveAs(role: 'parent' | 'teacher') {
    setBusy(true);
    setError('');
    try {
      await switchRole(role);
      // The role is no longer student, so the layout moves this screen on.
    } catch (e) {
      setError(apiErrorMessage(e, 'guardianSwitchFailed', t));
      setBusy(false);
    }
  }

  const title = status === 'declined' ? t('guardianDeclinedTitle') : status === 'waiting' && !editing ? t('guardianWaitingTitle') : t('guardianNeededTitle');
  const desc =
    status === 'declined' ? t('guardianDeclinedDesc')
    : status === 'waiting' && !editing ? t('guardianWaitingDesc', masked)
    : t('guardianNeededDesc');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Surface style={styles.card}>
        <View style={[styles.head, { flexDirection: rowDir }]}>
          <Ionicons name="time-outline" size={ICON.xl} color={readableOn(colors.primary, colors.card, 3)} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
            {title}
          </Text>
        </View>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{desc}</Text>

        {askForEmail ? (
          <View style={styles.form}>
            <Input
              label={t('guardianParentEmailLabel')}
              hint={t('guardianParentEmailHint')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              isRTL={isRTL}
            />
            <Button label={t('guardianSend')} onPress={() => send(email)} disabled={!canSend} loading={busy} fullWidth style={{ marginTop: SPACE.md }} />
            {editing ? <Button label={t('cancel')} variant="ghost" onPress={() => { setEditing(false); setEmail(''); }} fullWidth style={{ marginTop: SPACE.sm }} /> : null}
          </View>
        ) : (
          // The app holds only the masked address, so "send the same link again" is not offered; the student
          // enters an address (the same one or another) to send again. The server supersedes the old link.
          <Button label={t('guardianChangeEmail')} variant="secondary" onPress={() => setEditing(true)} fullWidth style={{ marginTop: SPACE.lg }} />
        )}

        {note ? <Text accessibilityLiveRegion="polite" style={[styles.desc, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{note}</Text> : null}
        {error ? <Text accessibilityLiveRegion="polite" style={[styles.desc, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text> : null}

        <Button label={t('guardianCheckNow')} variant="ghost" onPress={checkNow} loading={checking} fullWidth style={{ marginTop: SPACE.sm }} />
      </Surface>

      <Surface style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/join-class')} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: readableOn(colors.primary, colors.card, 4.5), fontFamily: 'ReadexPro_500Medium', textAlign: align }]}>
            {t('guardianJoinWithCode')}
          </Text>
        </Pressable>
        <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{t('guardianWrongTypeTitle')}</Text>
        <View style={[styles.switchRow, { flexDirection: rowDir }]}>
          <Button label={t('guardianSwitchToParent')} variant="secondary" size="sm" onPress={() => leaveAs('parent')} disabled={busy} style={{ flex: 1 }} />
          <Button label={t('guardianSwitchToTeacher')} variant="secondary" size="sm" onPress={() => leaveAs('teacher')} disabled={busy} style={{ flex: 1 }} />
        </View>
      </Surface>

      <View style={[styles.exits, { flexDirection: rowDir }]}>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>{t('signOut')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} style={styles.linkRow}>
          <Text style={[styles.linkText, { color: colors.destructive, fontFamily: 'Almarai_400Regular' }]}>{t('deleteAccount')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, paddingTop: SPACE.hero, gap: SPACE.lg },
  card: { padding: SPACE.lg },
  head: { alignItems: 'center', gap: SPACE.md },
  title: { fontSize: TYPE.bodyLg, flex: 1 },
  desc: { fontSize: TYPE.body, lineHeight: 24, marginTop: SPACE.md },
  form: { marginTop: SPACE.lg },
  linkRow: { minHeight: 44, justifyContent: 'center', paddingVertical: SPACE.sm },
  linkText: { fontSize: TYPE.body },
  switchRow: { gap: SPACE.sm, marginTop: SPACE.md },
  exits: { justifyContent: 'space-between', paddingHorizontal: SPACE.sm },
});
```
The implementer adapts imports and prop names to the real components (typecheck finds any mismatch) and keeps every spacing, font and radius value on the `TYPE`/`SPACE`/`RADIUS` scales (`minHeight: 44` is a touch-target size, not on the ratchet's counted properties: confirm with `designScale.test.ts`). `t('cancel')`, `t('signOut')`, `t('deleteAccount')` and `t('retry')` already exist. There is no plain "send the same link again": the app holds only the masked address, and `POST /auth/guardian-request` needs one, so the waiting state offers "use a different email" (the student can type the same address again), which supersedes the old link. State it in the log's limits.


- [ ] **Step 3: Typecheck + full mobile tests** (`pnpm run typecheck` at root; `cd artifacts/mobile && pnpm test`). `designScale.test.ts` must stay green: it fails on any raw numeric font size/radius/padding in the new file.

- [ ] **Step 4: Commit**
```bash
git add artifacts/mobile/app/guardian-waiting.tsx artifacts/mobile/app/_layout.tsx
git commit -m "Guardian approval (app): the gate and the waiting screen"
```

---

### Task 7: The parent's page

**Files:**
- Create: `artifacts/mobile/app/guardian.tsx`

**Interfaces:**
- Consumes: `parseConsentFragment` (Task 2), `guardianApi.lookup/decide` and `GuardianApiError` (Task 3), copy (Task 4). `/guardian` is already public (Task 1) and excluded from analytics (Task 2).

- [ ] **Step 1: Write `app/guardian.tsx`.** It has no account, no navigation chrome and no data except the token. Read `app/take/[code].tsx` and `app/live/index.tsx` for the public-screen look (plain `View`, `colors.background`, `Surface`), then:

```tsx
/**
 * The parent's page: `{origin}/guardian#{token}`. No account. The token is the URL fragment, which a browser
 * never sends to a server; it is read once here, posted in a body to /guardian-consent/lookup and /decide, kept
 * only in this component's memory, and never written to a path, a query, a log or an analytics event (the screen
 * is excluded from tracking in app/_layout.tsx). Approving needs the parent to tick that they are this child's
 * parent or the adult responsible for them; the server enforces that too.
 */
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { CheckRow } from '@/components/ui/CheckRow';
import { Surface } from '@/components/ui/Surface';
import { useLanguage } from '@/context/LanguageContext';
import { useColors } from '@/hooks/useColors';
import { SPACE, TYPE } from '@/constants/theme';
import { GuardianApiError, guardianApi, type ConsentLookup } from '@/services/guardianApi';
import { parseConsentFragment } from '@/services/guardianConsentLink';

type View_ =
  | { kind: 'loading' }
  | { kind: 'browser' }               // native: the link is meant for a browser
  | { kind: 'retry' }                 // could not reach the server
  | { kind: 'lookup'; result: ConsentLookup }
  | { kind: 'done'; decision: 'approved' | 'declined' };

function readToken(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return parseConsentFragment(window.location.hash);
}

export default function GuardianConsentScreen() {
  const { t, lang, isRTL, toggleLang } = useLanguage();
  const colors = useColors();
  const [token] = useState<string | null>(() => readToken());
  const [view, setView] = useState<View_>(() => (Platform.OS === 'web' ? { kind: 'loading' } : { kind: 'browser' }));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');

  async function load() {
    if (!token) { setView({ kind: 'lookup', result: { status: 'invalid' } }); return; }
    setView({ kind: 'loading' });
    try {
      setView({ kind: 'lookup', result: await guardianApi.lookup(token) });
    } catch {
      setView({ kind: 'retry' });
    }
  }

  useEffect(() => { if (Platform.OS === 'web') void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(decision: 'approved' | 'declined') {
    if (!token) return;
    if (decision === 'approved' && !confirmed) { setWarn(t('parentConsentConfirmFirst')); return; }
    setBusy(true);
    setWarn('');
    try {
      const out = await guardianApi.decide(token, decision, confirmed);
      setView({ kind: 'done', decision: out.decision });
    } catch (e) {
      if (e instanceof GuardianApiError && (e.status === 410 || e.status === 404)) await load(); // used, expired or switched off meanwhile
      else if (e instanceof GuardianApiError && e.code === 'guardian_confirmation_required') setWarn(t('parentConsentConfirmFirst'));
      else setWarn(t('parentConsentRetry'));
    } finally {
      setBusy(false);
    }
  }

  const align = isRTL ? 'right' : 'left';
  const text = (extra: object = {}) => [styles.body, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }, extra];

  let content: React.ReactNode;
  if (view.kind === 'loading') content = <Text style={text()}>…</Text>;
  else if (view.kind === 'browser') content = <Text style={text()}>{t('parentConsentOpenInBrowser')}</Text>;
  else if (view.kind === 'retry') content = (
    <>
      <Text style={text()}>{t('parentConsentRetry')}</Text>
      <Button label={t('retry')} onPress={load} fullWidth style={{ marginTop: SPACE.lg }} />
    </>
  );
  else if (view.kind === 'done') content = (
    <Text style={text()} accessibilityLiveRegion="polite">
      {view.decision === 'approved' ? t('parentConsentApprovedDone') : t('parentConsentDeclinedDone')}
    </Text>
  );
  else if (view.result.status === 'open') content = (
    <>
      <Text style={text()}>{t('parentConsentIntro', view.result.childFirstName)}</Text>
      <Text style={text({ color: colors.mutedForeground, marginTop: SPACE.md })}>{t('parentConsentMeaning')}</Text>
      <View style={{ marginTop: SPACE.lg }}>
        <CheckRow checked={confirmed} onPress={() => setConfirmed(c => !c)} isRTL={isRTL} colors={colors}>
          <Text style={[styles.body, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align, flex: 1 }]}>{t('parentConsentConfirm')}</Text>
        </CheckRow>
      </View>
      {warn ? <Text accessibilityLiveRegion="polite" style={text({ color: colors.destructive, marginTop: SPACE.md })}>{warn}</Text> : null}
      <Button label={t('parentConsentApprove')} onPress={() => decide('approved')} loading={busy} fullWidth style={{ marginTop: SPACE.lg }} />
      <Button label={t('parentConsentDecline')} variant="secondary" onPress={() => decide('declined')} disabled={busy} fullWidth style={{ marginTop: SPACE.sm }} />
    </>
  );
  else content = (
    <Text style={text()}>
      {view.result.status === 'expired' ? t('parentConsentExpired') : view.result.status === 'decided' ? t('parentConsentDecided') : t('parentConsentInvalid')}
    </Text>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Surface style={styles.card}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{t('parentConsentTitle')}</Text>
        <View style={{ marginTop: SPACE.md }}>{content}</View>
      </Surface>
      <Button label={lang === 'ar' ? 'English' : 'العربية'} variant="ghost" onPress={toggleLang} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, paddingTop: SPACE.hero, gap: SPACE.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { padding: SPACE.lg },
  title: { fontSize: TYPE.title },
  body: { fontSize: TYPE.body, lineHeight: 24 },
});
```
Implementer checks while adapting: (a) `retry` and `toggleLang` exist (`toggleLang` is in the language context value; `retry` — grep `i18n.ts`, use the real key or `guardianCheckNow`); (b) `maxWidth: 560` is a raw layout number, not a font/radius/padding, and is allowed by the ratchet (it counts only `fontSize`, `borderRadius` and spacing properties) — confirm by running `designScale.test.ts`; (c) the `CheckRow` children must render inside its row (read how `register.tsx` passes its label); (d) on web the page must not depend on `useLocalSearchParams`: `window.location.hash` is read once in the `useState` initialiser.

- [ ] **Step 2: Typecheck + full mobile tests.**

- [ ] **Step 3: Commit**
```bash
git add artifacts/mobile/app/guardian.tsx
git commit -m "Guardian approval (app): the parent's page"
```

---

### Task 8: Sign-up and the three role-switch screens

**Files:**
- Modify: `artifacts/mobile/app/(auth)/register.tsx`, `artifacts/mobile/app/claim-required.tsx`, `artifacts/mobile/app/settings.tsx`, `artifacts/mobile/app/setup-subjects.tsx`

**Interfaces:**
- Consumes: `useGuardianConfig` (Task 3), `looksLikeEmail` (Task 1), `switchNeedsAgeConfirmation(from,to,guardianEnabled)` (Task 1), `register`/`loginWithGoogle` with `parentEmail` (Task 5), copy (Task 4).

- [ ] **Step 1: `register.tsx`.** Add `const guardian = useGuardianConfig();` and `const [parentEmail, setParentEmail] = useState('');`. Replace the `askAge` logic:

```ts
  const studentEmailPath = chosenRole === 'student' && studentMethod === 'email';
  const askParent = studentEmailPath && guardian.enabled;
  const askAge = needsAgeConfirmation(chosenRole, studentMethod) && !guardian.enabled;
  const parentOk = !askParent || looksLikeEmail(parentEmail);
  const readyToSignUp = termsAccepted && (!askAge || ageConfirmed) && parentOk && !(studentEmailPath && guardian.loading);
```
(`readyToSignUp` replaces its current definition at line ~72.) In the form, where the age `CheckRow` is rendered (inside the `agreements` fragment, lines ~182-186), render it only for `askAge`, and add — above the terms row, in the student-email path — for `askParent`:

```tsx
{askParent ? (
  <Input
    label={t('registerParentEmailLabel')}
    hint={t('registerParentEmailHint')}
    value={parentEmail}
    onChangeText={setParentEmail}
    keyboardType="email-address"
    autoCapitalize="none"
    autoComplete="email"
    textContentType="emailAddress"
    isRTL={isRTL}
  />
) : null}
```
Submit payloads: email — add `parentEmail: askParent ? parentEmail.trim() : undefined,` to `register({...})`; Google (`handleGoogleCredential`, lines 74-109) — the early check becomes `if (askAge && !ageConfirmed) → errAgeConfirmRequired; if (askParent && !parentOk) → registerParentEmailFirst`, and `loginWithGoogle(credential, { role, acceptedTerms: true, ageConfirmed: askAge && ageConfirmed, parentEmail: askParent ? parentEmail.trim() : undefined })`. Replace the "tick first" hint strings (`ageConfirmBelow`, `ageConfirmFirst`) so that when `askParent` they show `registerParentEmailFirst` instead of the age text. A sign-up the server refuses with `parent_email_required` (the config said off, the server is on) shows `errParentEmailRequired` through `apiErrorMessage`; on any such error call `resetGuardianConfigCache()` so the next try re-reads the config.

- [ ] **Step 2: the three role-switch screens.** In each, add `const guardian = useGuardianConfig();` and pass it as the third argument: `claim-required.tsx:86` → `switchNeedsAgeConfirmation(role, nextRole, guardian.enabled)`; `settings.tsx:63` → `switchNeedsAgeConfirmation(user?.role, nextRole, guardian.enabled)`; `setup-subjects.tsx` (its student-pending flow around lines 123-130 asks the box before switching): when `guardian.enabled`, skip the box and go straight to `doSwitch('student')`. Where the tick box would have been and the switch is into student with `guardian.enabled`, show a one-line note `t('guardianSwitchNote')` (muted text) so the person knows the new account will wait for a parent. The `ageOk` state and `errAgeConfirmRequired` mapping stay for the flag-off path.

- [ ] **Step 3: `pnpm run typecheck` (root) and `cd artifacts/mobile && pnpm test`.** Expected clean. The e2e's single `getByRole("checkbox")` on the teacher sign-up form must stay unique: teacher and parent sign-ups are untouched.

- [ ] **Step 4: Commit**
```bash
git add "artifacts/mobile/app/(auth)/register.tsx" artifacts/mobile/app/claim-required.tsx artifacts/mobile/app/settings.tsx artifacts/mobile/app/setup-subjects.tsx
git commit -m "Guardian approval (app): the parent's email at sign-up, and no tick on a role switch when a parent approves"
```

---

### Task 9: Check it in a browser, mutation checks, write-up

**Files:**
- Modify: `docs/status-log.md` (new top entry), `STATUS.md` (a Recent-changes line, keep the list at 30, bump the section count, edit the Open bullet), `docs/superpowers/specs/2026-10-24-guardian-approval-design.md` (status line, the `switchNeedsAgeConfirmation` sentence, the resend limit), `.env.example` only if a comment is now untrue.

- [ ] **Step 1: Mutation checks** (Edit tool, rerun the named test, restore, confirm green; record which test caught each):
  1. `routeGating.ts` `needsGuardianApproval`: also hold `'approved'` → `routeGating.test.ts` "holds a student whose status is needed…".
  2. `routeGating.ts`: remove `'/guardian'` from `PUBLIC_ROUTES` → "/guardian is a public route".
  3. `routeGating.ts` `HELD_MAY_OPEN`: add `'/notifications'` → "leaves the waiting screen, joining a class…" or the lookalike test.
  4. `guardianConsentLink.ts`: accept 42 chars (`{42,43}`) → `guardianConsentLink.test.ts`.
  5. `screenTracking.ts`: always `true` → `screenTracking.test.ts`.
  6. `guardianApi.ts` `lookup`: put the token in the URL → "lookup: POSTs the token in the body".
  7. `signupMethod.ts`: ignore `guardianEnabled` → its new test.

- [ ] **Step 2: Full verification** — `pnpm run typecheck` (root); `cd artifacts/mobile && pnpm test`; the api-server suite is untouched by this PR but run `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres REQUIRE_DB_TESTS=true pnpm test` once at the end; the CI brand `git grep` from `.github/workflows/ci.yml`. Note counts.

- [ ] **Step 3: Browser check on the web build** (Chromium is pre-installed; `require('playwright')` works; scripts live in the scratchpad, not in the repo). Set up a throwaway database as in CLAUDE.md "Browser smoke test" (`pg_ctlcluster 16 main start`; migrate; the API started with `STUDENT_ACCOUNTS=true GUARDIAN_APPROVAL=true AI_LIVE_MODE=false RESEND_API_KEY=` on `:8099` and `GUARDIAN_LINK_BASE=http://localhost:8098`; `EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`; serve `dist` with `e2e/serve.mjs` on `:8098`). Drive, in **English and Arabic** (set `localStorage` `@iqra_language`; skip the intro with the keys `e2e/` uses):
  1. Register screen, Student → Email: the parent's-email field is there and the age tick is not; the submit stays disabled until a valid parent address; submit; plant the verification code the way `e2e/helpers/db.ts` does (the API also logs it); verify.
  2. The student lands on `/guardian-waiting` (not the tabs), the masked address is shown; a click on any tab route address (`/notifications`) returns to the waiting screen.
  3. Read the parent link from the API log (`…/guardian#<43 chars>`); open it in a fresh browser context (no session): the page loads the child's first name; Approve without the tick shows the warning; with the tick it shows the thank-you; the same link in a third context says "already decided".
  4. Back in the student's tab: within the poll interval (or "Check again") the screen moves to the tabs.
  5. Decline path with a second student: the waiting screen shows the declined text and the email field again.
  6. The token never appears in: the address bar after load stays `…#token` (expected) but the network log of the page shows the lookup/decide requests with the token only in the **body**; `window.performance` resource URLs contain no token; the PostHog/analytics path is a no-op (no key), so assert instead that `shouldTrackScreen('/guardian')` is false (unit-tested) and read `app/_layout.tsx` once more.
  7. With `GUARDIAN_APPROVAL` unset (restart the API): register Student → Email shows the age tick as today; a role switch in settings shows the tick; sign-up works as on `main`.
  8. RTL: the register field, the waiting screen and the parent page lay out right-to-left in Arabic, with no clipped text, at phone width (390) and desktop width.
  Save screenshots in the scratchpad and describe what each shows; do not claim a step you did not drive.

- [ ] **Step 4: Write-up.** New top entry in `docs/status-log.md`: `## Parent approval for email students — the app (PR B) — 2026-10-24`: what was built, flag-off behaviour unchanged (and how that was checked in the browser), the mutation checks, the browser steps actually run, the counts, and **Not verified / known limits**: Android and iOS were not run (only the web build); the parent page is web-only (no universal links); **resend of the same address is not offered** (the app only holds the masked form; the student re-enters an address to send again); the Arabic copy was reviewed with the skill but not by a native speaker; `constants/legal.ts` still describes the tick; a held student's other screens are redirected, but a held student's background calls (push registration, thread polling) get 403s until the redirect lands; after sign-in the status is read with one extra `/auth/me`; no e2e spec was added (the e2e job runs with `STUDENT_ACCOUNTS=false`). **Owner steps before the flag is turned on:** read the parent-consent wording and update `constants/legal.ts` + bump `LEGAL_VERSION` in the same change; the store declaration; deploy the app (web with the merge; Android by OTA — no native change, `app.json` version untouched); then set `GUARDIAN_APPROVAL=true`. In `STATUS.md`: add the Recent-changes line at the top (drop the oldest, keep 30), bump `The log has N sections` to `grep -c '^## ' docs/status-log.md`, and extend the Open `GUARDIAN_APPROVAL` bullet: both halves are built and off; what remains is the wording, the legal text and the owner's switch. Spec status line: `**Status:** server (PR A) and app (PR B) implemented, flag off.` and amend the *Client* section: `switchNeedsAgeConfirmation` gains a third argument instead of being deleted (the tick is still needed while the flag is off), and the waiting screen has no plain resend.

- [ ] **Step 5: Commit, push, update the PR**
```bash
git add docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-24-guardian-approval-design.md
git commit -m "Guardian approval (app): write-up"
git push -u origin claude/nice-volta-qf1nyt
```
Then rewrite draft PR #1274's title to "Parent approval for email students (flag off)" and its body to cover both halves (What / Before merging / Verified / Not verified), keep it **draft**, and leave the flag unset. Do not merge.
