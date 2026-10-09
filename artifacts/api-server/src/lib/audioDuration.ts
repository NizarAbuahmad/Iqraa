/**
 * How long a recording really is, read from the bytes the client sent.
 *
 * The read-aloud routes used to take `durationMs` from the request body, and
 * that one number was both the 120-second ceiling and what transcription was
 * billed at — so a client claiming "1 second" for ninety minutes of opus got
 * both the ceiling and the ledger to agree with it.
 *
 * Each format is measured by what a decoder will actually play, not by a
 * duration field the file carries about itself: opus packets by their TOC
 * byte, AAC by its sample count, PCM by its data size, MP3 by its frames. A
 * header can say anything; the packets are what the transcriber pays for.
 *
 * Returns null when the file can't be measured. The caller refuses it: an
 * unreadable length must never read as "short".
 *
 * Pure and dependency-free (no ffprobe in the runtime image), so it runs under
 * `node --test`.
 */

export function audioDurationMs(buf: Buffer): number | null {
  if (buf.length < 12) return null;
  const ms =
    buf.toString("latin1", 0, 4) === "RIFF" ? wavMs(buf)
    : buf.readUInt32BE(0) === 0x1a45dfa3 ? webmOpusMs(buf)
    : buf.toString("latin1", 4, 8) === "ftyp" ? mp4AacMs(buf)
    : mp3Ms(buf);
  return ms !== null && Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
}

// ─── WAV ────────────────────────────────────────────────────────────────────
function wavMs(buf: Buffer): number | null {
  if (buf.toString("latin1", 8, 12) !== "WAVE") return null;
  let bytesPerSecond = 0;
  for (let pos = 12; pos + 8 <= buf.length; ) {
    const id = buf.toString("latin1", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt " && body + 16 <= buf.length) {
      const format = buf.readUInt16LE(body);
      // PCM, IEEE float, or WAVE_FORMAT_EXTENSIBLE — uncompressed, so bytes
      // are time. A compressed WAV could hide hours in a small data chunk.
      if (format !== 1 && format !== 3 && format !== 0xfffe) return null;
      // sampleRate × blockAlign, not the byteRate field: those are what a
      // decoder plays at, and byteRate is just a claim.
      bytesPerSecond = buf.readUInt32LE(body + 4) * buf.readUInt16LE(body + 12);
    } else if (id === "data") {
      if (!bytesPerSecond) return null;
      // A streamed WAV may carry 0 or 0xFFFFFFFF here; the bytes present are
      // what will be decoded.
      const dataBytes = Math.min(size === 0 ? Infinity : size, buf.length - body);
      return (dataBytes / bytesPerSecond) * 1000;
    }
    pos = body + size + (size & 1);
  }
  return null;
}

// ─── WebM / Opus (Chrome, Firefox) ──────────────────────────────────────────
const EBML_MASTERS = new Set([
  0x18538067, // Segment
  0x1f43b675, // Cluster
  0x1654ae6b, // Tracks
  0xae, // TrackEntry
  0xa0, // BlockGroup
]);
const EBML_CODEC_ID = 0x86;
const EBML_SIMPLE_BLOCK = 0xa3;
const EBML_BLOCK = 0xa1;

/** An EBML variable-length integer: its value and how many bytes it took. */
function vint(buf: Buffer, pos: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } | null {
  const first = buf[pos];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > 8 || pos + len > buf.length) return null;
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + buf[pos + i]!;
    if (buf[pos + i] !== 0xff) allOnes = false;
  }
  return { value, len, unknown: !keepMarker && allOnes };
}

/** Milliseconds of audio in one opus packet, from its TOC byte (RFC 6716 §3.1). */
function opusPacketMs(packet: Buffer): number | null {
  if (packet.length < 1) return null;
  const toc = packet[0]!;
  const config = toc >> 3;
  const frameMs =
    config < 12 ? [10, 20, 40, 60][config & 3]!
    : config < 16 ? [10, 20][config & 1]!
    : [2.5, 5, 10, 20][config & 3]!;
  const code = toc & 3;
  const frames = code === 0 ? 1 : code < 3 ? 2 : packet.length > 1 ? packet[1]! & 0x3f : 0;
  return frameMs * frames;
}

function webmOpusMs(buf: Buffer): number | null {
  let total = 0;
  let blocks = 0;
  let sawOpus = false;
  // A flat walk: masters are entered (their children simply follow), every
  // other element is skipped by its size. That handles MediaRecorder's
  // unknown-size Segment and Clusters without tracking where each one ends.
  for (let pos = 0; pos < buf.length; ) {
    const id = vint(buf, pos, true);
    if (!id) break;
    const size = vint(buf, pos + id.len, false);
    if (!size) break;
    const body = pos + id.len + size.len;
    if (EBML_MASTERS.has(id.value)) {
      pos = body;
      continue;
    }
    if (size.unknown) return null;
    const end = body + size.value;
    if (end > buf.length) break; // a truncated tail; count what arrived whole
    if (id.value === EBML_CODEC_ID) {
      // Every track must be opus: the TOC arithmetic below means nothing for
      // any other codec, and an unmeasured track is an unbilled one.
      if (buf.toString("latin1", body, end).replace(/\0+$/, "") !== "A_OPUS") return null;
      sawOpus = true;
    } else if (id.value === EBML_SIMPLE_BLOCK || id.value === EBML_BLOCK) {
      const track = vint(buf, body, false);
      if (!track) return null;
      const flags = buf[body + track.len + 2];
      if (flags === undefined) return null;
      // Laced blocks pack several packets behind one header. Browsers don't
      // write them; refusing is safer than guessing their sizes.
      if (flags & 0x06) return null;
      const ms = opusPacketMs(buf.subarray(body + track.len + 3, end));
      if (ms === null) return null;
      total += ms;
      blocks++;
    }
    pos = end;
  }
  return sawOpus && blocks > 0 ? total : null;
}

