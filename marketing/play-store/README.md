# Publishing IQRA on Google Play

Everything needed for the Play listing, and the order to do it in.
Written 2026-09-15 against `main` @ `7826c6d`.

---

## The shape of this release

The developer account is a **personal** account, so Google's rule applies:
before production access is granted, the app must run a **closed test with at
least 12 testers opted in for 14 continuous days**. Internal testing does not
count toward it, and the 14 days restart if opted-in testers drop below 12.

And before any of that, the account itself must be verified. As of 2026-09-15
the console still shows *"To publish apps, finish setting up your developer
account"* — **identity documents approved by Google first, and only then the
contact phone number** (the phone step is explicitly gated on the identity
step; the *Verify* button stays greyed out until the documents clear).

So "publish on Google Play" is really three dates:

| | |
| --- | --- |
| **Now** | Developer account verification — upload ID, wait for Google's approval, then verify the phone. Days, not minutes, and nothing else can ship until it clears. |
| **Day 0** | App created in Play Console, listing filled, `.aab` on the **closed testing** track, 12 testers opted in |
| **Day 14+** | Apply for production access, Google reviews (days, not hours), then publish |

Nothing below shortens that clock. What it does is make sure day 0 actually
starts — an incomplete listing or a failing signup means the clock never began.

---

## Build

Production app bundle — **finished 2026-09-15 16:56**:

- Build `12b323fa-7044-4c4c-b5dd-ece30f6ac347` — profile `production`,
  distribution `store`, `.aab`, **versionCode 2**, version `1.0.0`
- Download: <https://expo.dev/artifacts/eas/SGGICAW6EvgMdYo_9UEVR6qcpArRMLsW-oucU6B9uE4.aab>
- Build page: <https://expo.dev/accounts/nizar.62/projects/mobile/builds/12b323fa-7044-4c4c-b5dd-ece30f6ac347>
- Signed with the existing EAS keystore (`Keystore name6.09`), the rotated one
  from 2026-09-06.

Rebuild from a clean worktree of `main` with `node_modules` installed:

```bash
pnpm install --filter "./artifacts/mobile..." --prefer-offline
```

```bash
cd artifacts/mobile && npx eas-cli@latest build --platform android --profile production
```

The project archive is now **657 MB** (it was 416 MB in September) and upload
alone takes ~5 minutes. `.easignore` is already tuned — `knowledge-base/` must
stay in, Metro static-requires those PNGs.

This build also **created the `production` EAS Update channel and branch**, which
did not exist before. Until something publishes to it, the store binary only
ever runs the JS it shipped with. See "After the first release" below.

---

## Blockers to clear before day 0

These are not paperwork. Each one either stops the upload or wastes the 14-day
clock.

### 0. Check the name collision on Play itself

`iqraa-web.pages.dev` is another company's Qur'an app (see "Privacy policy URL"
below), and it ships on Google Play under the name *Iqraa*. Search the store
for your title before you commit to it — Play rejects listings likely to be
confused with an existing app. `IQRA — مساعد المعلّم الذكي` is distinct enough
to be defensible, but know what you are sitting next to.

### 1. `privacy@iqraa.app` is a placeholder

`artifacts/mobile/constants/legal.ts` says so in its own comment. Play requires
a contact email on the listing, a reviewer may write to it, and a data-subject
request has a statutory clock. It must be a real, monitored mailbox before the
listing is submitted — and note the `iqraa.app` domain is not one of the two
domains the project actually holds (`iqrra.com`, the `pages.dev` app host).

### 2. Confirm a verification email actually lands in an inbox

The infrastructure blocker is gone — `iqrra.com` was verified at Resend on
2026-09-15, `RESEND_FROM_EMAIL` is `Iqraa <noreply@iqrra.com>`, production is
un-pinned on `latestRevision`, and `auth/verify-email` answers 400 rather than
404. What has **not** been proven is delivery: nobody has watched a real
verification email arrive.

Twelve testers all hit registration on day one, so **register one real account
end to end before inviting anyone**, and check the spam folder — a brand-new
sending domain lands there often.

### 3. Google Sign-In will break on the first Play install unless a third fingerprint is added

`google-services.json` carries two Android OAuth clients today. Play App
Signing re-signs the uploaded bundle with **Google's own key**, whose SHA-1 is
different from both. Google Sign-In matches on package name + signing
fingerprint, so every Play-installed copy fails to sign in until you:

