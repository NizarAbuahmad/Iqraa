import { useState } from 'react';

const INK = '#2A211B';
const CREAM = '#EFE6D2';
const PAPER = '#E4D7BC';
const TERRA = '#B4502B';
const OCHRE = '#C9912D';
const TAN = '#A98F66';

// ---------- geometric shape primitives (all live inside grid cells) ----------
function Shape({ type, color }) {
  const base = { backgroundColor: color };
  switch (type) {
    case 'circle':
      return <div className="w-full h-full rounded-full" style={base} />;
    case 'circleSmall':
      return <div className="w-1/2 h-1/2 m-auto rounded-full" style={base} />;
    case 'ring':
      return <div className="w-full h-full rounded-full" style={{ border: `3px solid ${color}` }} />;
    case 'quarterTL':
      return <div className="w-full h-full" style={{ ...base, borderTopLeftRadius: '100%' }} />;
    case 'quarterBR':
      return <div className="w-full h-full" style={{ ...base, borderBottomRightRadius: '100%' }} />;
    case 'quarterTR':
      return <div className="w-full h-full" style={{ ...base, borderTopRightRadius: '100%' }} />;
    case 'halfBottom':
      return <div className="w-full h-1/2 mt-auto" style={{ ...base, borderTopLeftRadius: '999px', borderTopRightRadius: '999px' }} />;
    case 'halfTop':
      return <div className="w-full h-1/2 mb-auto" style={{ ...base, borderBottomLeftRadius: '999px', borderBottomRightRadius: '999px' }} />;
    case 'triUp':
      return <div className="w-full h-full" style={{ ...base, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />;
    case 'triRight':
      return <div className="w-full h-full" style={{ ...base, clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />;
    case 'squareHalf':
      return <div className="w-full h-1/2 mt-auto" style={base} />;
    case 'diag':
      return <div className="w-full h-full" style={{ ...base, clipPath: 'polygon(0 100%, 100% 0, 100% 18%, 18% 100%)' }} />;
    default:
      return null;
  }
}

// 6 columns × 4 rows — every mark sits inside the visible grid
const COMPOSITION = [
  { t: 'quarterTL', c: OCHRE }, null, { t: 'circle', c: TERRA }, null, { t: 'halfBottom', c: TAN }, null,
  null, { t: 'triUp', c: TAN }, null, { t: 'quarterBR', c: OCHRE }, { t: 'diag', c: CREAM }, { t: 'circleSmall', c: TERRA },
  { t: 'ring', c: CREAM }, null, { t: 'squareHalf', c: TERRA }, null, { t: 'triRight', c: OCHRE }, null,
  null, { t: 'halfTop', c: TERRA }, { t: 'diag', c: TAN }, { t: 'circle', c: OCHRE }, null, { t: 'quarterTR', c: TAN },
];

// ---------- tier + comparison data ----------
const TIERS = [
  {
    id: 'stool',
    no: '01',
    name: 'The Stool',
    shape: 'circle',
    color: TERRA,
    monthly: 0,
    yearly: 0,
    blurb: 'A place to sit down with a language. One tongue, ten honest minutes a day.',
    cta: 'Take a seat',
    featured: false,
  },
  {
    id: 'workbench',
    no: '02',
    name: 'The Workbench',
    shape: 'square',
    color: OCHRE,
    monthly: 9,
    yearly: 7,
    blurb: 'The full surface. Four languages, every lesson, offline drawers included.',
    cta: 'Start building',
    featured: true,
  },
  {
    id: 'atelier',
    no: '03',
    name: 'The Atelier',
    shape: 'triangle',
    color: TERRA,
    monthly: 19,
    yearly: 15,
    blurb: 'The whole workshop. All twelve languages, a tutor at your elbow, no shortcuts.',
    cta: 'Enter the atelier',
    featured: false,
  },
];

const FEATURES = [
  { label: 'Daily lessons', values: ['10 min', 'Unlimited', 'Unlimited'] },
  { label: 'Languages on the bench', values: ['1', '4', 'All 12'] },
  { label: 'Native-speaker audio', values: [true, true, true] },
  { label: 'Offline workshop mode', values: [false, true, true] },
  { label: 'Pronunciation lab', values: [false, true, true] },
  { label: '1-on-1 tutor sessions', values: [false, false, '4 / mo'] },
  { label: 'Dovetail progress report', values: [false, false, true] },
];

function TierIcon({ shape, color, size = 28 }) {
  const s = { width: size, height: size };
  if (shape === 'circle') return <div className="rounded-full" style={{ ...s, backgroundColor: color }} />;
  if (shape === 'square') return <div style={{ ...s, backgroundColor: color }} />;
  return <div style={{ ...s, backgroundColor: color, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />;
}

function Mark({ value, accent }) {
  if (value === true) return <div className="w-3 h-3 mx-auto" style={{ backgroundColor: accent }} />;
  if (value === false)
    return <div className="w-3 h-3 mx-auto rounded-full" style={{ border: `2px solid ${INK}`, opacity: 0.3 }} />;
  return <span className="text-[13px]" style={{ fontWeight: 600 }}>{value}</span>;
}

export default function App() {
  const [billing, setBilling] = useState('yearly');

  return (
    <div className="min-h-screen w-full" style={{ fontFamily: "'Archivo', sans-serif", backgroundColor: CREAM, color: INK }}>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;900&display=swap" rel="stylesheet" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
            ::selection { background: ${TERRA}; color: ${CREAM}; }
            html { scrollbar-color: ${TAN} ${CREAM}; }
            .wb-cta:hover { background-color: ${INK} !important; color: ${CREAM} !important; }
            .wb-cta-inverse:hover { background-color: ${CREAM} !important; color: ${INK} !important; }
          `,
        }}
      />

      <div className="flex flex-col lg:flex-row">
        {/* ============================ LEFT — THE WORKSHOP ============================ */}
        <section
          className="w-full lg:w-1/2 lg:h-screen lg:sticky lg:top-0 flex flex-col"
          style={{ backgroundColor: INK, color: CREAM }}
        >
          <div className="flex flex-col h-full p-8 lg:p-12">
            {/* masthead */}
            <header className="flex items-baseline justify-between border-b pb-5" style={{ borderColor: 'rgba(239,230,210,0.25)' }}>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl" style={{ fontWeight: 900, letterSpacing: '-0.02em' }}>WERKBANK</span>
                <span className="text-[11px] uppercase" style={{ fontWeight: 600, letterSpacing: '0.22em', color: OCHRE }}>
                  School of Languages
                </span>
              </div>
              <span className="hidden sm:block text-[11px] uppercase" style={{ fontWeight: 400, letterSpacing: '0.18em', opacity: 0.65 }}>
                Sprachen · Langues · Lingue
              </span>
            </header>

            {/* headline */}
            <div className="pt-10 pb-8">
              <p className="text-[11px] uppercase mb-4" style={{ fontWeight: 600, letterSpacing: '0.3em', color: TAN }}>
                Catalogue Nº 4 — Pricing
              </p>
              <h1
                className="text-[2.6rem] lg:text-[3.6rem] leading-[0.98]"
                style={{ fontWeight: 900, letterSpacing: '-0.025em' }}
              >
                Fluency, joined
                <br />
                like fine <span style={{ color: TERRA }}>furniture.</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed" style={{ fontWeight: 400, color: PAPER }}>
                We build language courses the way a joiner builds a chair: nothing decorative,
                nothing missing, every lesson load-bearing. Choose the bench you'll learn at.
              </p>
            </div>

            {/* geometric composition — locked to a visible grid */}
            <div
              className="flex-1 min-h-[260px] grid grid-cols-6 grid-rows-4"
              style={{
                border: '1px solid rgba(239,230,210,0.25)',
                backgroundImage:
                  'linear-gradient(rgba(239,230,210,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(239,230,210,0.18) 1px, transparent 1px)',
                backgroundSize: 'calc(100% / 6) calc(100% / 4)',
              }}
            >
              {COMPOSITION.map((cell, i) => (
                <div key={i} className="relative flex">
                  {cell && <Shape type={cell.t} color={cell.c} />}
                </div>
              ))}
            </div>

            {/* spec strip */}
            <footer className="grid grid-cols-3 gap-6 pt-6 mt-6 border-t" style={{ borderColor: 'rgba(239,230,210,0.25)' }}>
              {[
                ['Joinery', 'Spaced repetition, hand-cut'],
                ['Finish', 'Native-speaker audio, oiled'],
                ['Tolerance', '± 0 filler words'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] uppercase mb-1" style={{ fontWeight: 600, letterSpacing: '0.22em', color: OCHRE }}>{k}</p>
                  <p className="text-[13px] leading-snug" style={{ fontWeight: 400, color: PAPER }}>{v}</p>
                </div>
              ))}
            </footer>
          </div>
        </section>

        {/* ============================ RIGHT — THE PRICE LIST ============================ */}
        <section className="w-full lg:w-1/2" style={{ backgroundColor: CREAM }}>
          <div className="p-8 lg:p-12">
            {/* header + toggle */}
            <header className="flex flex-wrap items-end justify-between gap-6 border-b-2 pb-6" style={{ borderColor: INK }}>
              <div>
                <p className="text-[11px] uppercase mb-2" style={{ fontWeight: 600, letterSpacing: '0.3em', color: TERRA }}>
                  Preisliste / Price List
                </p>
                <h2 className="text-3xl lg:text-4xl" style={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                  Measured twice.
                  <br />
                  Priced once.
                </h2>
              </div>

              <div className="flex" style={{ border: `2px solid ${INK}` }}>
                {[
                  ['monthly', 'Monthly'],
                  ['yearly', 'Yearly −20%'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setBilling(key)}
                    className="px-4 py-2 text-[12px] uppercase"
                    style={{
                      fontWeight: 600,
                      letterSpacing: '0.14em',
                      backgroundColor: billing === key ? INK : 'transparent',
                      color: billing === key ? CREAM : INK,
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>

            {/* tier cards */}
            <div className="mt-8 space-y-5">
              {TIERS.map((tier) => {
                const price = billing === 'yearly' ? tier.yearly : tier.monthly;
                const dark = tier.featured;
                return (
                  <article
                    key={tier.id}
                    className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-5 sm:gap-7 p-6 lg:p-7 items-center"
                    style={{
                      border: `2px solid ${INK}`,
                      backgroundColor: dark ? INK : PAPER,
                      color: dark ? CREAM : INK,
                    }}
                  >
                    {/* icon + index */}
                    <div className="flex sm:flex-col items-center gap-3">
                      <TierIcon shape={tier.shape} color={tier.color} size={34} />
                      <span className="text-[11px]" style={{ fontWeight: 600, letterSpacing: '0.2em', opacity: 0.6 }}>
                        {tier.no}
                      </span>
                    </div>

                    {/* name + blurb */}
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl lg:text-2xl" style={{ fontWeight: 900, letterSpacing: '-0.01em' }}>
                          {tier.name}
                        </h3>
                        {dark && (
                          <span
                            className="text-[10px] uppercase px-2 py-1"
                            style={{ fontWeight: 600, letterSpacing: '0.2em', backgroundColor: OCHRE, color: INK }}
                          >
                            Most built
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[14px] leading-relaxed max-w-sm" style={{ fontWeight: 400, opacity: dark ? 0.85 : 0.8 }}>
                        {tier.blurb}
                      </p>
                    </div>

                    {/* price + cta */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-3 justify-between">
                      <div className="text-right">
                        <div className="flex items-start justify-end">
                          <span className="text-[15px] mt-1 mr-1" style={{ fontWeight: 600 }}>€</span>
                          <span className="text-4xl lg:text-5xl leading-none" style={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                            {price}
                          </span>
                        </div>
                        <p className="text-[11px] uppercase mt-1" style={{ fontWeight: 400, letterSpacing: '0.14em', opacity: 0.6 }}>
                          {price === 0 ? 'forever' : `per month, ${billing}`}
                        </p>
                      </div>
                      <button
                        className={dark ? 'wb-cta-inverse' : 'wb-cta'}
                        style={{
                          border: `2px solid ${dark ? CREAM : INK}`,
                          padding: '10px 18px',
                          fontWeight: 600,
                          fontSize: 12,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                          backgroundColor: dark ? TERRA : 'transparent',
                          color: dark ? CREAM : INK,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tier.cta}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* comparison table */}
            <div className="mt-12">
              <p className="text-[11px] uppercase mb-4" style={{ fontWeight: 600, letterSpacing: '0.3em', color: TERRA }}>
                Joint-by-joint comparison
              </p>

              <div style={{ border: `2px solid ${INK}` }}>
                {/* table head */}
                <div
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center"
                  style={{ backgroundColor: INK, color: CREAM }}
                >
                  <div className="px-4 py-3 text-[11px] uppercase" style={{ fontWeight: 600, letterSpacing: '0.18em' }}>
                    Specification
                  </div>
                  {TIERS.map((t) => (
                    <div key={t.id} className="px-2 py-3 flex items-center justify-center gap-2">
                      <TierIcon shape={t.shape} color={t.color} size={12} />
                      <span className="text-[11px] uppercase" style={{ fontWeight: 600, letterSpacing: '0.12em' }}>
                        {t.name.replace('The ', '')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* rows */}
                {FEATURES.map((row, i) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center"
                    style={{
                      backgroundColor: i % 2 === 0 ? CREAM : PAPER,
                      borderTop: `1px solid ${INK}`,
                    }}
                  >
                    <div className="px-4 py-3 text-[13px]" style={{ fontWeight: 600 }}>
                      {row.label}
                    </div>
                    {row.values.map((v, j) => (
                      <div key={j} className="px-2 py-3 text-center">
                        <Mark value={v} accent={j === 1 ? OCHRE : TERRA} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* legend + footnote */}
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                <div className="flex items-center gap-5">
                  <span className="flex items-center gap-2 text-[12px]" style={{ fontWeight: 400 }}>
                    <span className="w-3 h-3 inline-block" style={{ backgroundColor: TERRA }} /> included
                  </span>
                  <span className="flex items-center gap-2 text-[12px]" style={{ fontWeight: 400 }}>
                    <span className="w-3 h-3 inline-block rounded-full" style={{ border: `2px solid ${INK}`, opacity: 0.4 }} /> not fitted
                  </span>
                </div>
                <p className="text-[12px]" style={{ fontWeight: 400, opacity: 0.65 }}>
                  Every plan hand-assembled in Munich. Cancel anytime — no tools required.
                </p>
              </div>
            </div>

            {/* guarantee strip */}
            <div
              className="mt-10 grid grid-cols-1 sm:grid-cols-3"
              style={{ border: `2px solid ${INK}` }}
            >
              {[
                ['30 days', 'Sit with any plan. Full refund if it wobbles.'],
                ['12 languages', 'From German to Japanese, all cut from solid stock.'],
                ['1.4M learners', 'Speaking daily at a Werkbank near them.'],
              ].map(([big, small], i) => (
                <div
                  key={big}
                  className="px-5 py-5"
                  style={{ borderLeft: i > 0 ? `2px solid ${INK}` : 'none' }}
                >
                  <p className="text-2xl" style={{ fontWeight: 900, letterSpacing: '-0.02em', color: i === 1 ? TERRA : INK }}>
                    {big}
                  </p>
                  <p className="text-[13px] mt-1 leading-snug" style={{ fontWeight: 400, opacity: 0.75 }}>
                    {small}
                  </p>
                </div>
              ))}
            </div>

            <footer className="mt-10 pt-5 border-t flex items-center justify-between" style={{ borderColor: INK }}>
              <span className="text-[11px] uppercase" style={{ fontWeight: 600, letterSpacing: '0.22em' }}>
                Werkbank GmbH — Form follows fluency
              </span>
              <span className="text-[11px]" style={{ fontWeight: 400, opacity: 0.6 }}>
                Catalogue Nº 4 · 2025
              </span>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}