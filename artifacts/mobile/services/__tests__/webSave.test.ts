import test from 'node:test';
import assert from 'node:assert/strict';
import { isIOSUserAgent } from '../webSave.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36';

test('iPhone is iOS', () => assert.equal(isIOSUserAgent(IPHONE, 'iPhone', 5), true));
test('iPadOS posing as a Mac is iOS (touch screen)', () => assert.equal(isIOSUserAgent(MAC, 'MacIntel', 5), true));
test('a real Mac is not', () => assert.equal(isIOSUserAgent(MAC, 'MacIntel', 0), false));
test('Android is not', () => assert.equal(isIOSUserAgent(ANDROID, 'Linux armv8l', 5), false));
