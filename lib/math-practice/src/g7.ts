/**
 * Three Grade 7 maths lessons that had no offline questions (found
 * 2026-11-13, every quiz / worksheet / homework on them threw
 * `NoQuestionBankError`):
 *
 *   - «خطة حل المسألة: الحل العكسي»   (S1 u1_l6)  g7_work_backward
 *   - «التطابق»                        (S2 u6_l1)  g7_congruence
 *   - «خطة حل المسألة: الرسم»          (S2 u6_l5)  g7_draw_diagram
 *
 * There is no extracted Grade 7 maths book, so each generator asks what the
 * lesson's NCCD objectives list (`iqra_curriculum_g7_math_sem1/2.json`):
 * life problems undone step by step from the result; naming corresponding
 * sides and angles of congruent polygons and using them; problems a sketch
 * solves (posts along a fence, cuts, handshakes, a climbing snail, places on a
 * road, tables in a row).
 *
 * Same contract as `g8.ts`: the lesson TITLE picks the generator (`[7, 7]`
 * only — each of the three folded titles is unique in the catalog today, and
 * the grade bound keeps a later same-titled lesson elsewhere out), every
 * answer is computed from the numbers printed in its own stem, and an item is
 * never `verified` and carries no `check`. Maths stays in latin digits and
 * letters; display converts.
 */
import { dinars, int, numWrongs, pick, signed, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [7, 7], make });

/** Positive whole-number options: a count, an amount of money, a length. */
const cnt = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(c => Number.isInteger(c) && c > 0));
const minutes = (n: number) => `${n} ${tamyiz(n, 'دقائق', 'دقيقةً', 'دقيقة')}`;
const degrees = (n: number) => `${n} ${tamyiz(n, 'درجات', 'درجةً', 'درجة')}`;
/** «6:05» from minutes after midnight (a morning time). */
const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

// ─── S1 u1_l6: working backward ─────────────────────────────────────────────

const PARTS: Record<number, [string, string]> = { 2: ['نصف', 'half'], 3: ['ثلث', 'a third'], 4: ['ربع', 'a quarter'], 5: ['خمس', 'a fifth'] };

