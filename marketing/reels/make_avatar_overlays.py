#!/usr/bin/env python3
"""Writes avatar_ov.html (Reel 16 text layers, 1080x1920) from avatar_script.py. Render with:
    python3 make_avatar_overlays.py && node render_html.js avatar_ov.html overlays_avatar_ov 1080 1920
Arabic is shaped by Chromium, never by ffmpeg drawtext."""
import math

from avatar_script import BEATS, CTA_LINE, JORDAN_CHIP, PILL, TAG

CSS = """
:root{--ink:#0B1B33;--brand:#00A99D;--primary:#006D65;--paper:#F6F5F1;--yellow:#FFC93C}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{font-family:"Almarai",sans-serif;direction:rtl;width:1080px}
.o{position:absolute;left:0;top:0}
.cap{width:880px;text-align:right;font-family:"Cairo";font-weight:900;font-size:76px;line-height:1.28;color:var(--ink)}
.hl{width:940px;text-align:center;font-family:"Cairo";font-weight:900;font-size:72px;line-height:1.25;color:var(--ink)}
.hl b{background:linear-gradient(transparent 58%,var(--yellow) 58%,var(--yellow) 90%,transparent 90%);padding:0 12px;font-weight:900}
.pill{display:inline-flex;align-items:center;gap:14px;padding:10px 26px;border-radius:999px;background:#fff;border:3px solid var(--ink);font-family:"Almarai";font-weight:800;font-size:30px;color:var(--ink);white-space:nowrap}
.tag{background:var(--ink);color:#fff;border-color:var(--ink);font-size:27px}
.chip{background:#fff}
.cta{display:inline-block;background:#fff;border:4px solid var(--ink);border-radius:26px;box-shadow:0 10px 0 var(--ink);padding:18px 44px;font-family:"Cairo";font-weight:900;font-size:56px;color:var(--ink);white-space:nowrap;direction:rtl}
.cta span{direction:ltr;unicode-bidi:isolate;color:var(--primary)}
.lock{width:230px}
"""


def star(cx, cy, r, n=7):
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + i * math.pi / n
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{cx + rr * math.cos(a):.2f},{cy + rr * math.sin(a):.2f}")
    return " ".join(pts)


FLAG = f"""<svg width="54" height="36" viewBox="0 0 54 36" style="border-radius:5px;flex:0 0 auto"><rect width="54" height="12" fill="#000"/>
<rect y="12" width="54" height="12" fill="#fff"/><rect y="24" width="54" height="12" fill="#007A3D"/>
<polygon points="0,0 0,36 27,18" fill="#CE1126"/><polygon points="{star(9, 18, 5.2)}" fill="#fff"/></svg>"""

def common_rows():
    """The layers both formats share: lockup, the Jordanian chip, the virtual-presenter tag, the demo pills."""
    rows = ['<div id="lk" class="o"><img class="lock" src="assets/lockup-ink.svg" alt=""></div>',
            f'<div id="chip" class="o"><span class="pill chip">{FLAG}{JORDAN_CHIP}</span></div>',
            f'<div id="tag" class="o"><span class="pill tag">{TAG}</span></div>']
    for k, txt in PILL.items():
        rows.append(f'<div id="pill_{k}" class="o"><span class="pill">{txt}</span></div>')
    return rows


def main():
    rows = common_rows()
    for b, beat in enumerate(BEATS):
        for i, c in enumerate(beat["chunks"]):
            if beat["key"] == "cta":
                hl = c.replace("أردني", "<b>أردني</b>").replace("أردنيين", "<b>أردنيين</b>").replace("مجانًا", "<b>مجانًا</b>")
                rows.append(f'<div id="h{b}_{i}" class="o hl">{hl}</div>')
            else:
                rows.append(f'<div id="cap_{b}_{i}" class="o cap">{c}</div>')
    cta = CTA_LINE.replace("www.iqrra.com", "<span>www.iqrra.com</span>")
    rows.append(f'<div id="cta" class="o"><div class="cta">{cta}</div></div>')
    open("avatar_ov.html", "w").write(f"<!doctype html><meta charset='utf-8'><style>{CSS}</style><body>\n" + "\n".join(rows))
    print("wrote avatar_ov.html,", len(rows), "elements")


if __name__ == "__main__":
    main()
