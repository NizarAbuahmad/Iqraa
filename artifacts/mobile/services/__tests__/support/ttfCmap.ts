/**
 * The code points a TrueType/OpenType font has a glyph for, read from its `cmap`
 * table. Formats 4 and 12 cover every font this app loads; any other format is
 * skipped, and a font with neither throws rather than reporting "nothing".
 * Test-only: it exists so a missing glyph fails a test instead of silently
 * falling back to a system font on a student's phone.
 */
export function fontCodePoints(buf: Uint8Array): Set<number> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => view.getUint16(o);
  const i16 = (o: number) => view.getInt16(o);
  const u32 = (o: number) => view.getUint32(o);

  // An OpenType collection (.ttc) starts with 'ttcf'; none of our fonts is one.
  if (u32(0) === 0x74746366) throw new Error('font collections are not supported');

  let cmapOffset = -1;
  const tables = u16(4);
  for (let i = 0; i < tables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(buf[rec]!, buf[rec + 1]!, buf[rec + 2]!, buf[rec + 3]!);
    if (tag === 'cmap') cmapOffset = u32(rec + 8);
  }
  if (cmapOffset < 0) throw new Error('the font has no cmap table');

  const out = new Set<number>();
  let read = 0;
  const subtables = u16(cmapOffset + 2);
  for (let i = 0; i < subtables; i++) {
    const base = cmapOffset + u32(cmapOffset + 4 + i * 8 + 4);
    const format = u16(base);
    if (format === 4) {
      const segCount = u16(base + 6) / 2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(base + 14 + 2 * s);
        const start = u16(base + 16 + 2 * segCount + 2 * s);
        const delta = i16(base + 16 + 4 * segCount + 2 * s);
        const rangePos = base + 16 + 6 * segCount + 2 * s;
        const range = u16(rangePos);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (range === 0) glyph = (c + delta) & 0xffff;
          else {
            glyph = u16(rangePos + range + 2 * (c - start));
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(c);
        }
      }
      read++;
    } else if (format === 12) {
      const groups = u32(base + 12);
      for (let g = 0; g < groups; g++) {
        const at = base + 16 + g * 12;
        const start = u32(at);
        const end = u32(at + 4);
        const firstGlyph = u32(at + 8);
        for (let c = start; c <= end; c++) if (firstGlyph + (c - start) !== 0) out.add(c);
      }
      read++;
    }
  }
  if (read === 0) throw new Error('the font has no cmap subtable in format 4 or 12');
  return out;
}
