/**
 * `word/document.xml` out of a packed .docx, read through the zip's central
 * directory — so a test can assert on what Word will lay out without opening
 * the file. (`docxBuild.test.ts` and `ministryPlan.test.ts` carry their own
 * copies of this from before it was shared.)
 */
import { inflateRawSync } from 'node:zlib';

export function documentXmlOf(buf: Buffer): string {
  const xml = zipEntryOf(buf, 'word/document.xml');
  if (xml === undefined) throw new Error('no word/document.xml');
  return xml.toString('utf8');
}

/** Every entry name in a packed .docx. */
export function zipEntryNames(buf: Buffer): string[] {
  const names: string[] = [];
  zipEntryOf(buf, '', names);
  return names;
}

/** One entry's bytes, or undefined. Collects every name into `names` when given. */
export function zipEntryOf(buf: Buffer, wanted: string, names?: string[]): Buffer | undefined {
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(p + 10);
  p = buf.readUInt32LE(p + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    names?.push(name);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 8 ? inflateRawSync(data) : data;
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return undefined;
}
