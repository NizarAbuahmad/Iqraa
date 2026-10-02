# Iqraa — Marketing plan, foundation to expansion

_Written 2026-10-02 against `main` @ `cd7e07a`. Grounded in `STATUS.md`,
`marketing/play-store/README.md` and the assets already in `marketing/`.
Every number marked **(assumption)** is a driver to test, not a fact — replace
it with measured data as soon as a pilot produces any._

This is a plan for a solo, pre-funding founder. It spends relationships and
content before it spends cash, and every phase ends with evidence (usage,
testimonials, LOIs) that the next phase and the fundraise both need.

---

## 0. Where we actually are (the honest baseline)

What marketing can truthfully say today, and what it must not say yet:

| Can say today | Cannot say yet (do not claim) |
| --- | --- |
| Arabic-first, RTL, built for the Jordanian national curriculum. Lesson picker is the real NCCD book structure. | "Full AI generation" on the web app — `DEMO_MODE` is on for the web build; most prose is mocked and labelled «وضع العرض · محتوى تجريبي». Only slides-from-prompt and lesson-teaching sections call live AI. |
| Maths answer keys are symbolically verified (SymPy), labelled per key, and unverifiable keys say so. | "Every subject is equally grounded." Grade 10 maths + chemistry are the deep, verified wedge; Grades 1–10 books are registered at varying depth (some shipped, some figures blocked, Arabic/Islamic carry no extractable figures). |
| Full lesson journey: plan → slides → activity → worksheet → quiz → exit ticket, plus evaluations with exam scanning. | "Available on Google Play / App Store." The `.aab` is built; the closed test (12 testers × 14 days) has not started; there is no iOS build. |
| Free, no-login games hub (`/play`) and free English corner for Grades 1–4. | "Trusted by N schools." Zero pilots recorded. |
| Teacher ↔ parent ↔ student messaging, class rosters, join codes. | Any price. There is no billing integration in the repo. |

