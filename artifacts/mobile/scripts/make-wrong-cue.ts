/**
 * Builds assets/sounds/wrong.wav: two soft descending tones (G4 then D4), 16-bit
 * mono PCM at 22.05 kHz, about 15 KB, peak at 30% so it is quieter than the
 * correct cue, with a 5 ms attack and a 10 ms release so it never clicks.
 * Synthesised, so there is no licence to track. Regenerate with:
 *   cd artifacts/mobile && node --experimental-strip-types scripts/make-wrong-cue.ts
 * wrongCue.test.ts fails if the committed file differs from this output.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RATE = 22050;
const TONES = [{ hz: 392, ms: 150 }, { hz: 294, ms: 190 }];

export function makeWrongCue(): Buffer {
  const samples: number[] = [];
  for (const { hz, ms } of TONES) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const attack = Math.min(1, i / (RATE * 0.005));
      const release = Math.min(1, (n - 1 - i) / (RATE * 0.01));
      const decay = Math.exp(-t * 14);
      samples.push(Math.round(0.3 * 32767 * attack * release * decay * Math.sin(2 * Math.PI * hz * t)));
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = fileURLToPath(new URL('../assets/sounds/wrong.wav', import.meta.url).href);
  writeFileSync(out, makeWrongCue());
  console.log('wrote', out);
}
