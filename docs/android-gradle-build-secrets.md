# One-time setup for the free Gradle Android build

`.github/workflows/mobile-build-gradle.yml` builds the Android APK on GitHub
Actions directly — no EAS Build, no monthly quota. It needs four repository
secrets that nothing can create automatically: they come from the project's
existing signing keystore, which lives only on Expo's servers, and no
GitHub API token available to an automated session is allowed to write
repository secrets (that needs an admin-scoped personal access token). This
is a one-time step for whoever has both.

**Do this from a machine already logged in to `eas-cli` as `nizar.62`** (the
account every existing build was made under) and with `gh` (the GitHub CLI)
authenticated against this repo.

## Why it must be the existing keystore, not a new one

Generating a fresh keystore would be easier, but it would break Google
Sign-In the same way STATUS.md's "signing key changed on 2026-09-07" entry
describes: the Android OAuth client is bound to a *signing certificate*, and
a new keystore means a new certificate. It would also make every APK from
this workflow un-installable over an existing EAS-built install
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Exporting the real keystore keeps
both build paths — this one and the existing EAS Build workflow — signing
identically.

## Steps

1. Export the keystore EAS already holds:

   ```bash
   cd artifacts/mobile
   eas credentials -p android
   ```

   Choose **Keystore** → **Download existing keystore**. This writes a
   `.jks`/`.keystore` file to your machine and prints its **store password**,
   **key alias**, and **key password** — copy all three down now, they are
   not shown again without re-running this command.

2. Base64-encode the keystore file (the exact command differs by OS):

   ```bash
   # macOS
   base64 -i path/to/the-keystore.jks | tr -d '\n' > keystore.b64
   # Linux
   base64 -w0 path/to/the-keystore.jks > keystore.b64
   ```

3. Set the four repository secrets:

   ```bash
   gh secret set ANDROID_KEYSTORE_BASE64 --repo NizarAbuahmad/Iqraa < keystore.b64
   gh secret set ANDROID_KEYSTORE_PASSWORD --repo NizarAbuahmad/Iqraa   # paste the store password when prompted
   gh secret set ANDROID_KEY_ALIAS --repo NizarAbuahmad/Iqraa          # paste the key alias when prompted
   gh secret set ANDROID_KEY_PASSWORD --repo NizarAbuahmad/Iqraa       # paste the key password when prompted
   ```

   (Or Settings → Secrets and variables → Actions → New repository secret,
   for each of the four, if you'd rather use the GitHub UI.)

4. Delete `keystore.b64` and the decoded keystore file from your machine —
   they're in GitHub Secrets now, which is the only copy this workflow needs.

5. `EXPO_TOKEN` must already exist as a repository secret — it does; it's
   what `mobile-update.yml`'s OTA publishes have been using since
   2026-09-12. This workflow reuses it only to read (never write) the
   current Android `versionCode`, and to best-effort report the new one back
   — see the workflow file's header comment for why that report step can't
   be made fully reliable from CI.

## After this is done

Actions → **Mobile Android build (Gradle, no EAS Build)** → *Run workflow*.
No profile or branch choice needed — it always builds the `preview` channel,
matching every existing APK. Both an APK and an AAB come out of the same run,
each attached as its own downloadable artifact (not a public URL like EAS's —
you need to be signed in to GitHub with access to this repo to download
them): `iqraa-android-preview-N` (the `.apk`, for sideloading or sharing a
direct install link) and `iqraa-android-preview-aab-N` (the `.aab` — this is
the one Google Play actually accepts for a production/testing track release;
see `docs/deploying.md`).

Until these secrets exist, the workflow runs, prints what's missing, and
exits cleanly without attempting a build.
