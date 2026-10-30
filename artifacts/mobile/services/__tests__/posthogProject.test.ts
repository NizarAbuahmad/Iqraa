import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The PostHog project is on the EU cloud (project 326639, created 2026-10-30).
// A project key only works against the cloud it was made on, and
// `analytics.ts` defaults to the US host, so a build that carries the key but
// not the host sends everything to a place the key does not exist — and
// analytics degrades silently, with nothing in the app to say so. Every place
// that bakes in the key must bake in the host beside it.
const KEY = 'phc_scZFQcyzEpr2R7nQ7euVgtqQGwhZAh2fB8jvCBGAxjvv';
const OLD_KEY = 'phc_t7Gd3Z4L7v3zDkPAciXoCvndiVqGfVxzGquEfbJPq9r8';
const EU_HOST = 'https://eu.i.posthog.com';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(join(here, relative), 'utf8');

const WORKFLOWS = [
  '../../../../.github/workflows/deploy.yml', // web
  '../../../../.github/workflows/mobile-update.yml', // OTA
  '../../../../.github/workflows/mobile-build-gradle.yml', // Android build
];

describe('PostHog project key and host travel together', () => {
  for (const file of WORKFLOWS) {
    const name = file.split('/').pop();

    it(`${name} carries the EU project key and the EU host`, () => {
      const text = read(file);
      assert.ok(text.includes(`EXPO_PUBLIC_POSTHOG_API_KEY: ${KEY}`), 'new key');
      assert.ok(text.includes(`EXPO_PUBLIC_POSTHOG_HOST: ${EU_HOST}`), 'EU host');
      assert.ok(!text.includes(OLD_KEY), 'the old US-project key must be gone');
    });
  }

  it('eas.json carries the key and the host in both build profiles', () => {
    const eas = JSON.parse(read('../../eas.json')) as {
      build: Record<string, { env?: Record<string, string> }>;
    };
    for (const profile of ['preview', 'production']) {
      const env = eas.build[profile]?.env ?? {};
      assert.equal(env.EXPO_PUBLIC_POSTHOG_API_KEY, KEY, `${profile} key`);
      assert.equal(env.EXPO_PUBLIC_POSTHOG_HOST, EU_HOST, `${profile} host`);
    }
  });
});