const workBackward = T('g7_work_backward', /^خطه حل المساله الحل العكسي$/, ({ rng, diff }) => {
  // 0 a number machine, 1 money spent then half of the rest, 2 two fractions of what is left,
  // 3 a temperature that fell and rose, 4 the latest time to wake up.
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : diff === 'medium' ? [0, 1, 2, 3, 4] : [0, 2, 3, 3, 4]);

  if (k === 1) {
    const left = int(rng, 3, 20), spent = int(rng, 3, 15);
    const start = 2 * left + spent;
    return {
      eq: `back money ${spent} half ${left}`, answer: String(start),
      wrongs: cnt(start, [2 * left - spent, left + spent, 2 * (left + spent), 2 * left]),
      ar: `مع سلمى مبلغٌ من المال. أنفقت منه ${dinars(spent)} على كتاب، ثم أنفقت نصف ما تبقّى على هدية، فبقي معها ${dinars(left)}. كم دينارًا كان معها في البداية؟`,
      en: `Salma had some money. She spent ${spent} JD on a book, then half of what was left on a gift, and had ${left} JD left. How many JD did she have at the start?`,
    };
  }

  if (k === 2) {
    // spend 1/p of the money, then 1/q of what is left; the rest is (p−1)(q−1)/(pq) of the start
    const p = pick(rng, [2, 3, 4, 5]), q = pick(rng, [2, 3, 4, 5]);
    const start = p * q * int(rng, 2, diff === 'hard' ? 12 : 6);
    const left = (start * (p - 1) * (q - 1)) / (p * q);
    const afterFirst = (start * (p - 1)) / p;
    return {
      eq: `back frac ${p} ${q} ${left}`, answer: String(start),
      wrongs: cnt(start, [afterFirst, left * p, left * q, left + start / p, (left * q) / (q - 1) + left]),
      ar: `أنفق تاجرٌ ${PARTS[p]![0]} ما معه من نقود، ثم أنفق ${PARTS[q]![0]} ما تبقّى معه، فبقي معه ${dinars(left)}. كم دينارًا كان معه في البداية؟`,
      en: `A merchant spent ${PARTS[p]![1]} of his money, then ${PARTS[q]![1]} of what was left, and had ${left} JD left. How many JD did he have at the start?`,
    };
  }

  if (k === 3) {
    // a temperature that fell, then rose, and ended at `end` (may be below zero)
    const fall = int(rng, 3, 9), rise = int(rng, 3, 9);
    const start = int(rng, -8, 8);
    const end = start - fall + rise;
    return {
      eq: `back temp ${fall} ${rise} ${signed(end)}`, answer: `${signed(start)}°`,
      wrongs: wrongsFrom(`${signed(start)}°`, [end - fall + rise, end - fall - rise, end + fall + rise, -start].map(v => `${signed(v)}°`), j => `${signed(start + j)}°`),
      ar: `انخفضت درجة الحرارة في الصباح ${degrees(fall)}، ثم ارتفعت ظهرًا ${degrees(rise)}، فأصبحت ${signed(end)}°. كم كانت درجة الحرارة قبل الانخفاض؟`,
      en: `In the morning the temperature fell by ${fall} degrees, then at noon it rose by ${rise} degrees, ending at ${signed(end)}°. What was the temperature before it fell?`,
    };
  }

  if (k === 4) {
    const arrive = pick(rng, [7 * 60 + 15, 7 * 60 + 30, 7 * 60 + 45, 8 * 60]);
    const steps = [int(rng, 2, 6) * 5, int(rng, 2, 4) * 5, int(rng, 1, 3) * 5]; // walk, breakfast, dressing
    const total = steps[0]! + steps[1]! + steps[2]!;
    const wake = arrive - total;
    const forgot = steps.map(s => clock(wake + s));
    return {
      eq: `back clock ${arrive} ${steps.join(' ')}`, answer: clock(wake),
      wrongs: wrongsFrom(clock(wake), [...forgot, clock(arrive + total)], j => clock(wake + 5 * j)),
      ar: `يجب أن يصل خالد إلى المدرسة الساعة ${clock(arrive)} صباحًا. يحتاج إلى ${minutes(steps[0]!)} للوصول إلى المدرسة، و${minutes(steps[1]!)} لتناول الفطور، و${minutes(steps[2]!)} لارتداء ملابسه. ما آخر وقت يمكنه أن يستيقظ فيه؟`,
      en: `Khaled must reach school at ${clock(arrive)} a.m. It takes ${steps[0]} minutes to get to school, ${steps[1]} minutes for breakfast and ${steps[2]} minutes to get dressed. What is the latest time to wake up?`,
    };
  }

  // a number machine: multiply, add or subtract, and (hard) divide
  const x = diff === 'easy' ? int(rng, 2, 12) : int(rng, -9, 12) || 5;
  const m = int(rng, 2, diff === 'easy' ? 5 : 7);
  if (diff === 'hard') {
    for (let tries = 0; tries < 40; tries++) {
      const d = int(rng, 2, 5), r = int(rng, -6, 9);
      const b = m * x - r * d;
      if (b < 1 || b > 40) continue;
      return {
        eq: `back machine ${m} −${b} /${d} = ${signed(r)}`, answer: signed(x),
        wrongs: numWrongs(x, [(r * d - b) / m, (r * d + b) * m, r * d + b, (r + b) * d / m].filter(Number.isInteger), signed),
        ar: `فكّرتُ في عدد، ثم ضربته في ${m}، ثم طرحتُ من الناتج ${b}، ثم قسمتُ الناتج على ${d}، فكانت النتيجة ${signed(r)}. ما العدد الذي فكّرتُ فيه؟`,
        en: `I thought of a number, multiplied it by ${m}, subtracted ${b}, then divided the result by ${d}, and got ${signed(r)}. What was my number?`,
      };
    }
  }
  const b = int(rng, 1, 20), add = diff === 'easy' || rng() < 0.5;
  const c = add ? m * x + b : m * x - b;
  return {
    eq: `back machine ${m} ${add ? '+' : '−'}${b} = ${signed(c)}`, answer: signed(x),
    wrongs: numWrongs(x, [add ? (c + b) / m : (c - b) / m, add ? c / m - b : c / m + b, add ? c - b : c + b, c * m + b].filter(Number.isInteger), signed),
    ar: `فكّرتُ في عدد، ثم ضربته في ${m}، ثم ${add ? 'أضفتُ إلى الناتج' : 'طرحتُ من الناتج'} ${b}، فكانت النتيجة ${signed(c)}. ما العدد الذي فكّرتُ فيه؟`,
    en: `I thought of a number, multiplied it by ${m}, then ${add ? 'added' : 'subtracted'} ${b}, and got ${signed(c)}. What was my number?`,
  };
});

// ─── S2 u6_l1: congruence ───────────────────────────────────────────────────

