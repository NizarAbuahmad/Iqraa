/**
 * Blind rating page for a provider-eval run.
 *
 * Groups every answer to the same request (task × lesson, or chat scenario),
 * shuffles the providers behind letters A, B, C… per group, and writes:
 *   blind.html      — side-by-side page; picks build a votes line to paste back
 *   blind-key.json  — which letter was which provider, per group
 *
 * The page carries no provider or model names, so the rater cannot know who
 * wrote what. A model that reads better because you knew which one it was is
 * not evidence (see provider-eval.ts).
 *
 * Run: node artifacts/api-server/scripts/blind-rate.mjs eval-out/<runId>
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node blind-rate.mjs eval-out/<runId>");
  process.exit(2);
}
const key = JSON.parse(readFileSync(join(dir, "key.json"), "utf8"));
const rawFile = (id) => join(dir, "raw", `${id}.json`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function render(v) {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return `<ul>${v.map((x) => `<li>${render(x)}</li>`).join("")}</ul>`;
  if (typeof v === "object")
    return `<dl>${Object.entries(v).map(([k, x]) => `<dt>${esc(k)}</dt><dd>${render(x)}</dd>`).join("")}</dl>`;
  return `<span class="t">${esc(v)}</span>`;
}

function body(id) {
  const r = JSON.parse(readFileSync(rawFile(id), "utf8"));
  if (r.transcript) {
    return r.transcript
      .map((t) => `<div class="${t.role}"><b>${t.role === "user" ? "المعلّم" : "المساعد"}</b><span class="t">${esc(t.content)}</span></div>`)
      .join("");
  }
  return render(r.output);
}

// Usable answers only: an errored call has nothing to rate.
const groups = new Map();
for (const [id, m] of Object.entries(key)) {
  if (m.error || !existsSync(rawFile(id))) continue;
  if (id.startsWith("s") && !m.parsed) continue;
  const label = id.startsWith("c") ? `chat — ${m.scenario}` : `${m.task} — ${m.topic}`;
  if (!groups.has(label)) groups.set(label, []);
  groups.get(label).push(id);
}
const rated = [...groups].filter(([, ids]) => ids.length >= 2);

const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const blindKey = {};
const sections = rated.map(([label, ids], gi) => {
  const n = gi + 1;
  const order = shuffle(ids);
  const letters = order.map((_, i) => String.fromCharCode(65 + i));
  blindKey[n] = { group: label, ...Object.fromEntries(order.map((id, i) => [letters[i], key[id].provider])) };
  const picks = [...letters, "="]
    .map((c) => `<label><input type="radio" name="g${n}" value="${c}"> ${c === "=" ? "متساوية" : c}</label>`)
    .join(" ");
  return `<section><h2>${n}. ${esc(label)}</h2><div class="pick">الأفضل: ${picks}</div>
<div class="cols" style="--n:${order.length}">${order.map((id, i) => `<article><h3>${letters[i]}</h3>${body(id)}</article>`).join("")}</div></section>`;
});

writeFileSync(join(dir, "blind-key.json"), JSON.stringify(blindKey, null, 2));
writeFileSync(join(dir, "blind.html"), `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Blind rating</title>
<style>
body{font-family:system-ui,"Segoe UI",Tahoma,sans-serif;margin:0 auto;max-width:1600px;padding:16px;background:#fff;color:#1a1a1a;line-height:1.6}
.cols{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:16px}@media(max-width:900px){.cols{grid-template-columns:1fr}}
article{border:1px solid #ccc;border-radius:8px;padding:12px;overflow-wrap:anywhere}h3{margin:0 0 8px;color:#006D65}
dt{font-weight:600;color:#555;margin-top:6px;font-size:.85em}dd{margin:0 12px 0 0}section{margin-bottom:40px}
.t{white-space:pre-wrap}.user{background:#f3f3f3;border-radius:6px;padding:6px;margin:6px 0}.assistant{padding:6px;margin:6px 0}
.user b,.assistant b{display:block;font-size:.8em;color:#555}
.pick{background:#eef7f6;padding:8px 12px;border-radius:8px;margin-bottom:8px;position:sticky;top:0;z-index:1}
#out{width:100%;font-size:1.1em;padding:8px;direction:ltr;box-sizing:border-box}
</style></head><body>
<h1>تقييم أعمى: أي نسخة أفضل للمعلّم؟</h1>
<p>Each group is the same request answered by different AI models, shuffled behind letters per group.
Judge the Arabic, the teaching and the accuracy. Then copy the line at the bottom into the chat.</p>
${sections.join("\n")}
<h2>Your votes</h2><input id="out" readonly onclick="this.select()">
<script>
const n=${rated.length};
function upd(){const v=[];for(let i=1;i<=n;i++){const c=document.querySelector('input[name=g'+i+']:checked');v.push(i+':'+(c?c.value:'?'))}document.getElementById('out').value=v.join(' ')}
document.addEventListener('change',upd);upd();
</script></body></html>`);
console.log(`${rated.length} groups written to ${join(dir, "blind.html")}`);
