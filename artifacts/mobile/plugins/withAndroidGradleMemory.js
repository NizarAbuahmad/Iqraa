// Raises the JVM memory limits `expo prebuild` ships in
// android/gradle.properties, for the free GitHub Actions build path in
// .github/workflows/mobile-build-gradle.yml.
//
// First real run of that workflow (2026-09-20, run 35504077233) died on
// `:expo-updates:kspReleaseKotlin` with `java.lang.OutOfMemoryError: Metaspace`
// about 12 minutes in — Kotlin Symbol Processing across this many native
// modules (react-native-svg, expo-dev-launcher, expo-updates, ...) exceeded
// the template's default `-XX:MaxMetaspaceSize=512m`. Worse, the JVM didn't
// exit cleanly after that: it kept throwing the same OutOfMemoryError from an
// idle RMI thread once a minute for the next 70+ minutes, so the job never
// reached "BUILD FAILED" — it just sat there until the 90-minute job timeout
// force-cancelled it. Giving Gradle and the Kotlin daemon real headroom (the
// runner has 16GB) is the actual fix; the workflow's `timeout` wrapper around
// `gradlew` is the backstop for "still not enough" not turning into another
// 90-minute silent hang.
//
// Import from `expo/config-plugins`, NOT `@expo/config-plugins` — see
// withAndroidReleaseSigning.js's header comment for why the direct import
// cannot resolve under this monorepo's pnpm install.
const { withGradleProperties } = require('expo/config-plugins');

const MEMORY_PROPERTIES = {
  'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1536m',
  'kotlin.daemon.jvmargs': '-Xmx3072m -XX:MaxMetaspaceSize=1024m',
};

function withAndroidGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key in MEMORY_PROPERTIES)
    );
    for (const [key, value] of Object.entries(MEMORY_PROPERTIES)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
}

module.exports = withAndroidGradleMemory;