/**
 * Two congruent polygons named so that the order of the letters is the
 * correspondence: ABCD ≅ (a rotation or reflection of PQRS), so A ↔ the first
 * letter of the second name, and so on. The second name is still a polygon's
 * name (its letters run round the shape), only not starting at P.
 */
function namedPair(rng: Rng, n: 3 | 4): { first: string[]; second: string[] } {
  const first = n === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
  const base = n === 3 ? ['D', 'E', 'F'] : ['P', 'Q', 'R', 'S'];
  let second = base.slice();
  const shift = int(rng, 0, n - 1);
  second = [...second.slice(shift), ...second.slice(0, shift)];
  if (rng() < 0.5) second = [second[0]!, ...second.slice(1).reverse()];
  return { first, second };
}
const shape = (n: number) => (n === 3 ? '△' : '');
const polyAr = (n: number) => (n === 3 ? 'المثلث' : 'الشكل الرباعي');
const polyEn = (n: number) => (n === 3 ? 'triangle' : 'quadrilateral');

const congruence = T('g7_congruence', /^التطابق$/, ({ rng, diff }) => {
  // 0 the corresponding side, 1 the corresponding vertex/angle, 2 an angle's measure from its partner,
  // 3 a missing angle by the angle sum, 4 the perimeter, 5 x from two corresponding sides.
  const k = pick(rng, diff === 'easy' ? [0, 1, 2, 4] : diff === 'medium' ? [0, 1, 2, 3, 4, 5] : [0, 2, 3, 3, 4, 5]);
  const n: 3 | 4 = k === 4 || k === 5 ? 3 : diff === 'easy' && k !== 2 ? 3 : pick(rng, [3, 4] as const);
  const { first, second } = namedPair(rng, diff === 'easy' ? 3 : n);
  const m = first.length;
  const statement = `${shape(m)}${first.join('')} ≅ ${shape(m)}${second.join('')}`;

  if (k === 0) {
    const i = int(rng, 0, m - 1), j = (i + 1) % m;
    const sideOf = (xs: string[], a: number, b: number) => `${xs[a]}${xs[b]}`;
    const ans = sideOf(second, i, j);
    // every other side of the second polygon, written in its own letter order
    const others = Array.from({ length: m }, (_, t) => sideOf(second, t, (t + 1) % m)).filter(s => s !== ans);
    const wrongs = m === 3 ? [...others, sideOf(first, i, j)] : others;
    return {
      eq: `cong side ${first.join('')} ${second.join('')} ${i}`, answer: ans, wrongs: wrongs.slice(0, 3),
      ar: `إذا كان ${statement}، فما الضلع المناظر للضلع ${sideOf(first, i, j)}؟`,
      en: `If ${statement}, which side corresponds to side ${sideOf(first, i, j)}?`,
    };
  }

  if (k === 1) {
    const i = int(rng, 0, m - 1);
    const ans = `∠${second[i]}`;
    const wrongs = second.filter((_, t) => t !== i).map(v => `∠${v}`);
    if (m === 3) wrongs.push(`∠${first[(i + 1) % m]}`);
    return {
      eq: `cong angle ${first.join('')} ${second.join('')} ${i}`, answer: ans, wrongs: wrongs.slice(0, 3),
      ar: `إذا كان ${statement}، فما الزاوية المناظرة للزاوية ${first[i]}؟`,
      en: `If ${statement}, which angle corresponds to angle ${first[i]}?`,
    };
  }

  // angle measures of the first polygon: distinct multiples of 5 that sum to 180 or 360
  const angles = (): number[] => {
    for (;;) {
      const xs = Array.from({ length: m - 1 }, () => int(rng, m === 3 ? 6 : 13, m === 3 ? 16 : 24) * 5);
      const last = (m === 3 ? 180 : 360) - xs.reduce((a, b) => a + b, 0);
      const all = [...xs, last];
      if (last >= 30 && last <= (m === 3 ? 150 : 170) && new Set(all).size === m) return all;
    }
  };

  if (k === 2 || k === 3) {
    const ang = angles();
    const i = int(rng, 0, m - 1);
    const known = k === 2 ? first.map((_, t) => t) : first.map((_, t) => t).filter(t => t !== i);
    const facts = known.map(t => `m∠${first[t]} = ${ang[t]}°`);
    const sum = known.reduce((a, t) => a + ang[t]!, 0);
    const cands = k === 2 ? ang.filter((_, t) => t !== i) : known.map(t => ang[t]!);
    return {
      eq: `cong measure ${k} ${first.join('')} ${second.join('')} ${ang.join(' ')} ${i}`, answer: `${ang[i]}°`,
      wrongs: wrongsFrom(`${ang[i]}°`, cands.filter(c => c > 0 && c < 360).map(c => `${c}°`), j => `${ang[i]! + 5 * j}°`),
      ar: `إذا كان ${statement}، وكان ${facts.join('، ')}، فما قياس الزاوية ${second[i]}؟`,
      en: `If ${statement} and ${facts.join(', ')}, what is the measure of angle ${second[i]}?`,
    };
  }

  // k 4, 5: triangles ABC ≅ (D, E, F in some order)
  const sideOf = (xs: string[], a: number, b: number) => `${xs[a]}${xs[b]}`;
  if (k === 4) {
    // two sides of the first triangle and the third side of the second; the perimeter is the same
    const s = [int(rng, 3, 12), int(rng, 3, 12), 0];
    s[2] = int(rng, Math.abs(s[0]! - s[1]!) + 1, s[0]! + s[1]! - 1);
    const per = s[0]! + s[1]! + s[2]!;
    return {
      eq: `cong perimeter ${second.join('')} ${s.join(' ')}`, answer: String(per),
      wrongs: cnt(per, [s[0]! + s[1]!, per + s[2]!, 2 * (s[0]! + s[1]!), per - 1]),
      ar: `إذا كان ${statement}، وكان ${sideOf(first, 0, 1)} = ${s[0]} سم، ${sideOf(first, 1, 2)} = ${s[1]} سم، ${sideOf(second, 2, 0)} = ${s[2]} سم، فما محيط ${polyAr(3)} ${second.join('')} بالسنتيمترات؟`,
      en: `If ${statement}, ${sideOf(first, 0, 1)} = ${s[0]} cm, ${sideOf(first, 1, 2)} = ${s[1]} cm and ${sideOf(second, 2, 0)} = ${s[2]} cm, what is the perimeter of ${polyEn(3)} ${second.join('')} in cm?`,
    };
  }
  // x from two corresponding sides: a·x + b = L
  const a = int(rng, 2, 5), x = int(rng, 2, 9), b = int(rng, 1, 9);
  const L = a * x + b;
  const i = int(rng, 0, 2), j = (i + 1) % 3;
  return {
    eq: `cong x ${a} ${b} ${L}`, answer: String(x),
    wrongs: cnt(x, [(L + b) / a, L - b, L / a, x + b].filter(Number.isInteger)),
    ar: `إذا كان ${statement}، وكان ${sideOf(first, i, j)} = (${a}x + ${b}) سم، ${sideOf(second, i, j)} = ${L} سم، فما قيمة x؟`,
    en: `If ${statement}, ${sideOf(first, i, j)} = (${a}x + ${b}) cm and ${sideOf(second, i, j)} = ${L} cm, what is x?`,
  };
});

