import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * react-native-web 0.21 never reads `accessibilityState`: only `aria-*` props
 * reach the DOM (modules/createDOMProps). Every checkbox, tab and chip that
 * declared its state that way read as unticked/unselected to a screen reader
 * on the web build — the sign-up terms box included. React Native itself
 * reads the `aria-*` props too, so they are the one spelling that works on
 * both. This keeps the old spelling from creeping back.
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('accessibility state', () => {
  it('is declared with aria-* props, which the web build reads', () => {
    const root = join(import.meta.dirname, '..', '..');
    const offenders = ['app', 'components']
      .flatMap(dir => tsxFiles(join(root, dir)))
      .filter(file => readFileSync(file, 'utf8').includes('accessibilityState='));
    assert.deepEqual(offenders, []);
  });
});
