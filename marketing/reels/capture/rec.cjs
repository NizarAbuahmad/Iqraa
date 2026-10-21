// Screen recorder for the local Iqraa web app.
//
// Chrome's screencast (CDP) hands us crisp frames at the page's device-pixel
// size; Playwright's own recordVideo scales them down and looks soft. Frames only
// arrive when pixels change, so each is held for the gap to the next and the
// result is resampled to a constant 30 fps.
//
// A headless browser has no visible cursor, and the reels want a pointer anyway,
// so every move/tap/scroll we perform is logged with its time. The compositor
// draws the pointer and tap ripple from that log, at exactly the position the
// click really landed.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = x => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

class Recorder {
  constructor(page, outDir, { maxW, maxH }) {
    this.page = page; this.outDir = path.resolve(outDir); this.maxW = maxW; this.maxH = maxH;
    this.frames = []; this.events = []; this.n = 0; this.on = false;
  }

  async start() {
    fs.rmSync(this.outDir, { recursive: true, force: true });
    fs.mkdirSync(this.outDir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async f => {
      if (!this.on) return;
      const file = path.join(this.outDir, `f${String(this.n++).padStart(6, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      if (!this.frames.length) this.clockSkew = Date.now() / 1000 - f.metadata.timestamp;   // ~0 when frame ts is wall-clock
      this.frames.push({ file, ts: f.metadata.timestamp });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) { /* closing */ }
    });
    this.on = true;
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 85, maxWidth: this.maxW, maxHeight: this.maxH, everyNthFrame: 1,
    });
    await sleep(300);
  }

  log(type, data = {}) { this.events.push({ wall: Date.now() / 1000, type, ...data }); }

  async stop(name) {
    await sleep(250);
    this.endWall = Date.now() / 1000;
    this.on = false;
    await this.cdp.send('Page.stopScreencast');
    if (!this.frames.length) throw new Error('no frames captured');
    const t0 = this.frames[0].ts;
    const lines = [];
    this.frames.forEach((f, i) => {
      const next = this.frames[i + 1];
      // the last frame is held until the recording stopped (frames only arrive when pixels change)
      const dur = next ? next.ts - f.ts : Math.max(0.4, this.endWall - this.clockSkew - f.ts);
      lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
    });
    lines.push(`file '${this.frames[this.frames.length - 1].file}'`);
    const list = path.join(this.outDir, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    const mp4 = path.join(path.dirname(this.outDir), `${name}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', mp4]);
    // events relative to video t=0 (the first frame). Screencast timestamps are wall-clock seconds.
    const rel = this.events.map(e => ({ ...e, t: +(e.wall - t0).toFixed(3) }));
    fs.writeFileSync(path.join(path.dirname(this.outDir), `${name}.events.json`), JSON.stringify(rel, null, 1));
    fs.writeFileSync(path.join(path.dirname(this.outDir), `${name}.frames.json`), JSON.stringify(this.frames.map(f => +(f.ts - t0).toFixed(3))));
    const span = this.frames[this.frames.length - 1].ts - t0;
    console.log('clock skew (s):', +this.clockSkew.toFixed(3));
    return { mp4, frames: this.frames.length, seconds: +span.toFixed(2), fps: +(this.frames.length / span).toFixed(1) };
  }
}

class Pointer {
  constructor(page, rec) { this.page = page; this.rec = rec; this.x = 195; this.y = 520; }

  async move(x, y, ms = 520) {
    const x0 = this.x, y0 = this.y, steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) {
      const k = ease(i / steps);
      this.x = x0 + (x - x0) * k; this.y = y0 + (y - y0) * k;
      await this.page.mouse.move(this.x, this.y);
      this.rec.log('move', { x: +this.x.toFixed(1), y: +this.y.toFixed(1) });
      await sleep(16);
    }
  }

  async tap(x, y, ms = 520) {
    await this.move(x, y, ms);
    await sleep(120);
    this.rec.log('tap', { x, y });
    await this.page.mouse.down(); await sleep(70); await this.page.mouse.up();
  }

  /** Centre of a locator's box, in CSS px. */
  async center(loc) {
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    const b = await loc.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  async tapOn(loc, ms = 520) { const c = await this.center(loc); await this.tap(c.x, c.y, ms); return c; }

  /** Smooth wheel scroll of `dy` px over `ms`. */
  async scroll(dy, ms = 900, atX = 195, atY = 480) {
    await this.page.mouse.move(atX, atY);
    const steps = Math.max(2, Math.round(ms / 16)); let done = 0;
    for (let i = 1; i <= steps; i++) {
      const target = dy * ease(i / steps); const d = target - done; done = target;
      await this.page.mouse.wheel(0, d);
      await sleep(16);
    }
    this.rec.log('scroll', { dy });
  }
}

module.exports = { Recorder, Pointer, sleep };