// ─── S2 u6_l5: solve by drawing a diagram ───────────────────────────────────

const drawDiagram = T('g7_draw_diagram', /^خطه حل المساله الرسم$/, ({ rng, diff }) => {
  // 0 posts along a straight fence, 1 posts round a rectangle, 2 cuts in a log, 3 handshakes,
  // 4 a snail in a well, 5 two houses on a road, 6 square tables in a row.
  const k = pick(rng, diff === 'easy' ? [0, 2, 5, 6] : diff === 'medium' ? [0, 1, 2, 3, 5, 6] : [1, 3, 4, 4, 5, 6]);

  if (k === 0) {
    const gap = pick(rng, [2, 3, 4, 5]), parts = int(rng, 4, diff === 'easy' ? 8 : 15);
    const len = gap * parts, posts = parts + 1;
    return {
      eq: `draw fence ${len} ${gap}`, answer: String(posts), wrongs: cnt(posts, [parts, parts - 1, parts + 2]),
      ar: `سياج مستقيم طوله ${len} م، يُثبَّت عمود عند كل ${gap} م منه، بما في ذلك طرفاه. كم عمودًا يلزم للسياج؟`,
      en: `A straight fence is ${len} m long with a post every ${gap} m, including both ends. How many posts are needed?`,
    };
  }

  if (k === 1) {
    const gap = pick(rng, [2, 3, 5]);
    const w = gap * int(rng, 3, 6), h = gap * int(rng, 2, w / gap - 1);
    const posts = (2 * (w + h)) / gap;
    return {
      eq: `draw ring ${w} ${h} ${gap}`, answer: String(posts), wrongs: cnt(posts, [posts + 4, posts + 1, (w + h) / gap + 1, posts - 4]),
      ar: `حديقة مستطيلة الشكل طولها ${w} م وعرضها ${h} م، يُراد إحاطتها بسياج يُثبَّت فيه عمود عند كل ${gap} م، وعند كل زاوية عمود. كم عمودًا يلزم؟`,
      en: `A rectangular garden is ${w} m by ${h} m. A fence round it has a post every ${gap} m, with a post at each corner. How many posts are needed?`,
    };
  }

  if (k === 2) {
    const pieces = int(rng, 3, 9), t = pick(rng, [3, 4, 5]);
    const total = (pieces - 1) * t;
    return {
      eq: `draw cuts ${pieces} ${t}`, answer: String(total), wrongs: cnt(total, [pieces * t, (pieces + 1) * t, pieces - 1]),
      ar: `يحتاج نجّار إلى ${minutes(t)} لإجراء قَطع واحد في لوح خشبي. كم دقيقةً يحتاج لتقسيم اللوح إلى ${pieces} ${tamyiz(pieces, 'قطع', 'قطعةً', 'قطعة')} متساوية؟`,
      en: `A carpenter needs ${t} minutes for each cut through a plank. How many minutes does it take to cut the plank into ${pieces} equal pieces?`,
    };
  }

  if (k === 3) {
    const n = int(rng, 4, diff === 'hard' ? 12 : 8);
    const ans = (n * (n - 1)) / 2;
    return {
      eq: `draw handshakes ${n}`, answer: String(ans), wrongs: cnt(ans, [n * (n - 1), n * n, n - 1, ans + n]),
      ar: `في اجتماع حضره ${n} ${tamyiz(n, 'أشخاص', 'شخصًا', 'شخص')}، صافح كلٌّ منهم كلَّ شخص آخر مرة واحدة فقط. كم مصافحةً حدثت؟`,
      en: `At a meeting of ${n} people, each shook hands once with every other person. How many handshakes were there?`,
    };
  }

  if (k === 4) {
    // climbs `up` by day and slips `down` by night; out on the day its climb reaches the top
    for (;;) {
      const up = int(rng, 3, 6), down = int(rng, 1, up - 1), depth = int(rng, up + 3, 20);
      const days = Math.ceil((depth - up) / (up - down)) + 1;
      const naive = Math.ceil(depth / (up - down));
      if (naive === days) continue; // the drawing must matter
      return {
        eq: `draw snail ${depth} ${up} ${down}`, answer: String(days), wrongs: cnt(days, [naive, naive + 1, days + 1, days - 1]),
        ar: `حلزون في قاع بئر عمقها ${depth} م. يصعد في النهار ${up} م، وينزلق في الليل ${down} م. في أي يوم يصل إلى أعلى البئر؟`,
        en: `A snail is at the bottom of a ${depth} m well. Each day it climbs ${up} m and each night it slips back ${down} m. On which day does it reach the top?`,
      };
    }
  }

  if (k === 5) {
    const a = int(rng, 2, 9), b = int(rng, 1, 9);
    const opposite = rng() < 0.5 || a === b;
    const ans = opposite ? a + b : Math.abs(a - b);
    const other = opposite ? Math.abs(a - b) : a + b;
    return {
      eq: `draw road ${a} ${b} ${opposite ? 'opp' : 'same'}`, answer: String(ans), wrongs: cnt(ans, [other, a * b, Math.max(a, b)]),
      ar: `يقع منزل رامي على بُعد ${a} كم شرق المدرسة، ويقع منزل باسل على بُعد ${b} كم ${opposite ? 'غرب' : 'شرق'} المدرسة على الطريق المستقيم نفسه. كم كيلومترًا بين المنزلين؟`,
      en: `Rami's house is ${a} km east of the school and Basel's house is ${b} km ${opposite ? 'west' : 'east'} of the school on the same straight road. How many km apart are the houses?`,
    };
  }

  // square tables pushed together in a row, one chair on each free side
  const t = int(rng, 3, diff === 'easy' ? 6 : 12);
  const seats = 2 * t + 2;
  return {
    eq: `draw tables ${t}`, answer: String(seats), wrongs: cnt(seats, [4 * t, 2 * t, 2 * t + 4, 3 * t]),
    ar: `صُفَّت ${t} ${tamyiz(t, 'طاولات', 'طاولةً', 'طاولة')} مربعة متلاصقة في صف واحد، ويجلس شخص واحد على كل ضلع غير ملاصق لطاولة أخرى. كم شخصًا يمكنهم الجلوس؟`,
    en: `${t} square tables are pushed together in one row, and one person sits at each side that does not touch another table. How many people can sit?`,
  };
});

export const G7_TOPICS: readonly Topic[] = [workBackward, congruence, drawDiagram];
