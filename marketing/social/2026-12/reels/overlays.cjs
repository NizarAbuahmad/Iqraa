// Renders a reel's overlays with Chrome (Arabic shaped by the browser, never by ffmpeg):
//   bg.png      full 1080x1920 background
//   frame.png   transparent phone bezel around the screen window
//   cap-<n>.png transparent 1080x300 caption strip for the top of the frame
//   end.png     full-frame end card
//   text-<n>.png full-frame cards for text-only reels
// Usage: node reels/overlays.cjs reels/<id>.json
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const W = 1080, H = 1920;
// Screen window inside the bezel (must match build.py).
const WIN = { x: 126, y: 330, w: 828, h: 1472 }, BEZEL = 16, RADIUS = 56;

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Almarai:wght@400;700;800&display=swap" rel="stylesheet">';
const BASE = `*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent}
body{font-family:"Almarai",sans-serif;direction:rtl;width:${W}px}
.navy{background:radial-gradient(900px 700px at 70% 8%, rgba(52,214,198,.22), transparent 62%),radial-gradient(700px 600px at 10% 96%, rgba(0,169,157,.18), transparent 65%),#081B3A}
.brand{display:flex;align-items:center;gap:16px}.brand img{width:58px;height:58px;border-radius:15px}
.brand b{font-family:"Cairo";font-weight:900;font-size:38px;color:#fff;line-height:1}
.brand i{font-style:normal;font-family:"Cairo";font-weight:600;font-size:20px;color:rgba(255,255,255,.65);display:block;direction:ltr;text-align:right;margin-top:3px}`;

const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'design', 'icon.png')).toString('base64');
const brand = `<div class="brand"><img src="${icon}"><div><b>إقرأ</b><i>Iqrra</i></div></div>`;

const pages = {
  bg: () => `<div class="navy" style="width:${W}px;height:${H}px;position:relative">
     <div style="position:absolute;bottom:44px;left:0;right:0;text-align:center;font-family:Cairo;font-weight:700;font-size:30px;color:rgba(255,255,255,.55);direction:ltr">app.iqrra.com</div></div>`,
  frame: () => `<div style="width:${W}px;height:${H}px;position:relative">
     <svg width="${W}" height="${H}" style="position:absolute;inset:0"><defs><mask id="m"><rect width="${W}" height="${H}" fill="#fff"/>
     <rect x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}" rx="${RADIUS - BEZEL}" fill="#000"/></mask></defs>
     <rect x="${WIN.x - BEZEL}" y="${WIN.y - BEZEL}" width="${WIN.w + 2 * BEZEL}" height="${WIN.h + 2 * BEZEL}" rx="${RADIUS}" fill="#0B2148" mask="url(#m)"/>
     <rect x="${WIN.x - BEZEL}" y="${WIN.y - BEZEL}" width="${WIN.w + 2 * BEZEL}" height="${WIN.h + 2 * BEZEL}" rx="${RADIUS}" fill="none" stroke="rgba(52,214,198,.35)" stroke-width="2"/>
     </svg></div>`,
  // top strip: brand on the right, caption text under it
  cap: (c) => `<div style="width:${W}px;height:300px;padding:40px 70px 0;display:flex;flex-direction:column;gap:18px">
     <div style="display:flex;justify-content:space-between;align-items:center">${brand}${c.tag ? `<span style="font-family:Cairo;font-weight:800;font-size:26px;color:#34D6C6;background:rgba(52,214,198,.14);padding:8px 22px;border-radius:999px">${c.tag}</span>` : ''}</div>
     <div style="font-family:Cairo;font-weight:${c.hook ? 900 : 800};font-size:${c.hook ? 54 : 46}px;line-height:1.35;color:${c.hook ? '#34D6C6' : '#fff'}">${c.text}</div></div>`,
  end: (e) => `<div class="navy" style="width:${W}px;height:${H}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 90px;gap:40px">
     <img src="${icon}" style="width:170px;height:170px;border-radius:44px">
     <div style="font-family:Cairo;font-weight:900;font-size:110px;color:#fff;line-height:1.1">إقرأ</div>
     <div style="font-family:Cairo;font-weight:800;font-size:56px;color:#fff;line-height:1.4">${e.line}</div>
     <div style="font-size:38px;color:rgba(255,255,255,.75);line-height:1.6">${e.sub || 'مبنيّ على كتابك، لا على محتوى عام'}</div>
     <div style="margin-top:20px;font-family:Cairo;font-weight:900;font-size:52px;background:#34D6C6;color:#081B3A;padding:22px 52px;border-radius:999px;direction:ltr">${e.url || 'app.iqrra.com'}</div></div>`,
  text: (t) => `<div class="navy" style="width:${W}px;height:${H}px;position:relative;padding:0 90px;display:flex;flex-direction:column;justify-content:center">
     <div style="position:absolute;top:110px;right:90px">${brand}</div>
     ${t.kicker ? `<div><span style="font-family:Cairo;font-weight:800;font-size:36px;color:#34D6C6;background:rgba(52,214,198,.14);padding:12px 30px;border-radius:999px">${t.kicker}</span></div>` : ''}
     ${t.num ? `<div style="font-family:Cairo;font-weight:900;font-size:190px;color:#34D6C6;line-height:1;direction:ltr;text-align:right">${t.num}</div>` : ''}
     <div style="font-family:Cairo;font-weight:900;font-size:${t.size || 96}px;color:#fff;line-height:1.32;margin-top:30px">${t.text}</div>
     ${t.sub ? `<div style="font-size:44px;color:rgba(255,255,255,.78);line-height:1.6;margin-top:30px">${t.sub}</div>` : ''}</div>`,
};

(async () => {
  const specPath = process.argv[2];
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const out = path.join(path.dirname(specPath), 'build', spec.id);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const shot = async (name, html, h, transparent) => {
    await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">${FONTS}<style>${BASE}</style><body>${html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: W, height: h }, omitBackground: transparent });
  };
  if (spec.clip) {
    await shot('bg.png', pages.bg(), H, false);
    await shot('frame.png', pages.frame(), H, true);
    for (const [k, c] of (spec.captions || []).entries()) await shot(`cap-${k}.png`, pages.cap(c), 300, true);
  }
  for (const [k, t] of (spec.cards || []).entries()) await shot(`text-${k}.png`, pages.text(t), H, false);
  await shot('end.png', pages.end(spec.end || { line: 'جرّبه مجانًا' }), H, false);
  await browser.close();
  console.log('overlays ->', out);
})();
