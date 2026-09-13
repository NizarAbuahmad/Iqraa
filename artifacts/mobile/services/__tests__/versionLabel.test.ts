import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { versionLabel } from '../versionLabel.ts';

describe('versionLabel', () => {
  it('says "embedded" when the device is running the bundled JS', () => {
    // The case the whole feature exists to distinguish. Reporting an update id
    // here — or reporting "embedded" when an update HAS been applied — makes
    // the label worse than absent, because it would be confidently wrong.
    assert.equal(
      versionLabel({ appVersion: '1.0.0', updateId: null, channel: 'preview' }),
      '1.0.0 · preview · embedded',
    );
  });

  it('shortens an update id to something comparable by eye', () => {
    assert.equal(
      versionLabel({ appVersion: '1.0.0', updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', channel: 'production' }),
      '1.0.0 · production · a1b2c3d4',
    );
  });

  it('drops fields that are absent rather than printing "undefined"', () => {
    // Updates.channel is undefined in Expo Go and development builds, and
    // Constants.expoConfig can be null — both reach this function in practice.
    assert.equal(versionLabel({ appVersion: null, updateId: null }), 'embedded');
    assert.equal(versionLabel({ appVersion: '1.0.0', updateId: undefined }), '1.0.0 · embedded');
  });
});