1. Upload the `.aab`, then open Play Console → **Test and release → Setup → App
   signing**, and copy the **app signing key SHA-1**.
2. Add it as a new Android OAuth client fingerprint in the Google Cloud /
   Firebase project for `com.iqra.teachingassistant`.
3. Re-download `google-services.json`, commit it, and **rebuild** — it is baked
   into the binary.

This has already bitten once, silently, when the keystore rotated on
2026-09-06. Budget a second build for it.

### 4. The media library 503s in production

`lesson_media` exists on dev only, so the library renders empty rather than
broken. Decide whether to push the schema (Neon console — `run push` targets
localhost) or accept it for the closed test.

---

## Play Console, in order

1. **Create the app** — default language **Arabic (ar)**, app name from
   `listing-ar.md`, free, "App" not "Game".
2. **Store listing** — copy from `listing-ar.md`, then add `en-US` from
   `listing-en.md`.
   - Icon: `play-icon-512.png` (512×512)
   - Feature graphic: `play-feature-graphic-1024x500.png` (1024×500)
   - Phone screenshots: **2–8 required**, 16:9 or 9:16, min 320px — these must
     be real screenshots of the running app; see "Screenshots" below.
3. **App content** — privacy policy URL, data safety, content rating, target
   audience, ads declaration, government-app declaration (no), data deletion
   URL. Answers below.
4. **Upload the `.aab`** to **Closed testing** (not internal — internal doesn't
   count toward the 14 days). The first upload has to be done by hand in the
   console; `eas submit` takes over afterwards.
5. **Add 12+ testers** by email list, and confirm each one actually opts in via
   the opt-in URL. The count Google checks is opted-in testers, not invitees.
6. **Wait 14 continuous days**, then apply for production access.

### Privacy policy URL

```
https://app.iqrra.com/legal/privacy
```

Own domain, renders the Arabic policy signed out — verified 2026-09-15. Terms
are at `/legal/terms`. The Pages origin `https://iqraa-web-buq.pages.dev` works
too and is the fallback if the CNAME ever lapses.

**Never `iqraa-web.pages.dev`.** The workflow deploys to a Pages project named
`iqraa-web`, but that subdomain was already taken, so Cloudflare appended a
suffix. The bare host serves *a different company's Qur'an reading app* —
pasting it into the listing would point a Play reviewer at someone else's
product.

### Data deletion URL

Use the **privacy policy URL** here too. Its §6 («مدّة الحفظ والحذف»)
documents the in-app path, states deletion is immediate and irreversible, lists
exactly what a teacher/parent/student deletion removes, and gives a contact
address — which is what Play's data-deletion requirement asks for.

Do **not** point it at `/delete-account`: that route is auth-gated and a
signed-out visitor is bounced to onboarding, so a reviewer would see nothing
(verified 2026-09-15). The in-app path itself is fine and properly implemented
(`app/delete-account.tsx` — password or email re-entry as proof of identity).

---

## Data safety form

Audited against `lib/db/src/schema`, `services/pushTokens.ts`,
`services/analytics.ts` and the `production` profile in `eas.json`.

**Encryption in transit:** Yes. **Users can request deletion:** Yes.

| Data type | Collected | Shared | Required | Purpose |
| --- | --- | --- | --- | --- |
| Name (first, last) | Yes | No | Required | Account management |
| Email address | Yes | No | Required | Account management, verification |
| User IDs | Yes | No | Required | Account management |
| Photos | Yes | No | Optional | App functionality (message and lesson attachments) |
| In-app messages | Yes | No | Optional | App functionality (teacher ↔ parent/student threads) |
| Other user-generated content | Yes | No | Optional | App functionality (lesson plans, quizzes, evaluations, student names on a roster) |
| Device or other IDs | Yes | No | Optional | App functionality (Expo push token, for notifications) |

**Not collected** — do not tick these: location, financial info, health,
contacts, calendar, SMS, call logs, app activity/analytics, crash logs,
advertising ID, purchase history, browsing history.

Two notes on that last line:

- **Analytics is off in the store build.** PostHog is wired up but
  `EXPO_PUBLIC_POSTHOG_API_KEY` is absent from the `production` profile in
  `eas.json`, and `services/analytics.ts` degrades to a silent no-op without
  it. **If that key is ever added to the production profile, this form is
  wrong** and must be updated in the same change — add "App interactions" and
  "Analytics" as a purpose.
