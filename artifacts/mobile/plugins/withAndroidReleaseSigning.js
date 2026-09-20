// Lets a plain `expo prebuild` + `./gradlew assembleRelease` produce a
// properly signed release APK, for the free GitHub Actions build path in
// .github/workflows/mobile-build-gradle.yml.
//
// The template `android/app/build.gradle` that `expo prebuild` generates signs
// the `release` build type with the DEBUG keystore ("Caution! In production,
// you need to generate your own keystore file." — its own comment). That is
// fine for `eas build`, which patches signing in on its own remote servers
// after prebuild runs. It is not fine for a build that never goes through EAS
// at all, which is exactly what mobile-build-gradle.yml does to stay free.
//
// This plugin is a no-op unless ANDROID_RELEASE_STORE_FILE is set in the
// environment `expo prebuild` runs in — so it changes nothing for `eas build`
// (which never sets that variable), for `expo run:android`, or for any other
// existing path. When it IS set, it adds a `signingConfigs.release` block that
// reads the keystore path and passwords from the environment at *Gradle* build
// time (`System.getenv(...)` inside build.gradle), not at prebuild time — so
// the actual secret values never pass through this plugin or get written to
// any generated file. Only the keystore *path* needs to already exist on disk
// when Gradle runs.
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// added by withAndroidReleaseSigning';

function withAndroidReleaseSigning(config) {
  if (!process.env.ANDROID_RELEASE_STORE_FILE) {
    return config;
  }
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withAndroidReleaseSigning only supports the Groovy android/app/build.gradle Expo generates; got ' +
          config.modResults.language
      );
    }
    let contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }

    // Order matters: repoint buildTypes.release's signingConfig *before*
    // inserting our own new "release {" block below. The Expo template has
    // exactly one "release {" at this point (buildTypes.release — the only
    // signingConfigs sub-block it ships is "debug {"), so a lazy multi-line
    // match from there to the next "signingConfig signingConfigs.debug" is
    // unambiguous. A comment sits between the two in the real template
    // ("Caution! In production, you need to generate your own keystore
    // file."), which is why this can't be a same-line match.
    const withReleaseBuildTypeRepointed = contents.replace(
      /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/,
      (_match, between) => `release {${between}signingConfig signingConfigs.release`
    );
    if (withReleaseBuildTypeRepointed === contents) {
      throw new Error(
        'withAndroidReleaseSigning could not find the release buildType\'s "signingConfig signingConfigs.debug" line to repoint — the Expo prebuild template changed shape.'
      );
    }
    contents = withReleaseBuildTypeRepointed;

    const releaseSigningConfigBlock = `        release { ${MARKER}
            storeFile file(System.getenv("ANDROID_RELEASE_STORE_FILE"))
            storePassword System.getenv("ANDROID_RELEASE_STORE_PASSWORD")
            keyAlias System.getenv("ANDROID_RELEASE_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
        }
`;
    const withReleaseSigningConfig = contents.replace(
      /(signingConfigs\s*\{\n)/,
      `$1${releaseSigningConfigBlock}`
    );
    if (withReleaseSigningConfig === contents) {
      throw new Error(
        'withAndroidReleaseSigning could not find "signingConfigs {" in android/app/build.gradle — the Expo prebuild template changed shape.'
      );
    }
    contents = withReleaseSigningConfig;

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAndroidReleaseSigning;