Assets already built (reuse, don't rebuild): Play listing copy AR/EN, icon and
feature graphic, a 9:16 teacher reel (five music variants), tutorial Part 1
(1:51, Arabic captions, YouTube description written), demo account, admin
dashboard with growth/email/user metrics, PostHog instrumentation.

Known brand hazards:

- **Name collision.** "Iqraa" on Google Play is an existing Qur'an app and
  `iqraa-web.pages.dev` belongs to that company. Our listing title is
  «اقرأ — رفيقك في تحضير الحصص» precisely to be distinct. All SEO and ad copy
  must carry the qualifier («اقرأ للمعلمين» / "Iqraa for teachers"), never the
  bare word.
- **Spelling drift.** The domain is `iqrra.com` (double r), the product writes
  "Iqraa". Pick one Latin spelling for every public surface before launch. The
  domain we own wins unless `iqraa.*` can be acquired cheaply.
- **The wedge is also the risk.** Curriculum grounding is the only thing
  ChatGPT and MagicSchool structurally cannot copy for Jordan. If marketing
  ever claims grounding the product does not have, the differentiator dies
  and so does the company. Every claim in this plan is scoped to what
  `STATUS.md` verifies.

---

## 1. Strategy in one page

**Positioning.** «ليس روبوت دردشة آخر — مساعد معلّم يعرف المنهاج الأردني فعلًا.»
*Not another AI chatbot — a teacher's assistant that actually knows the
Jordanian curriculum.* Every message leads with the book, the lesson, and the
verified key; "AI" is the how, never the headline.

**Core promise (the activation metric).** A teacher opens the lesson they teach
tomorrow and leaves with a plan, slides and a worksheet in under 10 minutes.
«حصة الغد جاهزة قبل القهوة.» If a teacher does this once in their first
session, they stay. Everything in the funnel is designed to get them to that
moment.

**Beachhead.** Private-school Grade 10 maths and chemistry teachers in Amman.
Narrow on purpose: it is where grounding and verification are deepest, where
teachers can pay individually, and where the economic buyer (academic director
/ owner) is reachable through the founder's own relationships. Widen by grade
and subject only as the books ship and retention is proven.

**Motion.** Land the teacher (B2C, free then paid) → prove usage inside a
school → convert the school to a per-seat package (B2B) → use the school as a
reference for the next three. Students and parents are a retention and
word-of-mouth layer (messaging, join codes), not a separate acquisition
target until 2028.

**Sequencing.**

| Phase | Window | Goal | Exit evidence |
| --- | --- | --- | --- |
| 0 — Foundation | Oct–Nov 2026 | Make every public claim true, put the plumbing in, recruit design partners | Play closed test running with ≥12 testers; landing page live; analytics on all 3 surfaces; 20 design-partner teachers; WTP survey done |
| 1 — Pilot & launch | Dec 2026 – Feb 2027 | 3–5 pilot schools, Play production listing, public launch at Semester 2 | ≥100 registered teachers, ≥40 weekly-active, 3 school testimonials, ≥3 signed LOIs, first paid conversions |
| 2 — Scale Jordan | Mar – Sep 2027 | Paid acquisition that pays back, B2B contracts for 2027/28, back-to-school launch | ≥1,000 registered teachers, ≥8 paying schools, CAC by channel measured, LTV/CAC ≥3 on the conservative case |
| 3 — Expand | Oct 2027 – 2028 | Replicate the playbook in one market whose curriculum we have localised | First non-Jordan curriculum grounded; 1 partner-led pilot cluster in the Gulf |

School-year calendar driving the dates: Semester 1 ends mid/late January;
Semester 2 opens early February; Ramadan 1448 runs ~7 Feb – 8 Mar 2027;
Tawjihi season June–July; private schools decide next year's platforms
April–June; the 2027/28 year opens late August / early September 2027.

---

## 2. Audiences

### Primary — the teacher (B2C adopter, B2B champion)

- Private-school teacher in Amman, Grades 9–10 maths/chemistry first; 25–45;
  preps on a phone and a laptop at night; already pasting into ChatGPT and
  getting generic, untranslated, un-curricular output.
- Pain, in their words: «التحضير ياخذ المسا كله»، «شات جي بي تي ما بعرف
  منهاجنا»، «بدي ورقة عمل على الدرس نفسه مش على الموضوع بشكل عام».
- Where they are: teacher WhatsApp/Telegram groups, Facebook groups
  («معلمو ومعلمات الأردن», subject-specific groups), TikTok/Instagram teacher
  creators, YouTube for lesson explanations, staff rooms.
- Secondary teacher segments, in order of readiness: public-school teachers
  (large, price-sensitive, reachable via the same groups; free tier), Grade
  7–9 science, Grades 1–4 English (the free corner is the door).

### Economic buyer — the school

- Academic director / principal / owner of a private school with 30–150
  teachers. Cares about standardised, curriculum-aligned materials,
  teacher-time, parent communication, and something to show the ministry
  supervisor. Buys per seat for a school year, decides April–June.

### Amplifiers

- Supervisors (مشرفون تربويون), subject coordinators, teacher-trainers, and
  teacher creators with 10k–200k followers. They do not pay; they refer.

### Deferred

- Students and parents: present in product (join codes, messaging, practice).
  Marketed only through the teacher («أرسل رمز الربط لأولياء الأمور») until
  2028. Direct student acquisition needs a different brand promise and
  compliance posture; do not dilute the teacher story.

---

## 3. Offer and pricing hypotheses (to test in Phase 0–1)

No price exists in the product today. These are **assumptions** to put in
front of pilot teachers with a Van Westendorp survey and in front of three
school owners in conversation; the model, not the marketing plan, owns the
final numbers.

| Tier | Hypothesis | Why |
| --- | --- | --- |
| Free | Lesson picker, 5 generations/month, `/play`, English corner, messaging | The door. Must be enough to hit the 10-minute promise once. |
| Teacher Pro | 5 JD/month or 39 JD/year **(assumption)** | Anchored to hours saved per week, not to US SaaS pricing. Annual is priced to pull people off monthly. |
| School seats | Per seat per year, stepped: 10–24 seats 40 JD, 25–49 seats 32 JD, 50–99 seats 25 JD, 100+ seats 20 JD **(assumption)** | Per-seat tiers, never a flat per-school fee. Larger schools pay more in total, less per seat. Include admin dashboard, school-wide material library, parent messaging. |
| Pilot | Free for one semester with written success criteria and an LOI at the end | Converts "I know this school" into "this school wants this". |

Launch offers: founding-teacher annual at a visible discount for the first 200
accounts; school early-bird for contracts signed before 30 June 2027.

Prerequisite: pick a payment rail (local cards + CliQ for individuals;
invoice/bank transfer for schools). Until that ships, "paid" means an invoice
sent by the founder — fine for schools, not for teachers.

---

## 4. Messaging and content system

### Message house

- **Roof:** «اقرأ — رفيقك في تحضير الحصص. مبنيّ على كتابك، لا على محتوى عام.»
- **Pillars** (each becomes a content series and an ad angle):
  1. **من الكتاب نفسه** — pick the lesson, get material built on that lesson's
     objectives, examples and figures.
  2. **مفتاح إجابة مُتحقَّق منه** — maths keys go through a symbolic verifier;
     the badge shows what was proved and what wasn't.
  3. **حصة كاملة، مش نص** — plan → slides → activity → worksheet → quiz → exit
     ticket, in the teaching style you pick.
  4. **عربي أولًا** — RTL, Arabic digits, Jordanian register. Not a translation.
  5. **صفّك كله في مكان واحد** — roster, parent messages, evaluations, scanned
     exam marks.
- **Proof points to attach:** screen-recorded verification badge; the lesson
  picker showing the real unit/lesson tree; before/after prep-time quotes from
  pilot teachers; the teacher's own book figure appearing in a worksheet.

### Content pillars and cadence (from Phase 0, organic)

| Series | Format | Cadence | Channel |
| --- | --- | --- | --- |
| «حضّر معي» — one real lesson prepped in 60–90 seconds | 9:16 screen reel with Arabic captions (the existing reel pipeline) | 3/week | TikTok, Instagram Reels, YouTube Shorts, Facebook |
| «الجزء الثاني/الثالث…» tutorial series | 2-min landscape tutorials (existing pipeline) | 1 every 2 weeks | YouTube, WhatsApp groups, in-app help |
| «ورقة الأسبوع» — a free, downloadable worksheet for a lesson being taught that week, verified key included | PDF + carousel | weekly, follows the pacing plan | WhatsApp groups, Facebook, email |
| «من غرفة المعلمين» — teacher stories and prep hacks | carousel / short interview | weekly | Instagram, LinkedIn |
| «هل تعرف أن…» — curriculum facts, exam-pattern insights, Tawjihi prep tips | static / carousel | 2/week | all |
| Founder notes — building an Arabic edtech in Jordan, transparently | LinkedIn post / thread | weekly | LinkedIn, X |
| Blog / SEO | long-form Arabic articles targeting «تحضير درس + [lesson name]», «ورقة عمل + [lesson]», «خطة درس + [subject] الصف العاشر» | 2/week from Phase 1 | iqrra.com |

Rules:

- Every reel names the grade, subject and lesson on screen. Generic "AI for
  teachers" clips do not run.
- Everything shown in a video is captured from the real app. If a generation
  is demo content, the caption says so (the tutorial description already does).
- Content follows the Ministry pacing plan: publish the worksheet for the
  lesson teachers are on *this week*. That is the whole SEO and share loop.
- Arabic is rendered by a browser, never by ffmpeg (see `marketing/tutorial/README.md`).

### SEO foundation (Phase 0, cheap, compounding)

- One landing page per subject × grade, one per lesson later, each with a
  sample worksheet and a «حضّر هذا الدرس» CTA deep-linking into the picker
  with the KB id (never a bare topic string — see `CLAUDE.md`).
- Target queries: «تحضير درس [X] الصف العاشر», «ورقة عمل [X]», «خطة درس
  رياضيات عاشر», «اختبار كيمياء عاشر الفصل الأول», «اقرأ للمعلمين».
- Open Graph images per page, Arabic `lang`/`dir`, sitemap, Search Console.
- Brand query defence: rank for «اقرأ للمعلمين» and «iqrra» above the
  Qur'an app; buy both as branded search terms in Phase 2.

---

## 5. Channels, by phase

### Phase 0 — Foundation (Oct–Nov 2026)

**Goal:** every public claim is true, every surface measures, and the first 20
teachers are real design partners, not friends being polite.

Product/ops prerequisites marketing depends on (owner: founder, with engineering):

1. Confirm `info@iqrra.com` is a real, monitored mailbox; it is now the legal
   and Play contact address.
2. Register one real account end to end on production and watch the
   verification email land (not spam) before inviting anyone.
3. Start the Play **closed test**: 12+ opted-in testers for 14 continuous
   days. These 12 are the first design partners (see below). Clear the
   Google Sign-In fingerprint issue in `marketing/play-store/README.md`
   first, or day one is a wall of failed sign-ins.
4. `EXPO_PUBLIC_POSTHOG_API_KEY` declared in all three places (web deploy,
   `eas.json` profiles, OTA workflow) so the funnel is not half-blind.
5. A claims audit of every public string: onboarding carousel, Play listing,
   landing page, reel captions. Scope every "grounded in the book" sentence
   to what ships. Decide the one Latin spelling.
6. Decide the live-AI posture for launch: either `DEMO_MODE` off on web with
   `AI_LIVE_MODE` and a budget, or keep demo mode and say «محتوى تجريبي»
   loudly in the UI. Marketing cannot run a "try it free" campaign against
   mocked prose without the label; it will read as a fake product.
7. Legal check on commercial use of Ministry textbook content (the
   NCCD-sourced books). Get an opinion, and ideally a letter, before paid
   acquisition starts. This is a company-level risk, not a marketing nicety.

Marketing deliverables:

- **Brand kit v1** — logo lockups (AR/EN), navy/teal/gold palette, Arabic
  type pairing, reel and carousel templates, screenshot frames. Two days of
  work; everything downstream reuses it.
- **Landing page on `iqrra.com`** — hero reel, the five pillars with real
  screenshots, «جرّبها مجانًا» → `app.iqrra.com`, Play "join the test" link,
  teacher waitlist form, school enquiry form, privacy/terms. Arabic default,
  English toggle.
- **Social accounts** — Instagram, TikTok, Facebook page, YouTube, LinkedIn
  company page, X. Handle `@iqrra` everywhere it is free; `@iqrra.jo` or
  `@iqrraapp` as fallback. Bio, link, pinned reel, 9 posts before anyone is
  pointed at them.
- **Design-partner programme («شركاء التصميم»)** — 20 teachers, recruited
  through the founder's school relationships and two teacher WhatsApp
  groups. Deal: free Pro for a year, a WhatsApp group with the founder,
  monthly 30-minute call. They give: the 12 Play testers, weekly feedback,
  the WTP survey, the first testimonials, and the first referral seeds.
- **Pilot kit for schools** — one-page Arabic offer, pilot agreement with
  success criteria (≥60% of enrolled teachers activate in week 1; ≥40%
  weekly-active by week 6; ≥3 materials/teacher/week), a 20-minute staff
  room demo script, and the LOI template.
- **World Teachers' Day, 5 Oct 2026** — three days away. Post the teacher
  reel with a «شكرًا لمعلمي الأردن» message and open the design-partner
  form. Low effort, first dated public moment.
- **Measurement set-up** — PostHog funnel: landing → signup → verified →
  lesson picked → first material → 3 materials in 7 days → week-4 return.
  UTM scheme fixed now, used everywhere forever.

Budget **(assumption)**: 150–400 JD/month — domain/email, a Canva or Figma
seat, stock music licences for reels, small boosts on the two best reels to
find the creative that works. No campaigns yet.

### Phase 1 — Pilot and public launch (Dec 2026 – Feb 2027)

**Goal:** turn relationships into evidence, then launch publicly at the
Semester 2 opening with real teacher proof.

**Pilots (the core of the phase).**

- 3–5 private schools in Amman, 8–15 teachers each, starting the first week of
  December so there are six weeks of data before Semester 1 exams.
- Sequence per school: warm intro → 20-minute staff-room demo (the founder,
  in person, with the projector mode) → WhatsApp group per school →
  weekly usage report to the academic director (from the admin dashboard) →
  end-of-semester review meeting → LOI or paid seats for Semester 2.
- Exam season (January) is the moment to show evaluations and exam scanning;
  schedule the review meetings right after.
- Each pilot produces: a named testimonial, a 60-second teacher interview
  reel, one "hours saved" number, and an LOI. Three LOIs are the minimum
  artefact for a pre-seed conversation.

**Play Store production.** Closed test ends ~mid-December if it starts by
1 November; apply for production, publish in January; screenshots are real
captures from the pilot period. The Play launch is a content moment, not the
launch.

**Public launch — first week of Semester 2 (early February 2027).**

- Why then: teachers are planning a fresh semester, Ramadan starts a week
  later and compresses the school day (shorter lessons = more demand for
  ready-made, compact material), and we will have pilot proof.
- Launch package: landing page refresh with testimonials; "founding teacher"
  annual offer; tutorial Parts 2–3 (classes, evaluations, exam scanning);
  press release and three pitched stories (§7); 10 teacher creators seeded
  (§8); a 2-week reel sprint (one real lesson a day, Semester 2 units);
  WhatsApp broadcast to every group the founder is in; LinkedIn founder post
  with the pilot numbers.
- Ramadan content track («حصة رمضانية في ٣٠ دقيقة»): compressed-lesson plans
  and short activities for the shortened timetable, published daily for the
  first two weeks. Native to the moment, not a greeting card.

**Referral loop.** In-product «ادعُ زميلًا»: both sides get a month of Pro.
Teacher-to-teacher is the cheapest channel in this market; build it before
spending on ads.

**Community.** Open a Telegram/WhatsApp community channel «معلمو اقرأ» for
weekly worksheet drops, release notes in plain Arabic, and office hours.
Moderated, announcement-first (same posture as in-app groups).

Budget **(assumption)**: 400–900 JD/month — creator seeding (product +
small fees), press outreach tooling, boosted launch reels, printed one-pagers
for staff rooms, travel between schools.

Exit evidence: ≥100 registered teachers, ≥40 weekly-active, activation rate
and D30 retention measured, 3 testimonials, ≥3 LOIs, first paid conversions,
Play listing live.

### Phase 2 — Scale in Jordan (Mar – Sep 2027)

**Goal:** a repeatable acquisition machine for teachers and a B2B pipeline that
signs schools for the 2027/28 year.

**Paid acquisition (teachers).** Hand execution to the Meta ads playbook; the
plan-level rules are:

- Meta (Facebook + Instagram) is the primary paid channel; Jordanian teachers
  are on Facebook in numbers and on Instagram/TikTok for reels. TikTok ads
  second, once the organic reels show what hooks. Google Search on «تحضير
  درس / ورقة عمل + lesson» and on brand terms, small and always-on. YouTube
  pre-roll on Jordanian lesson-explanation channels in the back-to-school
  window.
- Campaign structure: one conversion campaign optimised to "first material
  generated" (server event via Conversions API, not "signup"), one
  retargeting set for signed-up-not-activated, one lookalike from activated
  teachers once there are 500+. Creative is the «حضّر معي» reels; test hook
  lines, not formats.
- Targeting: Jordan, 23–50, interests in education/teaching, job titles
  teacher/معلم, lookalikes from the pilot list. Exclude existing users.
- Guardrails: start at 20–30 JD/day; scale only while cost per activated
  teacher stays under the number the model says CAC can bear (set it from
  the Phase 1 ARPU and churn; **assumption** until then: ≤ 8 JD per
  activated teacher). Report CAC by channel into the financial model monthly.

**B2B sales motion (schools).**

- Target list: 60 private schools in Amman, Zarqa, Irbid with 30+ teachers;
  prioritised by existing relationship, then by pilot-school referrals.
- Cadence: April–June is the decision window. Two staff-room demos a week,
  every pilot school's academic director as a reference call, early-bird
  pricing until 30 June, contracts for seats starting September.
- Collateral: school case study (one page, numbers, quotes), seat-tier
  price sheet, a 10-minute "school admin dashboard" video, a ministry-style
  lesson-plan export sample (the form supervisors ask for).
- Offer «تدريب مجاني للكادر» (a 90-minute on-site onboarding) with every
  school contract; it is a sales tool disguised as training.

**Events and institutions.**

- Jordan's private-school associations and owners' networks: a sponsored
  slot or a demo table at their spring meeting.
- Queen Rania Teacher Academy and Jordan Education Initiative: seek a
  listing, a workshop slot, or a co-branded webinar. Credibility beats reach
  here.
- Apply to one accelerator or programme (Oasis500, Orange Corners Jordan,
  or an edtech-specific cohort) for the PR and investor signal as much as
  the money.
- Queen Rania Award for Excellence in Education: nominate pilot teachers
  and support their applications with Iqraa materials. Reflected glory,
  earned honestly.

**Seasonal campaigns.**

- **Tawjihi season (May–July):** «مراجعة التوجيهي» content, but only once
  Grade 11–12 books are grounded; otherwise run Grade 10 end-of-year
  revision packs and stay honest about scope.
- **Summer (July–August):** «جهّز سنتك قبل ما تبدأ» — teachers who prep the
  first unit over summer convert to annual. Also the window for school
  onboarding sessions.
- **Back-to-school (last week of August – September 2027):** the biggest
  spend window of the year — 40% of the annual paid budget. Launch Part 4+
  tutorials, the new-year unit worksheets for every shipped book, and a
  school-wide «أول أسبوع جاهز» pack.

**Influencer programme at scale** (§8) and **PR cadence** (§7) run through
this phase.

Budget **(assumption)**: 1,500–4,000 JD/month, of which paid media 60%,
creators 20%, events/collateral 20%. Fund it from Phase 1 school revenue
where possible; otherwise this is the first line of the pre-seed use of
funds.

Exit evidence: ≥1,000 registered teachers, ≥300 weekly-active during term,
≥8 paying schools, measured CAC by channel, LTV/CAC ≥ 3 on the conservative
case, one quarter of retention data. If LTV/CAC is under 3, fix pricing or
retention before scaling spend — a bigger budget does not fix a leaky funnel.

### Phase 3 — Expand beyond Jordan (Oct 2027 – 2028)

**The constraint is curriculum, not demand.** The moat is grounding in a
specific national curriculum, so a market only opens once its books are in
the knowledge base and verified to the same standard. Sequence by
localisation feasibility × size × access, not size alone.

Candidate sequence **(hypotheses, validate with 10 teacher interviews per
market before any spend)**:

| Market | Why | How in | Risk |
| --- | --- | --- | --- |
| **Palestine** | Closest curriculum lineage, same Arabic register, teachers already in the same online groups | Pure digital: the same reels and groups, Palestinian-curriculum books grounded; partner with a local teacher-training NGO | Low willingness to pay, payment rails, connectivity; treat as reach and proof, not revenue |
| **Saudi Arabia** | Largest Arabic market, single national curriculum, big private-school sector, strong edtech appetite, government push on teacher tools | Localise MoE books; sell through a licensed local distributor/reseller (required for schools); Jordanian expat teachers in KSA private schools as the first users | Regulatory and data-residency expectations, reseller margins, a different brand register; needs a local partner before launch |
| **UAE** | Many private schools, high WTP, MoE Arabic-curriculum stream across all curricula, large Jordanian teacher diaspora; GESS Dubai is the regional edtech event | Enter via Arabic/Islamic-studies departments of international schools (every curriculum in the UAE must teach MoE Arabic) and via Jordanian-teacher networks; distributor for school contracts | Fragmented curricula; English-first procurement; crowded with global tools |
| **Kuwait / Qatar / Oman** | Single curricula, smaller markets, Jordanian teachers everywhere | Partner-led after KSA/UAE playbook is proven | Small; do not spend here first |
| **Egypt** | Huge teacher base, Arabic, active edtech | Only after a freemium funnel proves it can monetise at low ARPU | Price points 3–5× lower; needs a different model |

The Jordanian teacher diaspora is the bridge for every Gulf market: a Grade
10 maths teacher in a Riyadh or Dubai private school who learned Iqraa in
Amman is the warm intro. Marketing in Phase 2 should already tag and keep
in touch with teachers who move.

Per-market entry checklist:

1. Books grounded and verified for at least the wedge subjects; the claims
   audit repeated against that market's scope.
2. Arabic copy re-registered (Gulf vs Levant register), currency, legal
   entity or partner, data/privacy posture, payment rails.
3. 10 teacher interviews and 3 school conversations before a dinar of spend.
4. Partner-led: a distributor or training provider that already sells to
   schools in that market; co-market, don't cold-sell from Amman.
5. One event: GESS Dubai (November) or a KSA edtech event, with a Jordanian
   case study as the proof.
6. Same measurement set, same activation metric, same kill criteria.

Budget: per market, not blended, and only after the Jordan model clears its
thresholds. Treat the first market as a 6-month experiment with a stated
stop condition (e.g., fewer than 100 weekly-active teachers after 4 months).

---

## 6. Advertising plan (summary; execution per the Meta ads playbook)

| Channel | Role | Phase | Creative | KPI |
| --- | --- | --- | --- | --- |
| Meta (IG/FB) | Primary teacher acquisition + retargeting | 2–3 | «حضّر معي» reels, testimonial reels, worksheet-of-the-week lead magnets | Cost per activated teacher; CAC by channel |
| TikTok | Reach among younger teachers, creator amplification | 2 | Same reels, creator-native cuts | CPM, follow rate, signups |
| Google Search | Intent capture + brand defence | 1 (brand) / 2 (generic) | Lesson-level landing pages | Cost per signup, brand SOV |
| YouTube | Tutorials as ads in back-to-school window | 2 | Pre-roll cut of tutorial Part 1 | View-through signups |
| LinkedIn | School decision-makers and investors | 2 | Founder posts, case studies; small sponsored reach to principals | Demo requests |
| WhatsApp Business | Owned channel for broadcasts and school follow-up | 1 onward | Weekly worksheet drop, release notes | Open rate, click to app |
| Offline | Staff-room one-pagers, A5 "QR to your lesson" cards for pilot schools | 1–2 | Printed brand kit items | Scans (UTM'd QR) |

Annual paid-media envelope for Jordan, **(assumption)**: 15,000–30,000 JD
across Phase 2, weighted 40% to the back-to-school window, 25% to the
Semester 2 launch, the rest always-on. Zero paid spend until activation and
D30 retention are measured on organic users.

---

## 7. PR plan

**Angles that are true and newsworthy:**

1. "Built in Jordan, for the Jordanian curriculum" — a local founder's answer
   to foreign AI tools that don't know the national books.
2. "The AI that shows its working" — symbolically verified answer keys and
   honest labelling, at a time when AI hallucination in education is the
   story. Technical outlets and education policy audiences.
3. "Teachers' evenings, given back" — the human story, with a pilot
   teacher's before/after.
4. Later: school contracts, the first Gulf pilot, funding.

**Targets (Jordan first):**

- National press and broadcast: Al-Ghad, Al-Rai, Ad-Dustour, Jordan News,
  The Jordan Times, Roya, Al-Mamlaka TV morning and tech segments.
- Tech/startup: Wamda, MENAbytes, Jordan Times tech column, Hala Jordan
  startup coverage.
- Education: Queen Rania Foundation's channels, teacher-training
  institutions' newsletters, Ministry of Education supervisors' bulletins
  (informally, through pilot schools).
- Podcasts and YouTube: Arabic edtech and founder podcasts; Jordanian
  teacher YouTubers for a "tried it" segment.

**Cadence:** a press kit (Arabic/English, founder bio, screenshots, reel,
fact sheet with only verified claims) in Phase 0; one pitched story per month
from the Semester 2 launch; every milestone (Play launch, first school
contract, 1,000 teachers, first Gulf pilot) gets a short release and a
LinkedIn post the same day.

**Thought leadership:** the founder writes on building Arabic-first AI
products and on "verified, not generated" as a design principle. Submit to
ArabNet / Step conferences and Jordan edtech meetups as a speaker; these
invitations compound.

**Crisis posture, written now:** if a generated material is ever found wrong
in a classroom, respond within 24 hours, show the retire mechanism («بلّغ عن
مشكلة» retires a pooled artifact immediately), and publish what was fixed.
Over-claiming is the only real reputational risk; honesty is the brand.

---

## 8. Influencer and creator programme

Teachers trust teachers. The programme is micro-creators, product-led, and
paid modestly; no celebrity tier.

**Tiers:**

| Tier | Who | Count | Deal |
| --- | --- | --- | --- |
| Ambassadors («سفراء اقرأ») | Pilot teachers who post anyway; 1k–20k followers | 10 → 30 | Free Pro for life, early features, a referral code with a revenue share (20% of first-year revenue, **assumption**), feature on our channels |
| Micro-creators | Jordanian teacher creators on TikTok/Instagram/YouTube, 10k–200k | 5 → 15 | Paid per deliverable (reel + story + link), 50–300 JD **(assumption)**, plus referral code; brief is "prep your actual Sunday lesson on camera" |
| Supervisors & trainers | مشرفون تربويون, teacher-training leads | 5 | Not paid; co-hosted webinar, early look, their name on a workshop |
| Gulf diaspora creators | Jordanian/Palestinian teachers posting from KSA/UAE | Phase 3 | Same micro deal; seeds the expansion markets |

**Rules:** creators show the real product, the real lesson, and the real
badge; demo content is labelled; no "AI does everything" scripts. Each
creator gets a tracked link and code; pay against activated teachers, not
views, once the attribution is in place.

**Programme calendar:** seed 10 at the Semester 2 launch; expand to 30 for
back-to-school 2027; run two co-created series («أسبوع كامل مع اقرأ», «ورقة
عمل في دقيقة»).

---

## 9. Owned channels and lifecycle

- **Email (Resend, `iqrra.com` is verified):** onboarding sequence (day 0
  welcome with the 10-minute path, day 2 "your lesson for this week", day 7
  invite a colleague, day 14 upgrade), weekly worksheet digest, school
  admin monthly usage report.
- **Push (once verified on a device):** "this week's lesson is ready to prep"
  on Saturday evening, tied to the pacing plan; keep to one a week.
- **In-app:** release notes in Arabic, the referral screen, the Pro upgrade
  moment placed after the third generated material, never on first open.
- **WhatsApp community and Telegram channel:** the weekly drop and office
  hours; the highest-engagement channel in this market by a wide margin.

---

## 10. Measurement and the fundable thresholds

Funnel, measured on every surface (web, Android binary, OTA):

| Stage | Metric | Phase 1 target | Phase 2 target |
| --- | --- | --- | --- |
| Reach | Reel views, profile visits, landing visits | 50k views/month | 300k views/month |
| Acquisition | Signups, verified accounts, cost per signup by channel | 100 teachers | 1,000 teachers |
| **Activation** | % who generate a first material within 10 minutes of first lesson pick; % with 3 materials in 7 days | ≥50% / ≥30% | ≥60% / ≥40% |
| Retention | Weekly-active teachers in term; D30 return | 40 WAU; D30 ≥35% | 300 WAU; D30 ≥45% |
| Expansion | Teachers per school; pilots → LOI → paid; seats sold | 3 LOIs | 8 paying schools |
| Revenue | ARPU, monthly churn (B2C), seat renewals (B2B) | first revenue | LTV/CAC ≥ 3 conservative; CAC payback < 12 months |
| Referral | % of signups from referral codes | 10% | 25% |

Reporting: a one-page monthly marketing report (same numbers, same order)
feeds the financial model's drivers: CAC by channel, churn, teachers per
school, sales-cycle length. If the model and the marketing story ever
describe different companies, the model wins and the plan changes.

---

## 11. Twelve-month timeline

| When | Milestone | Marketing moves |
| --- | --- | --- |
| **5 Oct 2026** | World Teachers' Day | Post the reel; open the design-partner form |
| **Oct 2026** | Foundation | Mailbox, claims audit, spelling decision, brand kit, landing page, social accounts, analytics on three surfaces, pilot kit, legal opinion on textbook use |
| **by 1 Nov 2026** | Play closed test starts | 12+ design partners opted in; weekly reels begin (3/week) |
| **Nov 2026** | Design partners + WTP survey | Tutorial Part 2; first «ورقة الأسبوع» drops; 3–5 schools signed for December pilots |
| **Dec 2026** | Pilots begin | Staff-room demos; school WhatsApp groups; weekly usage reports to directors |
| **mid-Dec 2026** | Closed test complete | Apply for Play production; real screenshots captured |
| **Jan 2027** | Semester 1 exams | Showcase evaluations + exam scanning in pilots; pilot review meetings; collect LOIs and testimonials; Play listing live |
| **early Feb 2027** | **Public launch (Semester 2 opening)** | Press release + 3 pitched stories; 10 creators seeded; founding-teacher offer; tutorial Part 3; 2-week reel sprint; referral loop live |
| **7 Feb – 8 Mar 2027** | Ramadan | «حصة رمضانية في ٣٠ دقيقة» daily track |
| **Mar 2027** | Paid acquisition starts | Meta campaigns at 20–30 JD/day optimised to activation; Google brand terms; first monthly CAC report |
| **Apr – Jun 2027** | **School sales window** | 2 demos/week; case study; early-bird until 30 June; association meeting; accelerator application |
| **May – Jul 2027** | Tawjihi / end of year | Revision packs (scoped to shipped books); Queen Rania Award nominations |
| **Jul – Aug 2027** | Summer | «جهّز سنتك» annual push; school onboarding sessions; back-to-school creative built |
| **late Aug – Sep 2027** | **Back-to-school 2027/28** | 40% of annual paid budget; 30 creators; new-year worksheet packs; school «أول أسبوع جاهز» |
| **Oct 2027** | Phase 2 review | Thresholds check (LTV/CAC, retention, 8 schools). Go/no-go on Phase 3 |
| **Nov 2027** | GESS Dubai | Attend with the Jordan case study; 10 Gulf teacher interviews; shortlist the partner |
| **Q1 2028** | First expansion market | Books grounded; partner signed; diaspora-led pilot cluster; 6-month experiment with a stop condition |

---

## 12. Budget envelope (all figures **assumptions**, JD)

| Phase | Monthly | Main lines |
| --- | --- | --- |
| 0 — Foundation (2 months) | 150–400 | Tooling, music licences, small reel boosts, printing |
| 1 — Pilot & launch (3 months) | 400–900 | Creator seeding, launch boosts, press kit, travel, print |
| 2 — Scale Jordan (7 months) | 1,500–4,000 | Paid media 60%, creators 20%, events/collateral 20% |
| 3 — Expand (per market, 6 months) | 2,000–5,000 | Partner co-marketing, one event, localised creative, interviews |

Year-one total for Jordan: roughly 14,000–35,000 JD, of which the first
5 months cost under 4,000. Everything above Phase 1 is conditional on
measured unit economics, and is the marketing line of the pre-seed
use-of-funds.

---

## 13. Blunt verdict

**Strongest part.** The wedge is real and defensible: a curriculum-grounded,
verified, Arabic-first lesson journey is something no global tool will build
for Jordan, and the product already shows the verification rather than
asserting it. The content engine (reel and tutorial pipelines, pacing-plan
worksheets) can run at near-zero cost and compounds through the teacher
groups where this market actually lives.

**Weakest link.** Zero evidence. No pilot, no LOI, no price, no Play listing,
and a web build whose prose is mocked. Marketing spend on top of that would
buy signups that bounce off demo content. The plan therefore spends nothing
meaningful before Phase 1 produces activation and retention numbers.

**Single highest-leverage next action.** Start the Play closed test by
1 November with the 20 design-partner teachers, and sign 3 schools for
December pilots with written success criteria and an LOI at the end. Those
two moves produce the testimonials for the Semester 2 launch and the LOIs for
the raise at the same time. Everything else in this document waits on them.
