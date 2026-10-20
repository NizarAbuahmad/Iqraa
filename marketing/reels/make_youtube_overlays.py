#!/usr/bin/env python3
"""Writes yt_overlays.html (Reel 15, the YouTube explainer) from youtube_chapters.py. Render with:
    python3 make_youtube_overlays.py && node render_html.js yt_overlays.html overlays_yt 1920 1080
Arabic is shaped by Chromium, never by ffmpeg drawtext."""
from youtube_chapters import CHAPTERS

AR = "٠١٢٣٤٥٦٧٨٩"
ar = lambda n: "".join(AR[int(c)] for c in f"{n:02d}")

CSS = """
:root{--ink:#0B1B33;--brand:#00A99D;--primary:#006D65;--paper:#F6F5F1;--yellow:#FFC93C}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{font-family:"Almarai",sans-serif;direction:rtl;width:1920px}
.o{position:absolute;left:0;top:0}
.head{width:860px;text-align:right}
.head .row{display:flex;align-items:center;gap:16px;justify-content:flex-start;margin-bottom:22px}
.head .num{font-family:"Cairo";font-weight:900;font-size:40px;color:#fff;background:var(--ink);border-radius:14px;padding:4px 20px}
.head .grp{font-family:"Almarai";font-weight:800;font-size:32px;color:var(--primary)}
.head .ttl{font-family:"Cairo";font-weight:900;font-size:112px;line-height:1.12;color:var(--ink);white-space:nowrap}
.mk{background:linear-gradient(transparent 56%,var(--yellow) 56%,var(--yellow) 90%,transparent 90%);padding:0 12px;margin:0 -12px}
.bul{width:860px;text-align:right;display:flex;align-items:flex-start;gap:20px;font-family:"Almarai";font-weight:800;font-size:46px;line-height:1.35;color:var(--ink)}
.bul i{flex:0 0 auto;width:54px;height:54px;border-radius:50%;background:var(--primary);color:#fff;font-style:normal;font-size:32px;display:flex;align-items:center;justify-content:center;margin-top:6px}
.pill{display:inline-flex;padding:10px 26px;border-radius:999px;background:#fff;border:3px solid var(--ink);font-family:"Almarai";font-weight:800;font-size:30px;color:var(--ink);white-space:nowrap}
.lock{width:250px}
.intro .big{font-family:"Cairo";font-weight:900;font-size:150px;line-height:1.1;color:var(--ink)}
.intro .sub{font-family:"Almarai";font-weight:800;font-size:50px;line-height:1.4;color:var(--primary);margin-top:26px}
.intro .tags{display:flex;gap:16px;flex-wrap:wrap;margin-top:44px;justify-content:flex-start}
.intro .tags span{font-family:"Cairo";font-weight:800;font-size:38px;background:#fff;border:3px solid var(--ink);border-radius:18px;padding:8px 24px;box-shadow:0 8px 0 var(--brand)}
.end{width:1920px;height:1080px;position:relative;overflow:hidden;background:var(--paper)}
.end .bg{position:absolute;inset:0;background:radial-gradient(circle at 12% 112%,#00A99D 0 520px,transparent 521px),radial-gradient(circle at 93% 12%,#FFC93C 0 80px,transparent 81px),#F6F5F1}
.end .l{position:absolute;left:130px;top:250px;width:760px}
.end .r{position:absolute;right:130px;top:200px;width:880px;text-align:right}
.end .b1{font-family:"Cairo";font-weight:900;font-size:150px;line-height:1.08;color:var(--ink)}
.end .b2{font-family:"Cairo";font-weight:900;font-size:84px;line-height:1.2;color:var(--ink);margin-top:6px}
.end .cta{margin-top:56px;display:inline-block;background:var(--primary);color:#fff;font-family:"Cairo";font-weight:900;font-size:62px;padding:24px 60px;border-radius:24px;box-shadow:0 12px 0 var(--ink)}
.end .url{margin-top:40px;direction:ltr;font-family:"Cairo";font-weight:900;font-size:64px;color:var(--ink)}
.end .sub{margin-top:30px;font-family:"Almarai";font-weight:800;font-size:40px;color:var(--primary)}
"""
FIT = """<script>
// shrink a title until it fits its 860px column (long ones: «مسار الدرس الكامل»، «مساعدة واقتراحات»)
document.fonts.ready.then(() => document.querySelectorAll('.ttl').forEach(t => {
  let f = 112; while (t.scrollWidth > 850 && f > 60) { f -= 4; t.style.fontSize = f + 'px'; }
}));
</script>"""
rows = []
rows.append('<div id="lk" class="o"><img class="lock" src="assets/lockup-ink.svg" alt=""></div>')
rows.append('<div id="pill_ai" class="o"><span class="pill">وضع العرض · محتوى تجريبي</span></div>')
rows.append('<div id="pill_acct" class="o"><span class="pill">حساب تجريبي · أسماء افتراضية</span></div>')
rows.append('''<div id="intro" class="o head intro"><div class="big">جولة كاملة<br>في <span class="mk">اقرأ</span></div>
<div class="sub">كل أدوات تحضير الحصة بتطبيق واحد<br>للمنهاج الأردني</div>
<div class="tags"><span>خطط وأوراق عمل</span><span>شرائح وأنشطة</span><span>ألعاب وتقييمات</span><span>شُعَب ورسائل</span></div></div>''')
for i, c in enumerate(CHAPTERS, 1):
    rows.append(f'<div id="c{i:02d}_h" class="o head"><div class="row"><span class="num">{ar(i)}</span><span class="grp">{c["group"]}</span></div><div class="ttl"><span class="mk">{c["title"]}</span></div></div>')
    for j, b in enumerate(c["bullets"], 1):
        rows.append(f'<div id="c{i:02d}_b{j}" class="o bul"><i>✓</i><span>{b}</span></div>')
rows.append('''<div id="end" class="o end"><div class="bg"></div>
<div class="l"><img src="assets/lockup-ink.svg" style="width:760px" alt=""></div>
<div class="r"><div class="b1">جرّبها <span class="mk">مجانًا</span></div><div class="b2">على درسك الجاي</div>
<div class="cta">أنشئ حساب معلم مجاني</div><div class="url">www.iqrra.com</div>
<div class="sub">اشترك في القناة لتصلك فيديوهات جديدة</div></div></div>''')
html = f'<!doctype html><meta charset="utf-8"><title>yt overlays</title>\n<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Almarai:wght@400;700;800&display=swap" rel="stylesheet">\n<style>{CSS}</style>\n' + "\n".join(rows) + "\n" + FIT
open("yt_overlays.html", "w").write(html)
print("wrote yt_overlays.html", len(rows), "elements")