- Student names entered by a teacher count as collected data about a person,
  which is why "Other UGC" is ticked.

---

## Content rating and target audience

Fill the IARC questionnaire honestly: no violence, no sexual content, no
profanity, no gambling, no user-location sharing. The one question that matters
is **"Does the app allow users to interact or exchange content?"** — **yes**, it
does: messaging threads between teachers, parents and students. Expect
**Teen / PEGI 12** or similar, not "Everyone".

### The decision you have to make: target age groups

This is the highest-risk answer on the whole form, so make it deliberately.

Students hold accounts in production (`STUDENT_ACCOUNTS=true` since
2026-09-07), the curriculum covers grades 6–10, and **a grade 6 student is
11 years old**. If any age group under 13 is selected in "Target audience and
content", **Google Play's Families policy applies in full**: certified ad SDKs
only (there are none, which helps), a families-specific privacy policy, and a
much stricter review.

The two defensible positions:

- **Teachers only (18+).** Honest only if the listing, the screenshots and the
  app itself present it as a teacher tool — which the current listing copy
  does. The student role then has to be framed as something a school enrols
  into, not something a child finds on Play. Google can and does check whether
  the app "appeals to children" regardless of what you select.
- **Mixed audience including under-13.** Truthful about the student role, and
  triggers the Families programme.

The code already supports the first position better than most apps would: there
is no birthdate field by design, `RosterConsentGate` blocks student data until
the teacher confirms the school holds parental consent, and the consent version
and timestamp are recorded on the user row (`rosterConsentAt`,
`rosterConsentVersion`).

**This one is worth asking a lawyer, not an agent.** Getting it wrong is a
policy strike, not a rejected form.

---

## Screenshots

Play requires 2–8 real phone screenshots. They must show the actual app —
mockups and rendered marketing frames are a listing-policy violation.

Nothing here can produce them without signing in, and I won't type credentials
into a login form. Two ways to get them:

- **From the device.** Install the preview APK, sign in, and capture: home, a
  generated lesson plan, a quiz with its answer key, the curriculum browser,
  the slides view, a class roster. Portrait, 1080×1920.
- **From the web build.** Sign in yourself at the web app in the browser pane
  at a 1080×1920 viewport, and the rest — navigation, capture, cropping — can
  be driven from here.

Suggested six, in listing order: **generated lesson plan → quiz with answer key
→ lesson slides → curriculum browser → class roster → iQra chat**. Lead with
output, not with a menu.

---

## `eas submit`

`artifacts/mobile/eas.json` is now wired:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "../../secrets/play-service-account.json",
      "track": "internal",
      "releaseStatus": "draft",
      "changesNotSentForReview": false
    }
  }
}
```

To make it work:

1. Play Console → **Setup → API access** → link a Google Cloud project, create
   a service account, grant it **Release manager** (or at least "Release to
   testing tracks").
2. Download its JSON key to `secrets/play-service-account.json` at the repo
   root. `*-service-account*.json` is already in `.gitignore`, so it will not
   be committed — check `git status` once anyway.
3. `cd artifacts/mobile && npx eas-cli@latest submit --platform android --latest`

`track` is `internal` because that is the safe default for a smoke test.
**Change it to `alpha` for the closed-testing release that starts the 14-day
clock** — `internal` uploads do not count. `releaseStatus: "draft"` means
nothing goes live without a human pressing the button in the console.

---

## After the first release

- **Publish an OTA update to the `production` branch.** The store binary rides
  channel `production`, and `.github/workflows/mobile-update.yml` publishes to
  `preview` on every merge to `main`. Until someone runs it with
  `branch: production` (workflow dispatch), store users get nothing between
  builds. Decide whether production should auto-publish or stay manual.
- **`app.json`'s `version` is the OTA compatibility key.** It is `1.0.0` and
  nothing bumps it automatically — `appVersionSource: remote` moves
  `versionCode` only. Any native change (a new `expo-*` package, a config
  plugin) needs `version` bumped in the same change, or the next OTA ships JS
  into a binary that cannot run it and crashes until reinstall.
- **A figure added after a build cannot reach a device over the air.** The
  1290 figure PNGs are excluded from updates by `assetPatternsToBeBundled`. A
  new grade's figures ride a rebuild.
