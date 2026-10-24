/**
 * The real file system under the phone's English clips: `expo-file-system`'s
 * `File` / `Directory` / `Paths` API (the one `exportPptx.ts` and `share.ts`
 * use, already in the binary — no new native module, so this ships over the air).
 *
 * Deliberately thin: what to keep, what to delete and when is decided in
 * `audioCache.ts` and tested there with a fake. This file only maps `FsLike` onto
 * `Paths.cache`. It imports `expo-file-system`, so `node --test` cannot load it.
 *
 * Native only — `englishAudio.ts` never reaches it on the web.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { createAudioCache, type AudioCache, type FsEntry, type FsLike, type FsPath } from './audioCache.ts';

const file = (path: FsPath) => new File(Paths.cache, ...path);
const dir = (path: FsPath) => new Directory(Paths.cache, ...path);

export const expoFs: FsLike = {
  listDir(path) {
    const d = dir(path);
    if (!d.exists) return [];
    return d.list().map((e): FsEntry =>
      e instanceof File
        ? { name: e.name, isDir: false, size: e.size ?? 0, mtime: e.modificationTime ?? 0 }
        : { name: e.name, isDir: true, size: 0, mtime: 0 },
    );
  },
  ensureDir(path) {
    const d = dir(path);
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
  },
  exists: path => file(path).exists,
  size: path => file(path).size ?? 0,
  uri: path => file(path).uri,
  remove(path) {
    const f = file(path);
    if (f.exists) {
      f.delete();
      return;
    }
    const d = dir(path);
    if (d.exists) d.delete();
  },
  move(from, to) {
    file(from).move(file(to));
  },
  async download(url, to) {
    // Into the temp name `audioCache.ts` chose; a non-2xx rejects with the status in its message.
    await File.downloadFileAsync(url, file(to), { idempotent: true });
  },
};

let shared: AudioCache | null = null;

/** The one cache for the session, built on first use. */
export function englishAudioCache(urlFor: (slug: string) => string): AudioCache {
  if (!shared) shared = createAudioCache({ fs: expoFs, urlFor });
  return shared;
}
