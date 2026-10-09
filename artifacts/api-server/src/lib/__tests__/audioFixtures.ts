/**
 * Minimal, byte-accurate recordings for the duration tests — built here rather
 * than checked in as binaries, so each test can say exactly what it is lying
 * about. Shapes follow what browsers emit: Chrome/Firefox MediaRecorder writes
 * webm/opus with an unknown-size Segment and Clusters; Safari writes AAC in a
 * (fragmented) MP4.
 */

// ─── WAV ────────────────────────────────────────────────────────────────────
export function wav(seconds: number, opts: { sampleRate?: number; claimedByteRate?: number; format?: number } = {}): Buffer {
  const sampleRate = opts.sampleRate ?? 16000;
  const blockAlign = 2; // mono, 16-bit
  const data = Buffer.alloc(Math.round(seconds * sampleRate) * blockAlign);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(opts.format ?? 1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(opts.claimedByteRate ?? sampleRate * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(16, 14);
  const chunk = (id: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, "latin1");
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  const body = Buffer.concat([Buffer.from("WAVE", "latin1"), chunk("fmt ", fmt), chunk("data", data)]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "latin1");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

// ─── WebM / Opus ────────────────────────────────────────────────────────────
function ebmlSize(n: number): Buffer {
  if (n < 0x7f) return Buffer.from([0x80 | n]);
  if (n < 0x3fff) return Buffer.from([0x40 | (n >> 8), n & 0xff]);
  throw new Error("fixture element too large");
}
const UNKNOWN = Buffer.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
function el(id: number[], body: Buffer): Buffer {
  return Buffer.concat([Buffer.from(id), ebmlSize(body.length), body]);
}

/** One opus TOC byte: CELT fullband 20 ms is config 31; SILK 60 ms is config 3. */
export const OPUS_20MS = 31 << 3;
export const OPUS_60MS = 3 << 3;

export function webmOpus(
  packets: number,
  opts: { toc?: number; codec?: string; timecodeStepMs?: number; laced?: boolean } = {},
): Buffer {
  const toc = opts.toc ?? OPUS_20MS;
  const header = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x82], Buffer.from("webm", "latin1")));
  const tracks = el([0x16, 0x54, 0xae, 0x6b], el([0xae], el([0x86], Buffer.from(opts.codec ?? "A_OPUS", "latin1"))));
  const blocks: Buffer[] = [];
  for (let i = 0; i < packets; i++) {
    const timecode = Math.min(0x7fff, i * (opts.timecodeStepMs ?? 20));
    const flags = opts.laced ? 0x80 | 0x02 : 0x80;
    const body = Buffer.concat([
      Buffer.from([0x81, timecode >> 8, timecode & 0xff, flags, toc]),
      Buffer.alloc(40, 0x55),
    ]);
    blocks.push(el([0xa3], body));
  }
  const cluster = Buffer.concat([Buffer.from([0x1f, 0x43, 0xb6, 0x75]), UNKNOWN, el([0xe7], Buffer.from([0])), ...blocks]);
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67]), UNKNOWN, tracks, cluster]);
  return Buffer.concat([header, segment]);
}

// ─── MP4 / AAC ──────────────────────────────────────────────────────────────
function box(type: string, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.writeUInt32BE(body.length + 8, 0);
  h.write(type, 4, "latin1");
  return Buffer.concat([h, body]);
}
const u32 = (...ns: number[]) => {
  const b = Buffer.alloc(ns.length * 4);
  ns.forEach((n, i) => b.writeUInt32BE(n, i * 4));
  return b;
};

export function mp4Aac(
  samples: number,
  opts: { sampleRate?: number; fragmented?: boolean; entry?: string; claimedTimescale?: number } = {},
): Buffer {
  const rate = opts.sampleRate ?? 48000;
  const entryBody = Buffer.alloc(28);
  entryBody.writeUInt16BE(1, 6); // data_reference_index
  entryBody.writeUInt16BE(1, 16); // channels
  entryBody.writeUInt16BE(16, 18); // sample size
  entryBody.writeUInt32BE(rate * 65536, 24); // 16.16 sample rate
  const stsd = box("stsd", u32(0, 1), box(opts.entry ?? "mp4a", entryBody));
  const stsz = box("stsz", u32(0, 0, opts.fragmented ? 0 : samples));
  // A duration header that lies — it must not matter.
  const mdhd = box("mdhd", u32(0, 0, 0, opts.claimedTimescale ?? rate, 1, 0));
  const moov = box("moov", box("trak", box("mdia", mdhd, box("minf", box("stbl", stsd, stsz)))));
  const parts = [box("ftyp", Buffer.from("M4A isom", "latin1")), moov];
  if (opts.fragmented) {
    // Two fragments, like a recorder flushing as it goes.
    const half = Math.floor(samples / 2);
    for (const n of [half, samples - half]) {
      parts.push(box("moof", box("traf", box("trun", u32(0, n)))), box("mdat", Buffer.alloc(16)));
    }
  } else {
    parts.push(box("mdat", Buffer.alloc(16)));
  }
  return Buffer.concat(parts);
}

// ─── MP3 ────────────────────────────────────────────────────────────────────
/** MPEG-1 layer III, 128 kbps, 44.1 kHz: 417-byte frames of 1152 samples. */
export function mp3(frames: number, opts: { junkBytes?: number } = {}): Buffer {
  const frame = Buffer.alloc(417);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0x00;
  return Buffer.concat([...Array.from({ length: frames }, () => frame), Buffer.alloc(opts.junkBytes ?? 0, 0x11)]);
}
export const MP3_FRAME_MS = (1152 / 44100) * 1000;
