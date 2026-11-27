/**
 * Which way a picked photo is turned into a data URL, and what happens when
 * the shrinking fails.
 *
 * The platform calls are injected, so this runs under `node --test`. What it
 * pins: a big photo is resized with a single dimension, a small one is not
 * re-encoded, a failed resize falls back to the original rather than losing
 * the photo, and several photos are never in flight at once — that last one is
 * the property phone memory depends on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePickedPhoto,
  encodePickedPhotos,
  type PhotoDeps,
  type PickedPhoto,
} from '../photoEncode.ts';

function fakeDeps(over: Partial<PhotoDeps> = {}) {
  const calls: string[] = [];
  const deps: PhotoDeps = {
    platform: 'native',
    async webDownscale(url, edge) {
      calls.push(`web:${edge}`);
      return `${url}#small`;
    },
    async nativeResize(uri, arg) {
      calls.push(`resize:${uri}:${JSON.stringify(arg)}`);
      return 'SMALL64';
    },
    async readAsBase64(uri) {
      calls.push(`read:${uri}`);
      return 'FULL64';
    },
    ...over,
  };
  return { deps, calls };
}

const photo = (over: Partial<PickedPhoto> = {}): PickedPhoto => ({
  uri: 'file:///a.jpg',
  width: 3024,
  height: 4032,
  mimeType: 'image/jpeg',
  ...over,
});

describe('encodePickedPhoto — native', () => {
  it('resizes a big portrait photo by its height and returns the shrunk JPEG', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo(), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"height":1600}']);
  });

  it('resizes a big landscape photo by its width', async () => {
    const { deps, calls } = fakeDeps();
    await encodePickedPhoto(photo({ width: 4032, height: 3024 }), deps);
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"width":1600}']);
  });

  it('uses the limit it is given', async () => {
    const { deps, calls } = fakeDeps();
    await encodePickedPhoto(photo(), deps, 512);
    assert.deepEqual(calls, ['resize:file:///a.jpg:{"height":512}']);
  });

  it('labels a shrunk PNG as a JPEG — that is what the manipulator wrote', async () => {
    const { deps } = fakeDeps();
    const out = await encodePickedPhoto(photo({ mimeType: 'image/png' }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
  });

  it('reads a photo that is already small as it is, with no re-encode', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 800, height: 600, mimeType: 'image/png' }), deps);
    assert.equal(out, 'data:image/png;base64,FULL64');
    assert.deepEqual(calls, ['read:file:///a.jpg']);
  });

  it('re-encodes a small JPEG with no resize, so its EXIF is dropped', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 800, height: 600 }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
    assert.deepEqual(calls, ['resize:file:///a.jpg:null']);
  });

  it('re-encodes a small HEIC to a JPEG', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 800, height: 600, mimeType: 'image/heic', uri: 'file:///a.heic' }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
    assert.deepEqual(calls, ['resize:file:///a.heic:null']);
  });

  it('re-encodes a photo of unknown size rather than guessing a resize', async () => {
    const { deps, calls } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 0, height: 0 }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
    assert.deepEqual(calls, ['resize:file:///a.jpg:null']);
  });

  it('treats a missing type as a JPEG and re-encodes it', async () => {
    const { deps } = fakeDeps();
    const out = await encodePickedPhoto(photo({ width: 100, height: 100, mimeType: undefined, uri: 'file:///noext' }), deps);
    assert.equal(out, 'data:image/jpeg;base64,SMALL64');
  });

  it('leaves a small GIF, WebP or PNG as it is (animation, transparency)', async () => {
    for (const [mimeType, ext] of [['image/gif', 'gif'], ['image/webp', 'webp'], ['image/png', 'png']] as const) {
      const { deps, calls } = fakeDeps();
      const out = await encodePickedPhoto(photo({ width: 100, height: 100, mimeType, uri: `file:///a.${ext}` }), deps);
      assert.equal(out, `data:${mimeType};base64,FULL64`);
      assert.deepEqual(calls, [`read:file:///a.${ext}`]);
    }
  });

  it('infers the type from the file name when the picker gave none', async () => {
    const { deps, calls } = fakeDeps();
    await encodePickedPhoto(photo({ width: 100, height: 100, mimeType: null, uri: 'file:///a.PNG' }), deps);
    assert.deepEqual(calls, ['read:file:///a.PNG']);
  });

  it('does NOT send the original JPEG/HEIC when the re-encode throws: it carries the GPS', async () => {
    for (const mimeType of ['image/jpeg', 'image/heic']) {
      for (const big of [true, false]) {
        const { deps, calls } = fakeDeps({
          async nativeResize() {
            throw new Error('out of memory');
          },
        });
        const out = await encodePickedPhoto(photo({ mimeType, ...(big ? {} : { width: 100, height: 100 }) }), deps);
        assert.equal(out, null);
        assert.equal(calls.some(c => c.startsWith('read')), false);
      }
    }
  });

  it('does NOT send the original JPEG when the re-encode returns nothing', async () => {
    const { deps, calls } = fakeDeps({ nativeResize: async () => '' });
    assert.equal(await encodePickedPhoto(photo(), deps), null);
    assert.equal(calls.some(c => c.startsWith('read')), false);
  });

  it('still falls back to the original for a big PNG whose resize throws (no camera metadata)', async () => {
    const { deps } = fakeDeps({
      async nativeResize() {
        throw new Error('x');
      },
    });
    const out = await encodePickedPhoto(photo({ mimeType: 'image/png', uri: 'file:///a.png' }), deps);
    assert.equal(out, 'data:image/png;base64,FULL64');
  });

  it('is null when a big PNG cannot be resized or read', async () => {
    const { deps } = fakeDeps({
      async nativeResize() {
        throw new Error('x');
      },
      async readAsBase64() {
        throw new Error('y');
      },
    });
    assert.equal(await encodePickedPhoto(photo({ mimeType: 'image/png' }), deps), null);
  });

  it('is null when the original of a small PNG reads back empty', async () => {
    const { deps } = fakeDeps({ readAsBase64: async () => '' });
    assert.equal(await encodePickedPhoto(photo({ width: 10, height: 10, mimeType: 'image/png' }), deps), null);
  });
});

describe('encodePickedPhoto — web', () => {
  const web = (over: Partial<PhotoDeps> = {}) => fakeDeps({ platform: 'web', ...over });

  it('hands the picker\'s base64 to the canvas path with the limit', async () => {
    const { deps, calls } = web();
    const out = await encodePickedPhoto(photo({ base64: 'ABC', mimeType: 'image/png' }), deps, 512);
    assert.equal(out, 'data:image/png;base64,ABC#small');
    assert.deepEqual(calls, ['web:512']);
  });

  it('is null when the picker returned no base64', async () => {
    const { deps, calls } = web();
    assert.equal(await encodePickedPhoto(photo({ base64: undefined }), deps), null);
    assert.deepEqual(calls, []);
  });

  it('asks the canvas to re-encode a JPEG/HEIC even when small, and not a PNG or GIF', async () => {
    const seen: boolean[] = [];
    const { deps } = web({
      async webDownscale(url, _edge, force) {
        seen.push(!!force);
        return url;
      },
    });
    await encodePickedPhoto(photo({ base64: 'A', mimeType: 'image/jpeg' }), deps);
    await encodePickedPhoto(photo({ base64: 'A', mimeType: 'image/heic' }), deps);
    await encodePickedPhoto(photo({ base64: 'A', mimeType: 'image/png' }), deps);
    await encodePickedPhoto(photo({ base64: 'A', mimeType: 'image/gif' }), deps);
    assert.deepEqual(seen, [true, true, false, false]);
  });

  it('drops a JPEG the canvas could not re-encode, but returns a PNG unshrunk', async () => {
    const { deps } = web({
      webDownscale: async () => {
        throw new Error('decode');
      },
    });
    assert.equal(await encodePickedPhoto(photo({ base64: 'ABC' }), deps), null);
    assert.equal(
      await encodePickedPhoto(photo({ base64: 'ABC', mimeType: 'image/png', uri: 'blob:x' }), deps),
      'data:image/png;base64,ABC',
    );
  });

  it('never touches the native calls', async () => {
    const { deps, calls } = web();
    await encodePickedPhoto(photo({ base64: 'ABC' }), deps);
    assert.equal(calls.some(c => c.startsWith('resize') || c.startsWith('read')), false);
  });
});

describe('encodePickedPhotos', () => {
  it('never has two photos in flight — peak memory is one photo', async () => {
    let inFlight = 0;
    let peak = 0;
    const { deps } = fakeDeps({
      async nativeResize() {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise(resolve => setTimeout(resolve, 5));
        inFlight -= 1;
        return 'SMALL64';
      },
    });
    const assets = Array.from({ length: 6 }, (_, i) => photo({ uri: `file:///${i}.jpg` }));
    const out = await encodePickedPhotos(assets, deps);
    assert.equal(out.length, 6);
    assert.equal(peak, 1);
  });

  it('keeps the order of the photos', async () => {
    const { deps } = fakeDeps({ nativeResize: async uri => uri.slice(-5, -4) });
    const assets = ['a', 'b', 'c'].map(n => photo({ uri: `file:///x${n}.jpg` }));
    assert.deepEqual(await encodePickedPhotos(assets, deps), [
      'data:image/jpeg;base64,a',
      'data:image/jpeg;base64,b',
      'data:image/jpeg;base64,c',
    ]);
  });

  it('leaves out a photo that could not be read and keeps the rest', async () => {
    const { deps } = fakeDeps({
      async nativeResize(uri) {
        if (uri.includes('bad')) throw new Error('x');
        return 'SMALL64';
      },
      async readAsBase64() {
        throw new Error('y');
      },
    });
    const out = await encodePickedPhotos(
      [photo({ uri: 'file:///1.jpg' }), photo({ uri: 'file:///bad.jpg' }), photo({ uri: 'file:///3.jpg' })],
      deps,
    );
    assert.equal(out.length, 2);
  });

  it('is empty for no photos', async () => {
    const { deps } = fakeDeps();
    assert.deepEqual(await encodePickedPhotos([], deps), []);
  });
});
