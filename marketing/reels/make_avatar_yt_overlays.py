#!/usr/bin/env python3
"""Writes avatar_yt_ov.html (Reel 17 text layers, 1920x1080) from avatar_yt_script.py. Render with:
    python3 make_avatar_yt_overlays.py && node render_html.js avatar_yt_ov.html overlays_avatar_yt 1920 1080
The shared layers (lockup, Jordanian chip, virtual-presenter tag, demo pills) come from make_avatar_overlays."""
from avatar_yt_script import BEATS, words
from avatar_script import CTA_LINE
from make_avatar_overlays import CSS as BASE_CSS, common_rows

CSS = BASE_CSS.replace("body{font-family:\"Almarai\",sans-serif;direction:rtl;width:1080px}", "body{font-family:\"Almarai\",sans-serif;direction:rtl;width:1920px}") + """
.ttlbox{width:640px;text-align:right}
.grp{font-family:"Almarai";font-weight:800;font-size:34px;color:var(--primary);margin-bottom:10px}
.ttl{font-family:"Cairo";font-weight:900;font-size:104px;line-height:1.15;color:var(--ink);white-space:nowrap}
.mk{background:linear-gradient(transparent 56%,var(--yellow) 56%,var(--yellow) 90%,transparent 90%);padding:0 12px;margin:0 -12px}
.cap{width:640px;font-size:58px;line-height:1.32}
.end{width:640px;text-align:right;font-family:"Cairo";font-weight:900;font-size:76px;line-height:1.22;color:var(--ink)}
.end b{background:linear-gradient(transparent 58%,var(--yellow) 58%,var(--yellow) 90%,transparent 90%);padding:0 10px;font-weight:900}
.lock{width:240px}
"""
FIT = """<script>
document.fonts.ready.then(() => document.querySelectorAll('.ttl').forEach(t => {
  let f = 104; while (t.scrollWidth > 630 && f > 56) { f -= 4; t.style.fontSize = f + 'px'; }
}));
</script>"""

rows = common_rows()
for b, beat in enumerate(BEATS):
    if beat["key"] != "cta":
        rows.append(f'<div id="t{b}" class="o ttlbox"><div class="grp">{beat["group"]}</div><div class="ttl"><span class="mk">{beat["title"]}</span></div></div>')
    for j, c in enumerate(beat["chunks"]):
        if beat["key"] == "cta":
            h = c.replace("أردني", "<b>أردني</b>").replace("أردنيين", "<b>أردنيين</b>").replace("مجانًا", "<b>مجانًا</b>")
            h = h.replace("www.iqrra.com", "<span style='direction:ltr;unicode-bidi:isolate'>www.iqrra.com</span>")
            rows.append(f'<div id="e{b}_{j}" class="o end">{h}</div>')
        else:
            rows.append(f'<div id="c{b}_{j}" class="o cap">{c}</div>')
cta = CTA_LINE.replace("www.iqrra.com", "<span>www.iqrra.com</span>")
rows.append(f'<div id="cta" class="o"><div class="cta">{cta}</div></div>')
open("avatar_yt_ov.html", "w").write(f"<!doctype html><meta charset='utf-8'><style>{CSS}</style><body>\n" + "\n".join(rows) + FIT)
print("wrote avatar_yt_ov.html,", len(rows), "elements")
