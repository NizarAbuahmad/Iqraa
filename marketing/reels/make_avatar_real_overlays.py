#!/usr/bin/env python3
"""Writes avatar_real_ov.html (Reel 18 text layers, 1080x1920) from avatar_real_script.py. Render with:
    python3 make_avatar_real_overlays.py && node render_html.js avatar_real_ov.html overlays_avatar_real 1080 1920"""
from avatar_real_script import CTA, SENTENCES
from avatar_script import JORDAN_CHIP, PILL
from make_avatar_overlays import CSS as BASE, FLAG

CSS = BASE + """
.cap2{width:520px;text-align:right;font-family:"Cairo";font-weight:900;font-size:54px;line-height:1.28;color:var(--ink)}
.tag2{background:#fff;color:var(--ink);font-size:27px}
.cta{font-size:40px;padding:14px 28px;border-radius:22px;background:var(--primary);color:#fff;border-color:var(--ink);box-shadow:0 8px 0 var(--ink)}
.cta span{color:#fff}
.url{font-family:"Cairo";font-weight:900;font-size:58px;color:var(--primary);direction:ltr;white-space:nowrap}
"""
rows = ['<div id="lk" class="o"><img class="lock" src="assets/lockup-ink.svg" alt=""></div>',
        f'<div id="chip" class="o"><span class="pill chip">{FLAG}{JORDAN_CHIP}</span></div>',
        '<div id="url" class="o"><div class="url">www.iqrra.com</div></div>']
for k, t in PILL.items():
    rows.append(f'<div id="pill_{k}" class="o"><span class="pill">{t}</span></div>')
for i, s in enumerate(SENTENCES):
    for j, c in enumerate(s["chunks"]):
        rows.append(f'<div id="c{i}_{j}" class="o cap2">{c}</div>')
cta = CTA.replace("www.iqrra.com", "<span>www.iqrra.com</span>")
rows.append(f'<div id="cta" class="o"><div class="cta">{cta}</div></div>')
open("avatar_real_ov.html", "w").write(f"<!doctype html><meta charset='utf-8'><style>{CSS}</style><body>\n" + "\n".join(rows))
print("wrote avatar_real_ov.html,", len(rows), "elements")