// ─── MP4 / AAC (Safari) ─────────────────────────────────────────────────────
const MP4_CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "moof", "traf"]);

function mp4AacMs(buf: Buffer): number | null {
  let sampleRate = 0;
  let samples = 0;
  const walk = (start: number, end: number): boolean => {
    for (let pos = start; pos + 8 <= end; ) {
      let size = buf.readUInt32BE(pos);
      const type = buf.toString("latin1", pos + 4, pos + 8);
      let header = 8;
      if (size === 1) {
        if (pos + 16 > end) return false;
        size = Number(buf.readBigUInt64BE(pos + 8));
        header = 16;
      } else if (size === 0) {
        size = end - pos;
      }
      if (size < header) return false;
      const boxEnd = Math.min(pos + size, end);
      const body = pos + header;
      if (MP4_CONTAINERS.has(type)) {
        if (!walk(body, boxEnd)) return false;
      } else if (type === "stsd") {
        // FullBox(4) + entry_count(4), then sample entries as boxes. Only AAC
        // is measured: one sample is one 1024-sample AAC frame.
        const entryType = buf.toString("latin1", body + 12, body + 16);
        if (entryType !== "mp4a") return false;
        // Entry box header(8) at body+8, then SampleEntry(8) + AudioSampleEntry:
        // reserved(8) channels(2) samplesize(2) pre_defined(2) reserved(2)
        // samplerate(16.16).
        const rateAt = body + 8 + 8 + 8 + 8 + 8;
        if (rateAt + 4 > boxEnd) return false;
        sampleRate = buf.readUInt32BE(rateAt) >>> 16;
      } else if (type === "stsz") {
        // FullBox(4) + sample_size(4) + sample_count(4)
        if (body + 12 > boxEnd) return false;
        samples += buf.readUInt32BE(body + 8);
      } else if (type === "trun") {
        // FullBox(4) + sample_count(4) — a fragmented file's samples
        if (body + 8 > boxEnd) return false;
        samples += buf.readUInt32BE(body + 4);
      }
      pos += size;
    }
    return true;
  };
  if (!walk(0, buf.length) || !sampleRate || !samples) return null;
  return (samples * 1024 / sampleRate) * 1000;
}

// ─── MP3 ────────────────────────────────────────────────────────────────────
const MP3_BITRATES: Record<string, number[]> = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

function mp3Ms(buf: Buffer): number | null {
  let pos = 0;
  if (buf.toString("latin1", 0, 3) === "ID3" && buf.length >= 10) {
    const tagSize = (buf[6]! << 21) | (buf[7]! << 14) | (buf[8]! << 7) | buf[9]!;
    pos = 10 + tagSize + (buf[5]! & 0x10 ? 10 : 0);
  }
  const start = pos;
  let seconds = 0;
  let frameBytes = 0;
  while (pos + 4 <= buf.length) {
    const b1 = buf[pos + 1]!;
    const b2 = buf[pos + 2]!;
    const version = (b1 >> 3) & 3;
    const layer = 4 - ((b1 >> 1) & 3); // 1, 2 or 3; 4 is reserved
    const rate = MP3_RATES[version]?.[(b2 >> 2) & 3];
    const kbps = MP3_BITRATES[`${version === 3 ? 1 : 2}-${Math.min(layer, version === 3 ? 3 : 2)}`]?.[b2 >> 4];
    if (buf[pos] !== 0xff || (b1 & 0xe0) !== 0xe0 || layer === 4 || !rate || !kbps) {
      pos++; // not a frame header: resync rather than give up
      continue;
    }
    const padding = (b2 >> 1) & 1;
    const samplesPerFrame = layer === 1 ? 384 : layer === 2 || version === 3 ? 1152 : 576;
    const length = layer === 1
      ? Math.floor((12 * kbps * 1000) / rate + padding) * 4
      : Math.floor((samplesPerFrame / 8) * kbps * 1000 / rate) + padding;
    seconds += samplesPerFrame / rate;
    frameBytes += length;
    pos += length;
  }
  // Most of the payload must be frames we could read. Otherwise audio in a
  // form we skipped (free-format frames, say) would go unmeasured and unbilled.
  if (frameBytes < (buf.length - start) * 0.9) return null;
  return seconds * 1000;
}
