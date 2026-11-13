import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOCIAL_LINKS,
  SOCIAL_PLATFORMS,
  socialLinkLabel,
  socialLinkProblem,
  type SocialPlatform,
} from '../socialLinks.ts';

const require = createRequire(import.meta.url);
const glyphMap = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json') as Record<string, number>;

test('every shipped link is https and points at its own platform', () => {
  for (const link of SOCIAL_LINKS) {
    assert.equal(socialLinkProblem(link), null, `${link.platform}: ${link.url}`);
  }
});

test('one link per platform, so the row never shows the same logo twice', () => {
  const seen = SOCIAL_LINKS.map(l => l.platform);
  assert.equal(new Set(seen).size, seen.length);
});

test('a link to another site under a platform icon is refused', () => {
  assert.match(socialLinkProblem({ platform: 'instagram', url: 'https://instagram.com.evil.example/iqrra' })!, /not instagram/);
  assert.match(socialLinkProblem({ platform: 'tiktok', url: 'https://www.instagram.com/iqrra' })!, /not tiktok/);
  assert.match(socialLinkProblem({ platform: 'facebook', url: 'http://facebook.com/iqrra' })!, /not https/);
  assert.match(socialLinkProblem({ platform: 'youtube', url: 'youtube.com/@iqrra' })!, /not a URL/);
  assert.equal(socialLinkProblem({ platform: 'x', url: 'https://x.com/iqrra' }), null);
  assert.equal(socialLinkProblem({ platform: 'whatsapp', url: 'https://whatsapp.com/channel/abc' }), null);
});

test('every platform icon exists in Ionicons', () => {
  for (const [platform, info] of Object.entries(SOCIAL_PLATFORMS)) {
    assert.ok(info.icon in glyphMap, `${platform}: ${info.icon}`);
  }
});

test('the screen-reader label names the brand and the platform in each language', () => {
  for (const platform of Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[]) {
    const ar = socialLinkLabel(platform, 'ar');
    const en = socialLinkLabel(platform, 'en');
    assert.ok(ar.includes('«إقرأ»') && ar.includes(SOCIAL_PLATFORMS[platform].name.ar), ar);
    assert.ok(en.includes('Iqrra') && en.includes(SOCIAL_PLATFORMS[platform].name.en), en);
  }
});

test('Profile draws the row from SOCIAL_LINKS and opens links outside the app', () => {
  const src = readFileSync(join(import.meta.dirname, '..', '..', 'app', '(tabs)', 'profile.tsx'), 'utf8');
  assert.match(src, /SOCIAL_LINKS/);
  assert.match(src, /openExternal\(/);
  // Linking.openURL replaces the running web app in the same tab (services/externalLinks.ts).
  assert.doesNotMatch(src, /Linking\.openURL/);
});
