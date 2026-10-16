/**
 * Statistics, data and probability generators (Grades 1–10). Same contract as
 * the other topic modules: the lesson title picks the generator, every answer
 * is computed from the data printed in the stem. Data is always written out as
 * a list or a small table — there is no chart to look at — so every stem is
 * self-contained.
 *
 * Three-way answers (certain / possible / impossible; mean / median / mode)
 * have two wrong options, yes / no one, the rest three.
 */
import { gcd, int, numWrongs, pick, sfrac, signed, tamyiz, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);

const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const list = (xs: number[]) => xs.join('، ');
const listEn = (xs: number[]) => xs.join(', ');
/** «5» or «5.5». */
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const decOpts = (ans: number, cands: number[], step = 1) =>
  wrongsFrom(n1(ans), cands.filter(c => Number.isFinite(c) && c >= 0).map(n1), k => n1(ans + Math.abs(k) * step));
const countOpts = (ans: number, cands: number[]) => numWrongs(ans, cands);
const fracOpts = (n: number, d: number, cands: string[]) => wrongsFrom(sfrac(n, d), cands, k => sfrac(n + Math.abs(k), d));


const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sorted = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const median = (xs: number[]) => { const s = sorted(xs), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
/** The single most frequent value, or null when there is a tie. */
function mode(xs: number[]): number | null {
  const c = new Map<number, number>();
  xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
  const top = Math.max(...c.values());
  const tops = [...c.entries()].filter(([, k]) => k === top);
  return tops.length === 1 ? tops[0]![0] : null;
}

const COLORS: Array<[string, string]> = [['حمراء', 'red'], ['زرقاء', 'blue'], ['خضراء', 'green'], ['صفراء', 'yellow']];
const DUAL = ['حمراوان', 'زرقاوان', 'خضراوان', 'صفراوان'];
/** «5 كرات حمراء», «كرتان زرقاوان», «12 كرةً خضراء» — two balls are «كرتان», never «2 كرات». */
const balls = (n: number, i: number) => (n === 2 ? `كرتان ${DUAL[i]}` : `${n} ${tamyiz(n, 'كرات', 'كرةً', 'كرة')} ${COLORS[i]![0]}`);
const bagAr = (cs: number[]) => cs.map((c, i) => balls(c, i)).join(' و ').replace(/ و (?=\D)/gu, ' و');
const bagEn = (cs: number[]) => cs.map((c, i) => `${c} ${COLORS[i]![1]} balls`).join(', ').replace(/, ([^,]*)$/, ' and $1');

// ─── chance and probability ─────────────────────────────────────────────────

const LIKELY = ['أكيد', 'ممكن', 'مستحيل'];
const LIKELY_EN: Record<string, string> = { 'أكيد': 'certain', 'ممكن': 'possible', 'مستحيل': 'impossible' };
/** Events on one roll of a 1–6 die: impossible (no face), possible (some) or certain (every face). */
const DIE_CERTAINTY: Array<[string, string, (v: number) => boolean]> = [
  ['العدد 7', 'a 7', v => v === 7], ['عدد أكبر من 6', 'a number greater than 6', v => v > 6], ['العدد 0', 'a 0', v => v === 0],
  ['عدد أصغر من 7', 'a number less than 7', v => v < 7], ['عدد من 1 إلى 6', 'a number from 1 to 6', v => v >= 1 && v <= 6],
  ['عدد زوجي', 'an even number', v => v % 2 === 0], ['العدد 4', 'a 4', v => v === 4], ['عدد أكبر من 3', 'a number greater than 3', v => v > 3],
];
/**
 * Since 2026-10-16 also an event on a die (no bag to look into), and the
 * reverse ask: how many balls to take out so that drawing a colour becomes
 * certain or impossible.
 */
const certainty = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng }) => {
  const present = pick(rng, [1, 2, 3]);
  const counts = Array.from({ length: present }, () => int(rng, 3, 9));
  const ci = int(rng, 0, 3);
  const kind = pick(rng, [0, 0, 1, 2, 3]);
  const has = ci < present;
  let ans: string, ar: string, en: string, eq = counts.join(', ');
  if (kind === 2) {
    const [evAr, evEn, f] = pick(rng, DIE_CERTAINTY);
    eq = evAr;
    const c = [1, 2, 3, 4, 5, 6].filter(f).length;
    ans = c === 0 ? 'مستحيل' : c === 6 ? 'أكيد' : 'ممكن';
    ar = `رُمي مكعب مرقم من 1 إلى 6 مرة واحدة. ظهور ${evAr}: أكيد أم ممكن أم مستحيل؟`;
    en = `A 1–6 die is rolled once. Rolling ${evEn} is certain, possible or impossible?`;
  } else if (kind === 3) {
    // two or three colours, so there is something to take out either way
    const cs = Array.from({ length: pick(rng, [2, 3]) }, () => int(rng, 3, 9));
    const i = int(rng, 0, cs.length - 1), t = sum(cs), certain = rng() < 0.5;
    const n = certain ? t - cs[i]! : cs[i]!;
    return {
      eq: cs.join(', '), answer: String(n), wrongs: countOpts(n, [certain ? cs[i]! : t - cs[i]!, t, n + 1, n - 1]),
      ar: `في كيس ${bagAr(cs)}. ما أقل عدد من الكرات يجب إخراجه من الكيس ليصبح سحب كرة ${COLORS[i]![0]} ${certain ? 'أكيدًا' : 'مستحيلًا'}؟`,
      en: `A bag holds ${bagEn(cs)}. What is the fewest balls that must be taken out of the bag to make drawing a ${COLORS[i]![1]} ball ${certain ? 'certain' : 'impossible'}?`,
    };
  } else if (kind === 0) {
    ans = !has ? 'مستحيل' : present === 1 ? 'أكيد' : 'ممكن';
    ar = `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. سحب كرة ${COLORS[ci]![0]}: أكيد أم ممكن أم مستحيل؟`;
    en = `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Drawing a ${COLORS[ci]![1]} ball is certain, possible or impossible?`;
  } else {
    ans = 'أكيد';
    ar = `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. سحب كرة لونها أحد ألوان الكرات الموجودة في الكيس: أكيد أم ممكن أم مستحيل؟`;
    en = `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Drawing a ball whose colour is one of those in the bag is certain, possible or impossible?`;
  }
  return { eq, answer: ans, wrongs: LIKELY.filter(x => x !== ans), ar, en };
});

const outcomes = T('outcomes', /^التجربه العشوائيه وانواع الحوادث$/, [4, 4], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: '', answer: '6', wrongs: ['5', '12', '3'], ar: 'ما عدد النواتج الممكنة عند رمي مكعب مرقم من 1 إلى 6 مرة واحدة؟', en: 'How many possible outcomes are there when a 1–6 die is rolled once?' };
  if (k === 1) return { eq: '', answer: '2', wrongs: ['1', '4', '3'], ar: 'ما عدد النواتج الممكنة عند رمي قطعة نقد مرة واحدة؟', en: 'How many possible outcomes are there when a coin is tossed once?' };
  if (k === 2) { const s = int(rng, 3, span(diff, 8, 10, 12)); return { eq: `${s}`, answer: String(s), wrongs: countOpts(s, [s - 1, s + 1, 2 * s, 1]), ar: `قرص دوار مقسم إلى ${s} قطاعات متساوية مرقمة من 1 إلى ${s}. ما عدد النواتج الممكنة عند تدويره مرة واحدة؟`, en: `A spinner has ${s} equal sectors numbered 1 to ${s}. How many outcomes are possible when it is spun once?` }; }
  const counts = [int(rng, 3, 9), int(rng, 3, 9)];
  const t = sum(counts);
  return { eq: counts.join(', '), answer: '2', wrongs: ['1', String(t), '3'], ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة. ما عدد الألوان الممكنة للكرة المسحوبة؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn. How many different colours could it be?` };
});

/** Die events and how many of the six faces each covers — for «equal chances?». */
const DIE_CHANCE: Array<[string, string, number]> = [
  ['عدد زوجي', 'an even number', 3], ['عدد فردي', 'an odd number', 3], ['عدد أكبر من 4', 'a number greater than 4', 2], ['عدد أصغر من 3', 'a number less than 3', 2],
  ['العدد 6', 'a 6', 1], ['العدد 1', 'a 1', 1], ['عدد أكبر من 2', 'a number greater than 2', 4], ['عدد أصغر من 5', 'a number less than 5', 4],
];
/**
 * Which colour is most or least likely — and since 2026-10-16 the lesson's own
 * question, whether two events have equal chances: two colours in a bag, or
 * two events on a die.
 */
const likelihood = T('likelihood', /^فرص الحدوث$/, [5, 5], ({ rng, diff }) => {
  const k = pick(rng, [0, 0, 1, 2]);
  if (k === 1) {
    const counts = Array.from({ length: 3 }, () => int(rng, 3, 9));
    const [i, j] = shuffle(rng, [0, 1, 2]).slice(0, 2) as [number, number];
    const equal = rng() < 0.5;
    if (equal) counts[j] = counts[i]!;
    else if (counts[j] === counts[i]) counts[j] = counts[i]! === 9 ? 8 : counts[i]! + 1;
    return {
      eq: counts.join(', '), answer: equal ? 'نعم' : 'لا', wrongs: [equal ? 'لا' : 'نعم'],
      ar: `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. هل فرصة سحب كرة ${COLORS[i]![0]} تساوي فرصة سحب كرة ${COLORS[j]![0]}؟ (نعم / لا)`,
      en: `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Is drawing a ${COLORS[i]![1]} ball exactly as likely as drawing a ${COLORS[j]![1]} ball? (yes / no)`,
    };
  }
  if (k === 2) {
    const a = pick(rng, DIE_CHANCE), equal = rng() < 0.5;
    const b = pick(rng, DIE_CHANCE.filter(e => e !== a && (e[2] === a[2]) === equal));
    return {
      eq: `${a[0]}; ${b[0]}`, answer: equal ? 'نعم' : 'لا', wrongs: [equal ? 'لا' : 'نعم'],
      ar: `رُمي مكعب مرقم من 1 إلى 6 مرة واحدة. هل فرصة ظهور ${a[0]} تساوي فرصة ظهور ${b[0]}؟ (نعم / لا)`,
      en: `A 1–6 die is rolled once. Is rolling ${a[1]} exactly as likely as rolling ${b[1]}? (yes / no)`,
    };
  }
  const counts = shuffle(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, span(diff, 3, 4, 4));
  const most = rng() < 0.5;
  const target = most ? Math.max(...counts) : Math.min(...counts);
  const idx = counts.indexOf(target);
  const names = COLORS.slice(0, counts.length).map(c => c[0]);
  return {
    eq: counts.join(', '), answer: names[idx]!, wrongs: names.filter((_, i) => i !== idx).concat(COLORS.map(c => c[0]).filter(c => !names.includes(c))).slice(0, 3),
    ar: `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. أي لون ${most ? 'أكثر' : 'أقل'} احتمالًا للسحب؟ (اكتب اللون)`,
    en: `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Which colour is ${most ? 'most' : 'least'} likely? (give the colour)`,
  };
});

const DICE_EVENTS: Array<[string, string, (v: number) => boolean]> = [
  ['عدد زوجي', 'an even number', v => v % 2 === 0], ['عدد فردي', 'an odd number', v => v % 2 === 1],
  ['عدد أكبر من 4', 'a number greater than 4', v => v > 4], ['عدد أصغر من 3', 'a number less than 3', v => v < 3],
  ['العدد 6', 'a 6', v => v === 6], ['عدد يقبل القسمة على 3', 'a multiple of 3', v => v % 3 === 0], ['عدد أولي', 'a prime number', v => [2, 3, 5].includes(v)],
];
/** The probability scale, from impossible to certain. */
const SCALE = ['عند 0', 'بين 0 و 1/2', 'عند 1/2', 'بين 1/2 و 1', 'عند 1'];
/** Grade 6 also places a probability on the scale (since 2026-10-16). */
const probability = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const k = pick(rng, grade === 6 ? [0, 0, 1, 4] : [0, 1, 2, 3]);
  if (k === 4) { // where a probability sits on the scale from 0 to 1
    const shape = pick(rng, ['zero', 'one', 'half', 'other', 'other']);
    let cs: number[], i: number;
    if (shape === 'one') { cs = [int(rng, 3, 9)]; i = 0; }
    else if (shape === 'half') { cs = rng() < 0.5 ? [int(rng, 3, 9)] : [0, int(rng, 3, 5), int(rng, 3, 5)]; if (cs.length === 1) cs.push(cs[0]!); else cs[0] = cs[1]! + cs[2]!; i = 0; }
    else { cs = Array.from({ length: pick(rng, [2, 3]) }, () => int(rng, 3, 9)); i = shape === 'zero' ? 3 : int(rng, 0, cs.length - 1); }
    const c = cs[i] ?? 0, t = sum(cs);
    const at = c === 0 ? 0 : c === t ? 4 : 2 * c === t ? 2 : 2 * c < t ? 1 : 3;
    const wrongs = [0, 1, 2, 3, 4].filter(j => j !== at).sort((x, y) => Math.abs(x - at) - Math.abs(y - at)).slice(0, 3).map(j => SCALE[j]!);
    return { eq: cs.join(', '), answer: SCALE[at]!, wrongs, ar: `على مقياس الاحتمال من 0 إلى 1، أين يقع احتمال سحب كرة ${COLORS[i]![0]} من كيس فيه ${bagAr(cs)}: عند 0، أم بين 0 و 1/2، أم عند 1/2، أم بين 1/2 و 1، أم عند 1؟`, en: `On the probability scale from 0 to 1, where does the probability of drawing a ${COLORS[i]![1]} ball from a bag holding ${bagEn(cs)} lie: at 0, between 0 and 1/2, at 1/2, between 1/2 and 1, or at 1?` };
  }
  if (k === 0) {
    const counts = Array.from({ length: pick(rng, [2, 3, 4]) }, () => int(rng, 2, span(diff, 6, 9, 10)));
    const i = int(rng, 0, counts.length - 1), t = sum(counts);
    return { eq: counts.join(', '), answer: sfrac(counts[i]!, t), wrongs: fracOpts(counts[i]!, t, [sfrac(counts[i]!, t - counts[i]!), sfrac(t - counts[i]!, t), sfrac(counts[i]!, counts.length), sfrac(1, t)].filter(f => f !== sfrac(counts[i]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال أن تكون ${COLORS[i]![0] === 'حمراء' ? 'الكرة حمراء' : `الكرة ${COLORS[i]![0]}`}؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is ${COLORS[i]![1]}?` };
  }
  if (k === 1) {
    const [ar, en, f] = pick(rng, DICE_EVENTS);
    const c = [1, 2, 3, 4, 5, 6].filter(f).length;
    return { eq: ar, answer: sfrac(c, 6), wrongs: fracOpts(c, 6, [sfrac(6 - c, 6), sfrac(c, 5), sfrac(c, 12), sfrac(1, 6)].filter(x => x !== sfrac(c, 6))), ar: `رُمي مكعب مرقم من 1 إلى 6. ما احتمال ظهور ${ar}؟`, en: `A 1–6 die is rolled. What is the probability of ${en}?` };
  }
  if (k === 2) {
    const counts = [int(rng, 2, 9), int(rng, 2, 9), int(rng, 2, 9)], t = sum(counts);
    const [a, b] = [0, 1];
    return { eq: counts.join(', '), answer: sfrac(t - counts[a]!, t), wrongs: fracOpts(t - counts[a]!, t, [sfrac(counts[a]!, t), sfrac(t - counts[a]!, t - 1), sfrac(counts[b]!, t), sfrac(1, t)].filter(x => x !== sfrac(t - counts[a]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال ألّا تكون الكرة ${COLORS[a]![0]}؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is not ${COLORS[a]![1]}?` };
  }
  const counts = [int(rng, 2, 8), int(rng, 2, 8)], t = sum(counts), N = t * int(rng, 2, 6);
  const exp = (N * counts[0]!) / t;
  return { eq: counts.join(', '), answer: String(exp), wrongs: countOpts(exp, [N / 2, N - exp, counts[0]!, exp + counts[1]!]), ar: `في كيس ${bagAr(counts)}. سُحبت كرة عشوائيًا وأُعيدت إلى الكيس، وتكررت العملية ${N} مرة. كم مرة يُتوقَّع أن تكون الكرة المسحوبة ${COLORS[0]![0]}؟`, en: `A bag holds ${bagEn(counts)}. A ball is drawn at random and replaced, ${N} times. How many times is it expected to be ${COLORS[0]![1]}?` };
});

const experimental = T('experimental', /^الاحتمال التجريبي$/, [7, 7], ({ rng, diff }) => {
  const N = pick(rng, [20, 25, 40, 50, 60, 80, 100]), k = int(rng, 3, Math.floor(N * 0.7));
  const M = N * int(rng, 2, span(diff, 4, 6, 10)); // M is a multiple of N, so the prediction is whole
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 2) { // theoretical vs experimental: the die's own probability, whatever the trial showed
    const T6 = 6 * int(rng, 5, span(diff, 10, 15, 20)), face = int(rng, 1, 6);
    let c = int(rng, Math.round(T6 / 10), Math.round(T6 / 4));
    if (c * 6 === T6) c += 1;
    return { eq: `${T6}, ${face}, ${c}`, answer: sfrac(1, 6), wrongs: fracOpts(1, 6, [sfrac(c, T6), sfrac(5, 6), sfrac(c, T6 - c), sfrac(1, T6)].filter(x => x !== sfrac(1, 6))), ar: `رُمي حجر نرد منتظم ${T6} ${tamyiz(T6, 'مرات', 'مرة', 'مرة')} (أوجهه مرقمة من 1 إلى 6)، فظهر العدد ${face} في ${c} ${tamyiz(c, 'مرات', 'مرة', 'مرة')} منها. ما الاحتمال النظري لظهور العدد ${face}؟`, en: `A fair 1–6 die is rolled ${T6} times and ${face} comes up ${c} times. What is the theoretical probability of rolling ${face}?` };
  }
  if (kind === 3) { // experimental probability read from a results table
    const counts = [int(rng, 3, 20), int(rng, 3, 20), int(rng, 3, 20)], tot = sum(counts), i = int(rng, 0, 2);
    const res = counts.map((v, j) => `${COLORS[j]![0]}: ${v}`).join('، '), resEn = counts.map((v, j) => `${COLORS[j]![1]}: ${v}`).join(', ');
    const ans = sfrac(counts[i]!, tot);
    return { eq: counts.join(', '), answer: ans, wrongs: fracOpts(counts[i]!, tot, [sfrac(counts[i]!, tot - counts[i]!), sfrac(1, 3), sfrac(tot - counts[i]!, tot), sfrac(counts[i]! + 1, tot)].filter(x => x !== ans)), ar: `سُحبت كرة من كيس ثم أُعيدت إليه، وتكرر ذلك ${tot} ${tamyiz(tot, 'مرات', 'مرة', 'مرة')}، فكانت النتائج: ${res}. ما الاحتمال التجريبي لسحب كرة ${COLORS[i]![0]}؟`, en: `A ball is drawn from a bag and put back, ${tot} times in all, with these results: ${resEn}. What is the experimental probability of drawing a ${COLORS[i]![1]} ball?` };
  }
  if (kind === 4) { // a fair experiment is one whose outcomes are equally likely: equal sectors
    const m = pick(rng, [3, 4, 5, 6]), eq = 360 / m;
    const fair = rng() < 0.5, d = pick(rng, [eq / 3, eq / 2].filter(Number.isInteger));
    const angles = Array.from({ length: m }, () => eq);
    if (!fair) { const a = int(rng, 0, m - 1), b = (a + int(rng, 1, m - 1)) % m; angles[a] = eq + d; angles[b] = eq - d; }
    const txt = angles.map(a => `${a}°`).join('، ');
    return { eq: angles.join(', '), answer: fair ? 'نعم' : 'لا', wrongs: [fair ? 'لا' : 'نعم'], ar: `قرص دوار مقسم إلى ${m} قطاعات بألوان مختلفة، قياسات زواياها المركزية: ${txt}. هل تدوير القرص مرة واحدة وتسجيل اللون تجربة عادلة؟ (نعم / لا)`, en: `A spinner has ${m} sectors in different colours with central angles ${angles.map(a => `${a}°`).join(', ')}. Is spinning it once and noting the colour a fair experiment? (yes / no)` };
  }
  if (kind === 0) return { eq: `${k}, ${N}`, answer: sfrac(k, N), wrongs: fracOpts(k, N, [sfrac(N - k, N), sfrac(k, N - k), sfrac(N, k), sfrac(k + 1, N)].filter(x => x !== sfrac(k, N))), ar: `رُمي سهم ${N} مرة فأصاب الهدف ${k} ${tamyiz(k, 'مرات', 'مرة', 'مرة')}. ما الاحتمال التجريبي لإصابة الهدف؟`, en: `An arrow is shot ${N} times and hits the target ${k} times. What is the experimental probability of a hit?` };
  const exp = (M * k) / N;
  return { eq: `${k}, ${N}, ${M}`, answer: String(exp), wrongs: countOpts(exp, [M - exp, k * M / 10, M / N, exp + k]), ar: `أصاب لاعب الهدف ${k} ${tamyiz(k, 'مرات', 'مرة', 'مرة')} من ${N} محاولة. كم مرة يُتوقَّع أن يصيب الهدف في ${M} محاولة؟`, en: `A player hits the target ${k} times in ${N} attempts. How many hits are expected in ${M} attempts?` };
});

const nPr = (n: number, r: number) => { let p = 1; for (let i = 0; i < r; i++) p *= n - i; return p; };
const fact = (n: number) => nPr(n, n);
const counting = T('counting', /^عد النواتج$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3, 4]);
  if (k === 0) { const a = int(rng, 2, 6), b = int(rng, 2, 6); return { eq: `${a}, ${b}`, answer: String(a * b), wrongs: countOpts(a * b, [a + b, a * b + a, a ** b, a * b - b]), ar: `لدى سامر ${a} قمصان و ${b} بناطيل. كم زيًّا مختلفًا (قميص وبنطال) يمكنه تكوينه؟`, en: `Sami has ${a} shirts and ${b} pairs of trousers. How many different outfits (a shirt and a pair of trousers) can he make?` }; }
  if (k === 1) { const a = int(rng, 2, 5), b = int(rng, 2, 5), c = int(rng, 2, 4); return { eq: `${a}, ${b}, ${c}`, answer: String(a * b * c), wrongs: countOpts(a * b * c, [a + b + c, a * b + c, a * b * c + a, (a + b) * c]), ar: `في مطعم ${a} أنواع من الطبق الرئيسي و ${b} أنواع من العصير و ${c} أنواع من الحلوى. كم وجبة مختلفة (طبق وعصير وحلوى) يمكن اختيارها؟`, en: `A restaurant offers ${a} main dishes, ${b} drinks and ${c} desserts. How many different meals (one of each) can be chosen?` }; }
  if (k === 2) { const n = int(rng, 3, span(diff, 5, 6, 7)); return { eq: `${n}`, answer: String(fact(n)), wrongs: countOpts(fact(n), [n * n, fact(n - 1), 2 * n, fact(n) + n]), ar: `بكم طريقة مختلفة يمكن ترتيب ${n} كتب مختلفة على رف في صف واحد؟`, en: `In how many different ways can ${n} different books be arranged in a row on a shelf?` }; }
  const n = int(rng, 4, span(diff, 6, 8, 9)), r = int(rng, 2, 3);
  if (k === 3) return { eq: `${n}, ${r}`, answer: String(nPr(n, r)), wrongs: countOpts(nPr(n, r), [n ** r, nPr(n, r) / fact(r), n * r, nPr(n, r + 1)]), ar: `بكم طريقة يمكن اختيار ${r} طلاب من ${n} طلاب لشغل ${r === 2 ? 'منصبي الرئيس ونائبه' : 'مناصب الرئيس ونائبه وأمين السر'} (الترتيب مهم)؟`, en: `In how many ways can ${r} students from ${n} be chosen to fill ${r === 2 ? 'the posts of president and deputy' : 'the posts of president, deputy and secretary'} (order matters)?` };
  const c = nPr(n, r) / fact(r);
  return { eq: `${n}, ${r}`, answer: String(c), wrongs: countOpts(c, [nPr(n, r), n * r, c + n, nPr(n, r) / 2]), ar: `بكم طريقة يمكن اختيار لجنة من ${r} طلاب من بين ${n} طلاب (الترتيب غير مهم)؟`, en: `In how many ways can a committee of ${r} students be chosen from ${n} students (order does not matter)?` };
});

const compound = T('compound_prob', /^احتمال الحوادث المركبه$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0) { const [ar, en, f] = pick(rng, DICE_EVENTS.slice(0, 4)); const c = [1, 2, 3, 4, 5, 6].filter(f).length; const ans = sfrac(c, 12); return { eq: ar, answer: ans, wrongs: fracOpts(c, 12, [sfrac(c, 6), sfrac(c + 1, 12), sfrac(1, 12), sfrac(c, 8)].filter(x => x !== ans)), ar: `رُميت قطعة نقد ومكعب مرقم من 1 إلى 6. ما احتمال ظهور شعار على القطعة و${ar} على المكعب؟`, en: `A coin is tossed and a 1–6 die is rolled. What is the probability of a head and ${en}?` }; }
  if (k === 1) { const a = int(rng, 1, 5), b = int(rng, 2, 6), c = int(rng, 1, 5), d = int(rng, 2, 6); if (a >= b || c >= d) return compound.make({ rng, diff, grade: 8 }); const n = a * c, den = b * d; return { eq: `${a}/${b}, ${c}/${d}`, answer: sfrac(n, den), wrongs: fracOpts(n, den, [sfrac(a * d + c * b, b * d), sfrac(a + c, b + d), sfrac(a * d, b * c), sfrac(n, den + 1)].filter(x => x !== sfrac(n, den))), ar: `حادثتان مستقلتان احتمال الأولى ${a}/${b} واحتمال الثانية ${c}/${d}. ما احتمال وقوعهما معًا؟`, en: `Two independent events have probabilities ${a}/${b} and ${c}/${d}. What is the probability that both happen?` }; }
  if (k === 2) { const r = int(rng, 3, 7), o = int(rng, 2, 6), t = r + o; const n = r * (r - 1), den = t * (t - 1); return { eq: `${r}, ${o}`, answer: sfrac(n, den), wrongs: fracOpts(n, den, [sfrac(r * r, t * t), sfrac(r, t), sfrac(r * (r - 1), t * t), sfrac(2 * r, t)].filter(x => x !== sfrac(n, den))), ar: `في كيس ${bagAr([r, o])}. سُحبت كرتان الواحدة بعد الأخرى دون إرجاع. ما احتمال أن تكون الكرتان حمراوين؟`, en: `A bag holds ${r} red balls and ${o} blue balls. Two balls are drawn one after the other without replacement. What is the probability that both are red?` }; }
  const counts = [int(rng, 2, 7), int(rng, 2, 7), int(rng, 2, 7)], t = sum(counts);
  return { eq: counts.join(', '), answer: sfrac(counts[0]! + counts[1]!, t), wrongs: fracOpts(counts[0]! + counts[1]!, t, [sfrac(counts[0]! * counts[1]!, t * t), sfrac(counts[2]!, t), sfrac(counts[0]! + counts[1]!, t - 1), sfrac(counts[0]!, t)].filter(x => x !== sfrac(counts[0]! + counts[1]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال أن تكون حمراء أو زرقاء؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is red or blue?` };
});

/**
 * Counts and probabilities from the sizes of two sets — and since 2026-10-16
 * reading a diagram whose regions are given, placing a number in a diagram
 * (Grades 3–4) and the addition rule P(A ∪ B) = P(A) + P(B) − P(A ∩ B) (Grade 9).
 */
const venn = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const both = int(rng, 2, 8), onlyA = int(rng, 2, 10), onlyB = int(rng, 2, 10), none = int(rng, 1, 8);
  const A = onlyA + both, B = onlyB + both, total = A + B - both + none;
  const prob = grade >= 9;
  const subjects = pick(rng, [['كرة القدم', 'السباحة', 'football', 'swimming'], ['الرسم', 'القراءة', 'drawing', 'reading'], ['الشاي', 'القهوة', 'tea', 'coffee']] as const);
  const head = `في مجموعة من ${total} شخصًا، ${A} منهم يحبون ${subjects[0]} و ${B} منهم يحبون ${subjects[1]} و ${both} يحبون الاثنين معًا`;
  const headEn = `In a group of ${total} people, ${A} like ${subjects[2]}, ${B} like ${subjects[3]} and ${both} like both`;
  const k = pick(rng, diff === 'easy' ? [0, 1, 4, 5] : [0, 1, 2, 3, 4, 5]);
  if (k === 4) { // read the diagram: the number written in each region is given, the sets are not
    const dia = `في شكل ڤن لدائرتين، دائرة لمن يحبون ${subjects[0]} ودائرة لمن يحبون ${subjects[1]}: العدد في الجزء المشترك ${both}، وفي دائرة ${subjects[0]} وحدها ${onlyA}، وفي دائرة ${subjects[1]} وحدها ${onlyB}، وخارج الدائرتين ${none}`;
    const diaEn = `A Venn diagram has a circle for people who like ${subjects[2]} and one for people who like ${subjects[3]}: ${both} in the overlap, ${onlyA} in the ${subjects[2]} circle only, ${onlyB} in the ${subjects[3]} circle only and ${none} outside both`;
    const whole = !prob && rng() < 0.4;
    if (whole) return { eq: `${both}, ${onlyA}, ${onlyB}, ${none}`, answer: String(total), wrongs: countOpts(total, [total - none, total - both, total + both, A + B]), ar: `${dia}. كم شخصًا في المجموعة كلها؟`, en: `${diaEn}. How many people are in the group altogether?` };
    if (!prob) return { eq: `${both}, ${onlyA}, ${onlyB}, ${none}`, answer: String(A), wrongs: countOpts(A, [onlyA, A + onlyB, both, total - A]), ar: `${dia}. كم شخصًا يحب ${subjects[0]}؟`, en: `${diaEn}. How many people like ${subjects[2]}?` };
    const ans = sfrac(A, total);
    return { eq: `${both}, ${onlyA}, ${onlyB}, ${none}`, answer: ans, wrongs: fracOpts(A, total, [sfrac(onlyA, total), sfrac(A, total - none), sfrac(both, total), sfrac(A + onlyB, total)].filter(x => x !== ans)), ar: `${dia}. اختير شخص من المجموعة عشوائيًا. ما احتمال أن يحب ${subjects[0]}؟`, en: `${diaEn}. One person is chosen at random. What is the probability that they like ${subjects[2]}?` };
  }
  if (k === 5 && prob) { // the addition rule, with the probabilities given
    const pa = sfrac(A, total), pb = sfrac(B, total), pab = sfrac(both, total), pu = sfrac(A + B - both, total);
    if (rng() < 0.6) return { eq: `${pa}, ${pb}, ${pab}`, answer: pu, wrongs: wrongsFrom(pu, [...(A + B <= total ? [sfrac(A + B, total)] : []), sfrac(A + B - 2 * both, total), sfrac(A * B, total * total), sfrac(Math.max(A, B), total)], j => (A + B - both - Math.abs(j) > 0 ? sfrac(A + B - both - Math.abs(j), total) : '')), ar: `إذا كان A و B حادثين في تجربة عشوائية، وكان P(A) = ${pa} و P(B) = ${pb} و P(A ∩ B) = ${pab}، فما P(A ∪ B)؟`, en: `A and B are events in a random experiment with P(A) = ${pa}, P(B) = ${pb} and P(A ∩ B) = ${pab}. What is P(A ∪ B)?` };
    return { eq: `${pa}, ${pb}, ${pu}`, answer: pab, wrongs: fracOpts(both, total, [sfrac(onlyB, total), sfrac(onlyA, total), sfrac(A * B, total * total), sfrac(both + 1, total)].filter(x => x !== pab)), ar: `إذا كان A و B حادثين في تجربة عشوائية، وكان P(A) = ${pa} و P(B) = ${pb} و P(A ∪ B) = ${pu}، فما P(A ∩ B)؟`, en: `A and B are events in a random experiment with P(A) = ${pa}, P(B) = ${pb} and P(A ∪ B) = ${pu}. What is P(A ∩ B)?` };
  }
  if (k === 5) { // place a number in the diagram: which region does it belong to?
    const [aAr, aEn, fa] = pick(rng, [['الزوجية', 'even numbers', (v: number) => v % 2 === 0], ['الفردية', 'odd numbers', (v: number) => v % 2 === 1]] as const);
    const m = pick(rng, [3, 5]), fb = (v: number) => v % m === 0;
    const region = (v: number) => (fa(v) ? (fb(v) ? 2 : 0) : fb(v) ? 1 : 3);
    const want = int(rng, 0, 3), top = grade <= 3 ? 30 : 50;
    const x = pick(rng, Array.from({ length: top }, (_, i) => i + 1).filter(v => region(v) === want));
    const bAr = `مضاعفات العدد ${m}`, bEn = `multiples of ${m}`;
    const labels = [`في دائرة الأعداد ${aAr} وحدها`, `في دائرة ${bAr} وحدها`, 'في الجزء المشترك', 'خارج الدائرتين'];
    return { eq: `${x}; ${m}`, answer: labels[want]!, wrongs: labels.filter((_, i) => i !== want), ar: `في شكل ڤن دائرة للأعداد ${aAr} من 1 إلى ${top} ودائرة ل${bAr} من 1 إلى ${top}. أين يُكتب العدد ${x}: ${labels.join('، أم ')}؟`, en: `A Venn diagram has a circle for the ${aEn} from 1 to ${top} and a circle for the ${bEn} from 1 to ${top}. Where is the number ${x} written: in the ${aEn} circle only, in the ${bEn} circle only, in the overlap, or outside both circles?` };
  }
  if (!prob || k < 2) {
    const [val, ar, en] = k === 0 ? [A + B - both, 'يحب أحد النشاطين على الأقل', 'like at least one of the two'] : k === 1 ? [onlyA, `يحبون ${subjects[0]} فقط`, `like only ${subjects[2]}`] : [none, 'لا يحبون أيًّا منهما', 'like neither'];
    if (prob) { const ans = sfrac(val, total); return { eq: `${total}, ${A}, ${B}, ${both}`, answer: ans, wrongs: fracOpts(val, total, [sfrac(A + B, total), sfrac(val, total - 1), sfrac(both, total), sfrac(val + 1, total)].filter(x => x !== ans)), ar: `${head}. اختير شخص عشوائيًا. ما احتمال أن ${k === 0 ? 'يحب أحد النشاطين على الأقل' : k === 1 ? `يحب ${subjects[0]} فقط` : 'لا يحب أيًّا منهما'}؟`, en: `${headEn}. One person is chosen at random. What is the probability that they ${en.replace('like ', 'like ').replace('only', 'only')}?` }; }
    return { eq: `${total}, ${A}, ${B}, ${both}`, answer: String(val), wrongs: countOpts(val, [A + B, val + both, val - 1 > 0 ? val - 1 : val + 2, total - val]), ar: `${head}. كم شخصًا ${ar}؟`, en: `${headEn}. How many ${en}?` };
  }
  const ans = k === 2 ? sfrac(both, total) : sfrac(total - A, total);
  return { eq: `${total}, ${A}, ${B}, ${both}`, answer: ans, wrongs: fracOpts(k === 2 ? both : total - A, total, [sfrac(A, total), sfrac(A + B - both, total), sfrac(both, A), sfrac(B, total)].filter(x => x !== ans)), ar: `${head}. اختير شخص عشوائيًا. ما احتمال أن ${k === 2 ? 'يحب الاثنين معًا' : `لا يحب ${subjects[0]}`}؟`, en: `${headEn}. One person is chosen at random. What is the probability that they ${k === 2 ? 'like both' : `do not like ${subjects[2]}`}?` };
});

const geometricProb = T('geometric_prob', /^الاحتمال الهندسي$/, [9, 9], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const s = int(rng, 4, span(diff, 10, 14, 20)), t = int(rng, 1, s - 1); const ans = sfrac(t * t, s * s); return { eq: `${s}, ${t}`, answer: ans, wrongs: fracOpts(t * t, s * s, [sfrac(t, s), sfrac(s * s - t * t, s * s), sfrac(4 * t, 4 * s + 1), sfrac(t * t, s * s + 1)].filter(x => x !== ans)), ar: `مربع طول ضلعه ${s} سم، وفي داخله مربع طول ضلعه ${t} سم. أُلقي سهم عشوائيًا على المربع الكبير. ما احتمال أن يقع في المربع الصغير؟`, en: `A square of side ${s} cm contains a smaller square of side ${t} cm. A dart lands at random on the large square. What is the probability that it lands in the small square?` }; }
  if (k === 1) { const a = pick(rng, [30, 45, 60, 72, 90, 120, 135, 150, 180]); const ans = sfrac(a, 360); return { eq: `${a}`, answer: ans, wrongs: fracOpts(a, 360, [sfrac(a, 180), sfrac(360 - a, 360), sfrac(a, 100), sfrac(a + 30, 360)].filter(x => x !== ans)), ar: `قرص دوار مقسم إلى قطاعات، وزاوية أحد القطاعات ${a}°. ما احتمال أن يتوقف المؤشر عند هذا القطاع؟`, en: `A spinner is divided into sectors, and one sector has angle ${a}°. What is the probability that the pointer stops in that sector?` }; }
  const L = int(rng, 6, span(diff, 20, 30, 50)), l = int(rng, 1, L - 1); const ans = sfrac(l, L);
  return { eq: `${L}, ${l}`, answer: ans, wrongs: fracOpts(l, L, [sfrac(L - l, L), sfrac(l, L - l), sfrac(L, l), sfrac(l + 1, L)].filter(x => x !== ans)), ar: `اختيرت نقطة عشوائيًا على قطعة مستقيمة طولها ${L} سم. ما احتمال أن تقع على الجزء الأول منها الذي طوله ${l} سم؟`, en: `A point is chosen at random on a segment ${L} cm long. What is the probability that it falls in its first part, ${l} cm long?` };
});

// ─── averages, range, data lists ────────────────────────────────────────────

/** A data set with a whole-number mean: n values, then the last is nudged so the sum divides n. */
function dataWithMean(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    for (let v = lo; v <= hi; v++) if ((sum(xs.slice(0, -1)) + v) % n === 0) { xs[n - 1] = v; return xs; }
  }
}

/** Whole-number options only: a candidate like 4.333 is not a mistake anyone writes. */
const intOpts = (ans: number, cands: number[]) => countOpts(ans, cands.filter(Number.isInteger));

/**
 * The mean, and since 2026-10-16 the rest of the lesson: the mean from a sum,
 * a sum from the mean, and — Grade 7 — the mean of a frequency table, an
 * outlier and its effect on the mean, and the effect of adding a value.
 */
const meanT = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const n = int(rng, 4, span(diff, 5, 6, 8)), hi = span(diff, 12, 25, 60);
  const xs = dataWithMean(rng, n, 1, hi), m = sum(xs) / n;
  const k = pick(rng, grade >= 7 ? [0, 1, 2, 3, 4, 5, 6, 7] : diff === 'easy' ? [0, 2, 3] : [0, 1, 2, 3]);
  if (k === 1) {
    const shown = xs.slice(0, -1), miss = xs[n - 1]!;
    return { eq: `${list(shown)}; ${m}`, answer: String(miss), wrongs: countOpts(miss, [m, sum(shown), m * (n - 1) - sum(shown) + 1, miss + n]), ar: `الوسط الحسابي لـ ${n} أعداد هو ${m}. إذا كانت ${n - 1} منها: ${list(shown)} فما العدد الأخير؟`, en: `The mean of ${n} numbers is ${m}. If ${n - 1} of them are ${listEn(shown)}, what is the last number?` };
  }
  if (k === 2) { // mean from the total
    const S = sum(xs);
    return { eq: `${S}, ${n}`, answer: String(m), wrongs: intOpts(m, [S - n, S / 2, m + 1, m * 2]), ar: `مجموع علامات ${n} طلاب في اختبار هو ${S}. ما الوسط الحسابي لعلاماتهم؟`, en: `The marks of ${n} students in a test add up to ${S}. What is their mean mark?` };
  }
  if (k === 3) { // total from the mean
    const S = m * n;
    return { eq: `${m}, ${n}`, answer: String(S), wrongs: intOpts(S, [m + n, m * (n - 1), S + m, S - n]), ar: `الوسط الحسابي لأوزان ${n} صناديق هو ${m} كغ. ما مجموع أوزان الصناديق بالكيلوغرام؟`, en: `The mean mass of ${n} boxes is ${m} kg. What is their total mass in kg?` };
  }
  if (k === 4) { // mean of a frequency table: the values weighted by how often they occur
    for (;;) {
      const vals = sorted(shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, span(diff, 3, 4, 4)));
      const f = vals.map(() => int(rng, 1, span(diff, 5, 7, 9)));
      const N = sum(f), S = sum(vals.map((v, i) => v * f[i]!));
      if (S % N !== 0) continue;
      const mean = S / N;
      if (mean === sum(vals) / vals.length) continue; // the unweighted slip must be wrong
      const table = vals.map((v, i) => `${v}: ${f[i]}`).join('، '), tableEn = vals.map((v, i) => `${v}: ${f[i]}`).join(', ');
      return { eq: table, answer: String(mean), wrongs: intOpts(mean, [Math.round(sum(vals) / vals.length), S / vals.length, N, mean + 1, mean - 1]), ar: `يبين الجدول التكراري الآتي (العلامة: التكرار) علامات طلاب صف في اختبار قصير: ${table}. ما الوسط الحسابي للعلامات؟`, en: `The frequency table (mark: frequency) shows a class's marks in a short quiz: ${tableEn}. What is the mean mark?` };
    }
  }
  if (k === 5 || k === 6) { // an outlier, and the mean once it is taken out
    const high = rng() < 0.7; // far above a cluster of 10–20, or far below one of 40–50
    const rest = high ? dataWithMean(rng, n - 1, 10, 20) : dataWithMean(rng, n - 1, 40, 50), mr = sum(rest) / (n - 1);
    const out = high ? int(rng, 60, 95) : int(rng, 1, 5);
    const all = shuffle(rng, [...rest, out]);
    if (k === 5) return { eq: list(all), answer: String(out), wrongs: intOpts(out, [Math.max(...rest), Math.min(...rest), mr, median(all)]), ar: `في البيانات الآتية قيمة متطرفة واحدة: ${list(all)}. ما هذه القيمة؟`, en: `The data ${listEn(all)} contain one outlier. What is it?` };
    const withOut = sum(all) / n;
    return { eq: list(all), answer: String(mr), wrongs: intOpts(mr, [Math.round(withOut), mr + 1, mr - 1, median(rest)]), ar: `في البيانات الآتية قيمة متطرفة واحدة: ${list(all)}. ما الوسط الحسابي للبيانات بعد حذف القيمة المتطرفة؟`, en: `The data ${listEn(all)} contain one outlier. What is the mean once the outlier is removed?` };
  }
  if (k === 7) { // a value added: the new value is chosen so the new mean is whole
    const d = int(rng, 1, 4), up = rng() < 0.6 || m - d * (n + 1) <= 0;
    const v = up ? m + d * (n + 1) : m - d * (n + 1), m2 = up ? m + d : m - d;
    return { eq: `${m}, ${n}, ${v}`, answer: String(m2), wrongs: intOpts(m2, [(m + v) / 2, m, (m * n + v) / n, up ? m2 + 1 : m2 - 1]), ar: `الوسط الحسابي لـ ${n} أعداد هو ${m}. أُضيف إليها العدد ${v}. ما الوسط الحسابي للأعداد الجديدة؟`, en: `The mean of ${n} numbers is ${m}. The number ${v} is added to them. What is the new mean?` };
  }
  const x = shuffle(rng, xs);
  return { eq: list(x), answer: String(m), wrongs: countOpts(m, [median(xs), Math.max(...xs), sum(xs), Math.min(...xs), m + 1]), ar: `ما الوسط الحسابي للأعداد: ${list(x)}؟`, en: `What is the mean of ${listEn(x)}?` };
});

type MMKind = 'median' | 'mode' | 'range' | 'medianMissing' | 'modeContext' | 'rangeTable' | 'rangeEnd' | 'bestMeasure';
const MEASURES = ['الوسط الحسابي', 'الوسيط', 'المنوال'];
/**
 * Since 2026-10-16 a Grade 5 lesson asks more than one sentence: a missing
 * value from the median, the mode of data with a context, the range of a
 * frequency table (values, not frequencies) and an end value from the range.
 * Grade 7 also finds a missing value from the median and chooses the measure
 * that best describes data with or without an outlier.
 */
const medianModeT = (id: string, match: RegExp, grades: [number, number], kinds: MMKind[]): Topic => T(id, match, grades, ({ rng, diff }) => {
  const kind = pick(rng, kinds);
  if (kind === 'bestMeasure') {
    // distinct values (so there is no mode), close together — or the same with one far above them,
    // which pulls the mean away and leaves the median describing the data (Grade 7's rule)
    const outlier = rng() < 0.5, n = int(rng, 5, 7);
    // steps of 20–40 dinars: no gap is wider than the spread of the others, so nothing stands out
    const rest: number[] = [10 * int(rng, 28, 40)];
    while (rest.length < (outlier ? n - 1 : n)) rest.push(rest[rest.length - 1]! + 10 * int(rng, 2, 4));
    const xs = shuffle(rng, outlier ? [...rest, 100 * int(rng, 15, 30)] : rest);
    const ans = outlier ? 'الوسيط' : 'الوسط الحسابي';
    return { eq: list(xs), answer: ans, wrongs: MEASURES.filter(m => m !== ans), ar: `الرواتب الشهرية بالدينار لموظفي شركة صغيرة: ${list(xs)}. أي مقاييس النزعة المركزية أنسب لوصف هذه الرواتب: الوسط الحسابي، أم الوسيط، أم المنوال؟`, en: `The monthly salaries in dinars of a small company's staff are ${listEn(xs)}. Which measure of central tendency best describes them: the mean, the median or the mode?` };
  }
  if (kind === 'medianMissing') {
    // even count, ordered, the upper middle value hidden: median = (lower middle + x) / 2
    for (;;) {
      const n = pick(rng, [4, 6]), h = n / 2;
      const s = sorted(shuffle(rng, Array.from({ length: span(diff, 20, 30, 40) }, (_, i) => i + 1)).slice(0, n));
      const a = s[h - 1]!, x = s[h]!;
      if ((a + x) % 2 !== 0) continue;
      const md = (a + x) / 2;
      const shown = s.map((v, i) => (i === h ? 'x' : String(v)));
      return { eq: `${shown.join(', ')}; ${md}`, answer: String(x), wrongs: countOpts(x, [md, a, a + md, x + 1, s[h + 1]!]), ar: `الأعداد الآتية مرتبة تصاعديًا: ${shown.join('، ')}، ووسيطها ${md}. ما قيمة x؟`, en: `These numbers are in ascending order: ${shown.join(', ')}, and their median is ${md}. What is x?` };
    }
  }
  if (kind === 'modeContext') {
    for (;;) {
      const n = int(rng, 8, span(diff, 10, 12, 14));
      const xs = Array.from({ length: n }, () => int(rng, 0, span(diff, 4, 5, 6)));
      const m = mode(xs);
      if (m === null) continue;
      const times = xs.filter(v => v === m).length;
      return { eq: list(xs), answer: String(m), wrongs: countOpts(m, [times, median(xs), Math.max(...xs), m + 1]), ar: `سجّل فريق كرة قدم عدد الأهداف التي أحرزها في ${n} ${tamyiz(n, 'مباريات', 'مباراة', 'مباراة')}: ${list(xs)}. ما منوال عدد الأهداف؟`, en: `A football team recorded its goals in ${n} matches: ${listEn(xs)}. What is the mode of the number of goals?` };
    }
  }
  if (kind === 'rangeTable') {
    // ages and how many players have each — the range is of the ages, not of the counts
    const ages = sorted(shuffle(rng, [8, 9, 10, 11, 12, 13, 14, 15, 16]).slice(0, span(diff, 3, 4, 5)));
    const f = ages.map(() => int(rng, 1, 9));
    const r = ages[ages.length - 1]! - ages[0]!;
    const table = ages.map((v, i) => `${v}: ${f[i]}`).join('، '), tableEn = ages.map((v, i) => `${v}: ${f[i]}`).join(', ');
    return { eq: table, answer: String(r), wrongs: countOpts(r, [Math.max(...f) - Math.min(...f), ages[ages.length - 1]!, sum(f), r + 1]), ar: `يبين الجدول التكراري الآتي (العمر بالسنوات: عدد اللاعبين) أعمار لاعبي نادٍ رياضي: ${table}. ما مدى أعمار اللاعبين؟`, en: `The frequency table (age in years: number of players) shows the ages of a sports club's players: ${tableEn}. What is the range of the ages?` };
  }
  if (kind === 'rangeEnd') {
    const r = int(rng, 5, span(diff, 20, 40, 60)), lo = int(rng, 2, span(diff, 20, 30, 50)), hi = lo + r;
    if (rng() < 0.5) return { eq: `${r}, ${lo}`, answer: String(hi), wrongs: countOpts(hi, [Math.abs(r - lo), r, lo, hi + 1]), ar: `مدى مجموعة من البيانات ${r}، وأصغر قيمة فيها ${lo}. ما أكبر قيمة فيها؟`, en: `The range of a data set is ${r} and its smallest value is ${lo}. What is its largest value?` };
    return { eq: `${r}, ${hi}`, answer: String(lo), wrongs: countOpts(lo, [hi + r, r, hi, lo + 1]), ar: `مدى مجموعة من البيانات ${r}، وأكبر قيمة فيها ${hi}. ما أصغر قيمة فيها؟`, en: `The range of a data set is ${r} and its largest value is ${hi}. What is its smallest value?` };
  }
  if (kind === 'mode') {
    for (;;) {
      const n = int(rng, 7, span(diff, 9, 11, 13));
      const xs = Array.from({ length: n }, () => int(rng, 1, span(diff, 9, 15, 20)));
      const m = mode(xs);
      if (m === null) continue;
      if (xs.filter(v => v === m).length < 3) continue;
      return { eq: list(xs), answer: String(m), wrongs: countOpts(m, [median(xs), Math.max(...xs), Math.round(sum(xs) / n), Math.min(...xs), m + 1]), ar: `ما المنوال للأعداد: ${list(xs)}؟`, en: `What is the mode of ${listEn(xs)}?` };
    }
  }
  const n = int(rng, 5, span(diff, 8, 10, 12)), hi = span(diff, 20, 40, 90);
  const xs = Array.from({ length: n }, () => int(rng, 1, hi));
  if (kind === 'median') { const md = median(xs); return { eq: list(xs), answer: n1(md), wrongs: decOpts(md, [sum(xs) / n, sorted(xs)[0]!, Math.max(...xs), sorted(xs)[n >> 1]! + (n % 2 ? 1 : 0)].map(v => Math.round(v * 2) / 2).filter(v => v !== md), 0.5), ar: `ما الوسيط للأعداد: ${list(xs)}؟`, en: `What is the median of ${listEn(xs)}?` }; }
  const r = Math.max(...xs) - Math.min(...xs);
  if (r === 0) return medianModeT(id, match, grades, kinds).make({ rng, diff, grade: grades[0] });
  return { eq: list(xs), answer: String(r), wrongs: countOpts(r, [Math.max(...xs), r + 1, r - 1, Math.max(...xs) + Math.min(...xs), sum(xs) / n | 0]), ar: `ما المدى للأعداد: ${list(xs)}؟`, en: `What is the range of ${listEn(xs)}?` };
});

/** Reading the plot — and since 2026-10-16 building one and testing a claim against it. */
const stemLeaf = T('stem_leaf', /^التمثيل بالساق والورقه$/, [7, 7], ({ rng, diff }) => {
  const n = int(rng, 9, span(diff, 11, 13, 16));
  const xs = Array.from({ length: n }, () => int(rng, 10, 59));
  const stems = [...new Set(xs.map(x => Math.floor(x / 10)))].sort((a, b) => a - b);
  const table = stems.map(s => `${s} | ${sorted(xs.filter(x => Math.floor(x / 10) === s)).map(x => x % 10).join(' ')}`).join('\n');
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  if (k === 4) { // build the plot: how many leaves go on a stem
    const s = pick(rng, stems), c = xs.filter(x => Math.floor(x / 10) === s).length;
    const other = stems.find(t => t !== s && xs.filter(x => Math.floor(x / 10) === t).length !== c);
    return { eq: list(xs), answer: String(c), wrongs: countOpts(c, [n, stems.length, ...(other !== undefined ? [xs.filter(x => Math.floor(x / 10) === other).length] : []), c + 1, c - 1]), ar: `عند تمثيل العلامات الآتية بالساق والورقة (الساق للعشرات والورقة للآحاد): ${list(xs)}، كم ورقة تُكتب أمام الساق ${s}؟`, en: `When the marks ${listEn(xs)} are shown in a stem-and-leaf plot (stem = tens, leaf = units), how many leaves go next to the stem ${s}?` };
  }
  if (k === 5) { // test a claim against the plot
    const cuts = [20, 25, 30, 35, 40, 45, 50].filter(c => 2 * xs.filter(x => x >= c).length !== n && xs.some(x => x >= c) && xs.some(x => x < c));
    const cut = pick(rng, cuts.length ? cuts : [20]), above = xs.filter(x => x >= cut).length;
    const yes = 2 * above > n;
    return { eq: `${table}; ${cut}`, answer: yes ? 'نعم' : 'لا', wrongs: [yes ? 'لا' : 'نعم'], ar: `سجّل معلم علامات طلابه في اختبار ومثّلها بالساق والورقة (الساق للعشرات والورقة للآحاد):\n${table}\nافترض المعلم أن أكثر من نصف الطلاب حصلوا على العلامة ${cut} فأكثر. هل هذه الفرضية صحيحة؟ (نعم / لا)`, en: `A teacher recorded his students' test marks in a stem-and-leaf plot (stem = tens, leaf = units):\n${table}\nHe supposes that more than half of the students scored ${cut} or more. Is this hypothesis true? (yes / no)` };
  }
  const head = `يبين التمثيل بالساق والورقة الآتي علامات مجموعة من الطلاب (الساق للعشرات والورقة للآحاد):\n${table}\n`;
  const headEn = `The stem-and-leaf plot shows students' marks (stem = tens, leaf = units):\n${table}\n`;
  if (k === 0) { const v = Math.max(...xs); return { eq: table, answer: String(v), wrongs: countOpts(v, [Math.min(...xs), v - 1, median(xs), stems[stems.length - 1]!]), ar: `${head}ما أعلى علامة؟`, en: `${headEn}What is the highest mark?` }; }
  if (k === 1) { const r = Math.max(...xs) - Math.min(...xs); return { eq: table, answer: String(r), wrongs: countOpts(r, [Math.max(...xs), r + 1, r - 10, Math.min(...xs)]), ar: `${head}ما مدى العلامات؟`, en: `${headEn}What is the range of the marks?` }; }
  if (k === 2) { const md = median(xs); return { eq: table, answer: n1(md), wrongs: decOpts(md, [sum(xs) / n, sorted(xs)[0]!, Math.max(...xs), md + 1].map(v => Math.round(v * 2) / 2).filter(v => v !== md), 0.5), ar: `${head}ما وسيط العلامات؟`, en: `${headEn}What is the median mark?` }; }
  return { eq: table, answer: String(n), wrongs: countOpts(n, [n - 1, n + 1, stems.length, sum(xs) / n | 0]), ar: `${head}كم طالبًا في المجموعة؟`, en: `${headEn}How many students are in the group?` };
});

// ─── reading data tables ────────────────────────────────────────────────────

const BIRDS: Array<[string, string]> = [['العصافير', 'sparrows'], ['الحمام', 'pigeons'], ['البط', 'ducks']];
const CATS: Array<[string, string]> = [['التفاح', 'apples'], ['الموز', 'bananas'], ['البرتقال', 'oranges'], ['العنب', 'grapes'], ['الكرز', 'cherries']];
/**
 * Reading a table of counts (most, least, total, a difference) — and since
 * 2026-10-16, for Grades 1–2: organising raw data, comparing two rows of a
 * picture graph, reading a tally (Grade 2) and choosing how many pictures to
 * draw (Grade 2); and for Grades 3–4, reading a bar that ends between two lines
 * of its scale, how many squares a bar takes, and (Grade 4) counting a dot plot.
 */
const readData = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const m = grade <= 1 ? 6 : grade === 2 ? 9 : span(diff, 12, 20, 30);
  const k = grade <= 2 ? 3 : 4;
  const cats = shuffle(rng, CATS).slice(0, k);
  const raw = shuffle(rng, Array.from({ length: m }, (_, i) => i + 1)).slice(0, k);
  const key = grade === 2 && rng() < 0.6 ? 2 : 1;
  const counts = raw.map(v => (key === 2 ? v : v)); // symbols (or tally marks) per category
  const vals = counts.map(c => c * key);
  const where = key === 2 ? `في جدول الصور الآتي كل صورة تمثل ${key} من الفاكهة، وعدد الصور: ` : 'في الجدول الآتي عدد الطلاب الذين يفضلون كل نوع من الفاكهة: ';
  const whereEn = key === 2 ? `In a picture graph each picture stands for ${key} fruits; the numbers of pictures are: ` : 'The table shows how many students prefer each fruit: ';
  const tab = cats.map((c, i) => `${c[0]}: ${counts[i]}`).join('، ');
  const tabEn = cats.map((c, i) => `${c[1]}: ${counts[i]}`).join(', ');
  const q = pick(rng, grade === 1 ? [0, 1, 3, 4, 5] : grade === 2 ? [0, 1, 3, 4, 5, 6, 7] : grade === 3 ? [0, 1, 2, 3, 8, 9] : [0, 1, 2, 3, 8, 9, 10]);
  if (q === 8) { // read a bar that ends halfway between two lines of the scale
    const step = pick(rng, [2, 10]), lo = step * int(rng, 1, span(diff, 4, 6, 8)), v = lo + step / 2, [f, fEn] = pick(rng, CATS);
    return { eq: `${step}, ${lo}, ${lo + step}`, answer: String(v), wrongs: countOpts(v, [lo, lo + step, lo + 1, v + step]), ar: `في تمثيل بالأعمدة لعدد الطلاب الذين يفضلون كل نوع من الفاكهة، يزيد تدريج المحور الرأسي ${step} عند كل خط. ينتهي عمود ${f} في منتصف المسافة بين الخطين ${lo} و ${lo + step}. كم طالبًا يفضّل ${f}؟`, en: `In a bar graph of the fruits pupils prefer, the vertical scale goes up by ${step} at each line. The bar for ${fEn} ends halfway between the lines ${lo} and ${lo + step}. How many pupils prefer ${fEn}?` };
  }
  if (q === 9) { // represent: how many squares a bar takes when each square stands for several pupils
    const per = pick(rng, [2, 5, 10]), sq = int(rng, 2, 9), v = per * sq, [f, fEn] = pick(rng, CATS);
    return { eq: `${v}, ${per}`, answer: String(sq), wrongs: countOpts(sq, [v, v - per, sq + 1, sq - 1, per]), ar: `تمثّل ريم بيانات صفها بالأعمدة على ورقة مربعات، ويمثل كل مربع في العمود ${per === 2 ? 'طالبين' : `${per} طلاب`}. إذا كان عدد الطلاب الذين يفضلون ${f} ${v}، فكم مربعًا يكون طول عموده؟`, en: `Reem draws her class's data as a bar graph on squared paper, and each square of a bar stands for ${per} pupils. If ${v} pupils prefer ${fEn}, how many squares tall is its bar?` };
  }
  if (q === 10) { // a dot plot: count the dots at or above a value
    const top = 6, cs = Array.from({ length: top }, () => int(rng, 0, span(diff, 4, 5, 6))), v = int(rng, 3, 5);
    cs[v - 1] = Math.max(1, cs[v - 1]!); // a dot at the value itself, so «or more» differs from «more than»
    const below = int(rng, 0, v - 2);
    cs[below] = Math.max(1, cs[below]!);
    const dots = (c: number) => (c ? '●'.repeat(c) : '(لا نقاط)'), plot = cs.map((c, i) => `${i + 1}: ${dots(c)}`).join('، ');
    const plotEn = cs.map((c, i) => `${i + 1}: ${c ? '●'.repeat(c) : '(no dots)'}`).join(', ');
    const at = sum(cs.slice(v - 1)), above = sum(cs.slice(v)), all = sum(cs);
    return { eq: plot, answer: String(at), wrongs: countOpts(at, [above, all - at, all, at + 1]), ar: `يبين التمثيل بالنقاط الآتي عدد الساعات التي قضاها كل طالب في القراءة خلال أسبوع، وكل نقطة تمثل طالبًا واحدًا: ${plot}. كم طالبًا قرأ ${v} ساعات أو أكثر؟`, en: `The dot plot shows how many hours each pupil spent reading in a week, one dot per pupil: ${plotEn}. How many pupils read for ${v} hours or more?` };
  }
  if (q === 4) { // organise raw data: how often one value occurs
    const L = grade <= 1 ? int(rng, 6, 8) : int(rng, 8, 10), top = grade <= 1 ? 6 : 9;
    const xs = Array.from({ length: L }, () => int(rng, 3, top)), v = pick(rng, xs), c = xs.filter(x => x === v).length;
    return { eq: list(xs), answer: String(c), wrongs: countOpts(c, [L, v, c + 1, c - 1]), ar: `سجّلت المعلمة عدد الأقلام في حقيبة كل طالب: ${list(xs)}. عند تنظيم هذه البيانات في جدول، كم طالبًا في حقيبته ${v} ${tamyiz(v, 'أقلام', 'قلمًا', 'قلم')}؟`, en: `A teacher recorded how many pencils are in each pupil's bag: ${listEn(xs)}. When the data are put in a table, how many pupils have ${v} pencils in their bag?` };
  }
  if (q === 5) { // compare two rows of a picture graph
    const pk = grade === 2 && rng() < 0.6 ? 2 : 1;
    const [b1, b2] = shuffle(rng, BIRDS).slice(0, 2) as [[string, string], [string, string]];
    const a = int(rng, 3, 9);
    let b = int(rng, 3, 8);
    if (b >= a) b += 1;
    const big = a > b ? b1 : b2, small = a > b ? b2 : b1, d = Math.abs(a - b) * pk;
    const pics = (x: number) => `${x} ${tamyiz(x, 'صور', 'صورةً', 'صورة')}`;
    return { eq: `${a}, ${b}, ${pk}`, answer: String(d), wrongs: countOpts(d, [...(pk === 2 ? [Math.abs(a - b)] : []), (a + b) * pk, Math.max(a, b) * pk, d + 1, d - 1]), ar: `في تمثيل بالصور للطيور التي شاهدها طلاب في رحلة، كل صورة تمثل ${pk === 1 ? 'طائرًا واحدًا' : 'طائرين'}: ${b1[0]}: ${pics(a)}، ${b2[0]}: ${pics(b)}. بكم يزيد عدد ${big[0]} على عدد ${small[0]}؟`, en: `In a picture graph of the birds pupils saw on a trip, each picture stands for ${pk === 1 ? 'one bird' : 'two birds'}: ${b1[1]}: ${a} pictures, ${b2[1]}: ${b} pictures. How many more ${big[1]} than ${small[1]} were there?` };
  }
  if (q === 6) { // a tally: each bundle is five marks
    const bundles = int(rng, 1, 4), single = int(rng, 1, 4), v = 5 * bundles + single;
    return { eq: `${bundles}, ${single}`, answer: String(v), wrongs: countOpts(v, [bundles + single, 4 * bundles + single, 5 * bundles, 5 * (bundles + 1)]), ar: `في جدول الإشارات تمثل كل حزمة 5 إشارات. سجّل سامر السيارات الحمراء التي مرّت أمام المدرسة، فكان عدد الحزم ${bundles} وعدد الإشارات المنفردة ${single}. كم سيارة حمراء مرّت أمام المدرسة؟`, en: `In a tally chart each bundle stands for 5 marks. Samer tallied the red cars passing the school: ${bundles} bundle${bundles > 1 ? 's' : ''} and ${single} single mark${single > 1 ? 's' : ''}. How many red cars passed the school?` };
  }
  if (q === 7) { // represent: how many pictures to draw for a number
    const pk = pick(rng, [2, 5, 10]), pics = int(rng, 2, 9), v = pk * pics;
    return { eq: `${v}, ${pk}`, answer: String(pics), wrongs: countOpts(pics, [v, v - pk, pics + 1, pics - 1]), ar: `في تمثيل بالصور تمثل كل صورة ${pk === 2 ? 'طالبين' : `${pk} طلاب`}. إذا كان عدد الطلاب الذين يحبون الرسم ${v}، فكم صورة تُرسم لتمثيلهم؟`, en: `In a picture graph each picture stands for ${pk} pupils. If ${v} pupils like drawing, how many pictures are drawn to show them?` };
  }
  const hi = vals.indexOf(Math.max(...vals)), lo = vals.indexOf(Math.min(...vals));
  // the other categories first, then fruits not in the table, so there are always three wrong options
  const others = (i: number) => [...cats.filter((_, j) => j !== i), ...CATS.filter(c => !cats.includes(c))].map(c => c[0]).slice(0, 3);
  const head = `${where}${tab}.`, headEn = `${whereEn}${tabEn}.`;
  if (q === 0) return { eq: tab, answer: cats[hi]![0], wrongs: others(hi), ar: `${head} أي نوع هو الأكثر ${key === 2 ? 'عددًا' : 'تفضيلًا'}؟`, en: `${headEn} Which fruit has the most?` };
  if (q === 1) return { eq: tab, answer: cats[lo]![0], wrongs: others(lo), ar: `${head} أي نوع هو الأقل ${key === 2 ? 'عددًا' : 'تفضيلًا'}؟`, en: `${headEn} Which fruit has the least?` };
  if (q === 2) { const d = vals[hi]! - vals[lo]!; return { eq: tab, answer: String(d), wrongs: countOpts(d, [vals[hi]!, d + 1, d - 1, vals[hi]! + vals[lo]!]), ar: `${head} بكم يزيد عدد الأكثر على عدد الأقل؟`, en: `${headEn} By how many does the largest exceed the smallest?` }; }
  const t = sum(vals);
  return { eq: tab, answer: String(t), wrongs: countOpts(t, [t - 1, t + 1, Math.max(...vals), t + key]), ar: `${head} ما المجموع الكلي؟`, en: `${headEn} What is the total?` };
});

/**
 * Since 2026-10-16 also the population and the sample (جمع البيانات), and the
 * mean and median of data already organised in a frequency table.
 */
const freqTable = T('freq_table', /^(?:الجداول التكراريه|جمع البيانات)$/, [6, 6], ({ rng, diff }) => {
  const n = span(diff, 15, 20, 25), hi = span(diff, 4, 5, 6);
  const kind = pick(rng, [0, 0, 1, 2, 3]); // 0: the frequency of a value, or the most frequent value
  if (kind === 1) { // population and sample
    const P = 100 * int(rng, 3, 9), s = 5 * int(rng, 4, 16), sample = rng() < 0.6;
    const ans = sample ? s : P;
    return { eq: `${P}, ${s}`, answer: String(ans), wrongs: countOpts(ans, [sample ? P : s, P - s, P + s, sample ? s * 2 : P / 2]), ar: `أراد مدير مدرسة فيها ${P} طالب معرفة الرياضة المفضلة لدى طلبتها، فاختار منهم ${s} طالبًا عشوائيًا ووزّع عليهم استبانة. ما حجم ${sample ? 'العينة' : 'المجتمع'}؟`, en: `A head teacher of a school with ${P} students wants to know their favourite sport, so picks ${s} of them at random and gives them a questionnaire. What is the size of the ${sample ? 'sample' : 'population'}?` };
  }
  if (kind === 2 || kind === 3) { // mean or median of a frequency table (value: frequency)
    for (;;) {
      const vals = Array.from({ length: hi }, (_, i) => i + 1), f = vals.map(() => int(rng, 1, 8));
      const N = sum(f), S = sum(vals.map((v, i) => v * f[i]!));
      const table = vals.map((v, i) => `${v}: ${f[i]}`).join('، '), tableEn = vals.map((v, i) => `${v}: ${f[i]}`).join(', ');
      const head = `يبين الجدول التكراري الآتي (عدد الكتب: عدد الطلاب) عدد الكتب التي قرأها كل طالب في صف خلال شهر: ${table}.`;
      const headEn = `The frequency table (books read: number of students) shows how many books each student in a class read in a month: ${tableEn}.`;
      const unweighted = sum(vals) / vals.length, modal = mode(vals.flatMap((v, i) => Array<number>(f[i]!).fill(v)));
      if (kind === 2) {
        if ((10 * S) % N !== 0) continue; // a whole number or one decimal place
        const mean = S / N;
        return { eq: table, answer: n1(mean), wrongs: decOpts(mean, [unweighted, S / vals.length, mean + 1, ...(modal !== null ? [modal] : [])].filter(v => v !== mean), 0.5), ar: `${head} ما الوسط الحسابي لعدد الكتب؟`, en: `${headEn} What is the mean number of books?` };
      }
      const md = median(vals.flatMap((v, i) => Array<number>(f[i]!).fill(v)));
      return { eq: table, answer: n1(md), wrongs: decOpts(md, [unweighted, median(f), md + 1, ...(modal !== null ? [modal] : [])].filter(v => v !== md), 0.5), ar: `${head} ما وسيط عدد الكتب؟`, en: `${headEn} What is the median number of books?` };
    }
  }
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, 1, hi));
    const v = pick(rng, [...new Set(xs)]);
    const f = xs.filter(x => x === v).length;
    const m = mode(xs);
    if (rng() < 0.5) return { eq: list(xs), answer: String(f), wrongs: countOpts(f, [f + 1, f - 1, v, n - f]), ar: `سُجّلت ${n} قراءة: ${list(xs)}. ما تكرار القيمة ${v}؟`, en: `${n} readings were recorded: ${listEn(xs)}. What is the frequency of the value ${v}?` };
    if (m === null) continue;
    return { eq: list(xs), answer: String(m), wrongs: countOpts(m, [m + 1, xs.filter(x => x === m).length, Math.max(...xs), Math.min(...xs)]), ar: `سُجّلت ${n} قراءة: ${list(xs)}. ما القيمة الأكثر تكرارًا؟`, en: `${n} readings were recorded: ${listEn(xs)}. Which value occurs most often?` };
  }
});

const classOf = (w: number, lo: number, v: number) => { const a = lo + Math.floor((v - lo) / w) * w; return [a, a + w - 1] as const; };
/**
 * Grouping raw data (a class's frequency, the modal class) and, since
 * 2026-10-16, reading a grouped table (how many at or above a mark), a
 * histogram (the total, the tallest bar) and — Grade 9 — a class midpoint and
 * the mean estimated from midpoints.
 */
const grouped = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const w = pick(rng, [5, 10]), lo = 0;
  const kind = pick(rng, grade >= 9 ? [0, 0, 1, 2, 3, 4] : [0, 0, 1, 2]);
  if (kind > 0) {
    const s0 = w * int(rng, 0, 3), size = span(diff, 4, 5, 5);
    const starts = Array.from({ length: size }, (_, i) => s0 + i * w);
    const label = (a: number) => `${a}–${a + w - 1}`;
    if (kind === 4) {
      const a = pick(rng, starts), mid = (2 * a + w - 1) / 2;
      return { eq: label(a), answer: n1(mid), wrongs: decOpts(mid, [2 * a + w - 1, w - 1, a + w - 1, a + w / 2], 0.5), ar: `في جدول تكراري ذي فئات لعلامات طلاب، ما مركز الفئة ${label(a)}؟`, en: `In a grouped frequency table of marks, what is the midpoint of the class ${label(a)}?` };
    }
    for (;;) {
      const f = starts.map(() => int(rng, 1, 12)), N = sum(f);
      const table = starts.map((a, i) => `${label(a)}: ${f[i]}`).join('، '), tableEn = starts.map((a, i) => `${label(a)}: ${f[i]}`).join(', ');
      if (kind === 1) {
        const j = int(rng, 1, size - 1), cut = starts[j]!, above = sum(f.slice(j)), up = rng() < 0.5, ans = up ? above : N - above;
        return { eq: table, answer: String(ans), wrongs: countOpts(ans, [f[j]!, N, up ? N - above : above, ans + f[j]!]), ar: `يبين الجدول التكراري الآتي (الفئة: التكرار) علامات طلاب صف في اختبار: ${table}. كم طالبًا علامته ${up ? `${cut} فأكثر` : `أقل من ${cut}`}؟`, en: `The frequency table (class: frequency) shows a class's test marks: ${tableEn}. How many students scored ${up ? `${cut} or more` : `less than ${cut}`}?` };
      }
      const head = `في مدرج تكراري يمثل أطوال نباتات بالسنتيمتر، الفئات وارتفاعات أعمدتها (الفئة: الارتفاع): ${table}.`;
      const headEn = `A histogram of plant heights in cm has these classes and bar heights (class: height): ${tableEn}.`;
      if (kind === 2) {
        if (rng() < 0.5) return { eq: table, answer: String(N), wrongs: countOpts(N, [size, Math.max(...f), N - f[0]!, N + size]), ar: `${head} ما عدد النباتات الكلي؟`, en: `${headEn} How many plants are there in all?` };
        const top = Math.max(...f);
        if (f.filter(v => v === top).length > 1) continue;
        const ti = f.indexOf(top);
        return { eq: table, answer: label(starts[ti]!), wrongs: starts.filter((_, i) => i !== ti).map(label).slice(0, 3), ar: `${head} ما الفئة التي يمثلها أطول عمود؟`, en: `${headEn} Which class does the tallest bar stand for?` };
      }
      // kind 3: the mean estimated from class midpoints; twice each midpoint is whole
      const mids2 = starts.map(a => 2 * a + w - 1), S2 = sum(mids2.map((m, i) => m * f[i]!));
      if ((10 * S2) % (2 * N) !== 0) continue; // a whole number or one decimal place
      const mean = S2 / (2 * N), unweighted = sum(mids2) / (2 * size);
      if (mean === unweighted) continue;
      return { eq: table, answer: n1(mean), wrongs: decOpts(mean, [unweighted, S2 / (2 * size), mean + w, mean - w].map(v => Math.round(v * 10) / 10).filter(v => v !== mean), 0.5), ar: `يبين الجدول التكراري الآتي (الفئة: التكرار) علامات طلاب صف في اختبار: ${table}. ما الوسط الحسابي التقريبي للعلامات باستعمال مراكز الفئات؟`, en: `The frequency table (class: frequency) shows a class's test marks: ${tableEn}. Estimate the mean mark using the class midpoints.` };
    }
  }
  for (;;) {
    const n = span(diff, 16, 20, 24);
    const xs = Array.from({ length: n }, () => int(rng, 1, w * 4 - 1));
    const cls = new Map<number, number>();
    xs.forEach(x => { const [a] = classOf(w, lo, x); cls.set(a, (cls.get(a) ?? 0) + 1); });
    const tops = [...cls.entries()].sort((a, b) => b[1] - a[1]);
    if (tops.length < 3 || tops[0]![1] === tops[1]![1]) continue;
    const label = (a: number) => `${a}–${a + w - 1}`;
    const head = `سُجّلت ${n} علامة: ${list(xs)}. نظّمها في فئات طول كل منها ${w}.`;
    const headEn = `${n} marks were recorded: ${listEn(xs)}. They are grouped in classes of width ${w}.`;
    const pickClass = [...cls.keys()][int(rng, 0, cls.size - 1)]!;
    if (rng() < 0.5) { const f = cls.get(pickClass)!; return { eq: list(xs), answer: String(f), wrongs: countOpts(f, [f + 1, f - 1, n - f, cls.size]), ar: `${head} ما تكرار الفئة ${label(pickClass)}؟`, en: `${headEn} What is the frequency of the class ${label(pickClass)}?` }; }
    const modal = tops[0]![0];
    const others = [...cls.keys()].filter(a => a !== modal).map(label);
    while (others.length < 3) others.push(label(Math.max(...cls.keys(), modal) + w * (others.length + 1)));
    return { eq: list(xs), answer: label(modal), wrongs: others.slice(0, 3), ar: `${head} ما الفئة المنوالية (الأكثر تكرارًا)؟`, en: `${headEn} Which is the modal class (the one with the highest frequency)?` };
  }
});

// ─── dispersion (Grade 9) ───────────────────────────────────────────────────

const dispersion = T('dispersion', /^مقاييس التشتت$/, [9, 9], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0 || k === 1) {
    const n = int(rng, 6, 9), xs = Array.from({ length: n }, () => int(rng, 3, 60));
    const r = Math.max(...xs) - Math.min(...xs);
    if (r === 0) return dispersion.make({ rng, diff, grade: 9 });
    return { eq: list(xs), answer: String(r), wrongs: countOpts(r, [r + 1, Math.max(...xs), r - 1, Math.round(sum(xs) / n)]), ar: `ما مدى القيم: ${list(xs)}؟`, en: `What is the range of ${listEn(xs)}?` };
  }
  if (k === 2) { // interquartile range: even n, Q1 and Q3 are the medians of the lower and upper halves
    const n = pick(rng, [8, 10, 12]);
    const xs = sorted(Array.from({ length: n }, () => int(rng, 2, 60)));
    const lowerHalf = xs.slice(0, n / 2), upperHalf = xs.slice(n / 2);
    const iqr = median(upperHalf) - median(lowerHalf);
    const shown = shuffle(rng, xs);
    return { eq: list(shown), answer: n1(iqr), wrongs: decOpts(iqr, [Math.max(...xs) - Math.min(...xs), median(upperHalf), iqr + 1, iqr / 2].map(v => Math.round(v * 2) / 2).filter(v => v !== iqr && v > 0), 0.5), ar: `ما المدى الربيعي للقيم: ${list(shown)}؟ (الربيع الأول والثالث هما وسيطا النصفين الأدنى والأعلى للقيم المرتبة)`, en: `What is the interquartile range of ${listEn(shown)}? (Q1 and Q3 are the medians of the lower and upper halves of the ordered data)` };
  }
  // standard deviation: rejection-sample a small set whose population variance is a perfect square
  for (let attempt = 0; attempt < 5000; attempt++) {
    const n = pick(rng, [4, 5, 6]);
    const xs = dataWithMean(rng, n, 2, 30), m = sum(xs) / n;
    const ss = sum(xs.map(x => (x - m) ** 2));
    if (ss % n !== 0) continue;
    const v = ss / n, sd = Math.sqrt(v);
    if (!Number.isInteger(sd) || sd === 0) continue;
    return { eq: list(xs), answer: String(sd), wrongs: countOpts(sd, [v, sd + 1, m, sd * 2, Math.sqrt(ss / (n - 1)) | 0]), ar: `ما الانحراف المعياري للقيم: ${list(xs)}؟ (استعمل القسمة على n)`, en: `What is the standard deviation of ${listEn(xs)}? (divide by n)` };
  }
  return dispersion.make({ rng, diff: 'easy', grade: 9 });
});

// ─── Grade 10: scatter, cumulative frequency, grouped data ──────────────────

function correlation(pts: Array<[number, number]>): number {
  const n = pts.length, mx = sum(pts.map(p => p[0])) / n, my = sum(pts.map(p => p[1])) / n;
  let sxy = 0, sxx = 0, syy = 0;
  pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
}
const CORR = ['ارتباط طردي (موجب)', 'ارتباط عكسي (سالب)', 'لا يوجد ارتباط'];
/**
 * The lesson's objectives, one kind each since 2026-10-15: read the correlation
 * from the points, use the line of best fit to estimate y or x, and find its
 * slope from two points on it. It used to ask the correlation only.
 */
const scatter = T('scatter', /^اشكال الانتشار$/, [10, 10], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1 || k === 2) {
    const m = pick(rng, [2, 3, 4, 5, -2, -3]), b = m > 0 ? int(rng, 1, 12) : int(rng, 40, 60);
    const x = int(rng, 2, 12), y = m * x + b;
    if (y <= 0) return scatter.make({ rng, diff: 'easy', grade: 10 });
    const line = `y = ${signed(m)}x + ${b}`;
    if (k === 1) return { eq: `${m}, ${b}, x=${x}`, answer: String(y), wrongs: countOpts(y, [m * x, x + b, m + x + b, y + m]), ar: `معادلة المستقيم الأفضل مطابقة لشكل انتشار هي ${line}. ما القيمة التقديرية لـ y عندما x = ${x}؟`, en: `The line of best fit for a scatter plot is ${line}. Estimate y when x = ${x}.` };
    return { eq: `${m}, ${b}, y=${y}`, answer: String(x), wrongs: countOpts(x, [Math.abs(y - b), y + b, Math.round(y / Math.abs(m)), x + 1]), ar: `معادلة المستقيم الأفضل مطابقة لشكل انتشار هي ${line}. ما القيمة التقديرية لـ x عندما y = ${y}؟`, en: `The line of best fit for a scatter plot is ${line}. Estimate x when y = ${y}.` };
  }
  if (k === 3) {
    const m = pick(rng, [1, 2, 3, 4, -1, -2, -3]), d = int(rng, 2, 6);
    const x1 = int(rng, 1, 6), y1 = m > 0 ? int(rng, 2, 15) : int(rng, 25, 40);
    const x2 = x1 + d, y2 = y1 + m * d;
    return { eq: `${x1}, ${y1}, ${x2}, ${y2}`, answer: signed(m), wrongs: numWrongs(m, [-m, d, y2 - y1, m + 1], signed), ar: `يمرّ المستقيم الأفضل مطابقة لشكل انتشار بالنقطتين (${x1} ، ${y1}) و (${x2} ، ${y2}). ما ميله؟`, en: `The line of best fit for a scatter plot passes through (${x1}, ${y1}) and (${x2}, ${y2}). What is its slope?` };
  }
  for (;;) {
    const kind = int(rng, 0, 2), n = 7;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const ys = xs.map(x => (kind === 0 ? 2 * x : kind === 1 ? 20 - 2 * x : int(rng, 2, 18)) + (kind === 2 ? 0 : int(rng, -2, 2)));
    if (ys.some(y => y < 0)) continue;
    const pts = xs.map((x, i) => [x, ys[i]!] as [number, number]);
    const r = correlation(pts);
    const real = r > 0.85 ? 0 : r < -0.85 ? 1 : Math.abs(r) < 0.3 ? 2 : -1;
    if (real < 0) continue;
    const text = pts.map(p => `(${p[0]} ، ${p[1]})`).join(' ');
    return { eq: text, answer: CORR[real]!, wrongs: CORR.filter((_, i) => i !== real), ar: `يبين الجدول مجموعة من النقاط (x ، y): ${text}. ما نوع الارتباط بين x و y في شكل الانتشار؟`, en: `Points (x, y): ${text}. What kind of correlation does their scatter plot show?` };
  }
});

/**
 * Cumulative frequency, the median class — and since 2026-10-15 the rest of the
 * lesson: the position of a quartile, the interquartile range, and a percentile
 * rank read off the curve.
 */
const cumulative = T('cumulative', /^المنحني التكراري التراكمي$/, [10, 10], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) {
    const q1 = int(rng, 20, 55), q3 = q1 + int(rng, 8, 30), d = q3 - q1;
    return { eq: `${q1}, ${q3}`, answer: String(d), wrongs: countOpts(d, [q1 + q3, q3, q1, Math.round((q1 + q3) / 2)]), ar: `من المنحنى التكراري التراكمي لعلامات طلبة صف: الربيع الأول Q1 = ${q1} والربيع الثالث Q3 = ${q3}. ما المدى الربيعي؟`, en: `From the cumulative frequency curve of a class's marks, Q1 = ${q1} and Q3 = ${q3}. What is the interquartile range?` };
  }
  if (k === 4) {
    const n = pick(rng, [40, 60, 80, 120, 200]), pct = pick(rng, [10, 20, 25, 30, 40, 60, 70, 75, 80, 90]);
    const c = (n * pct) / 100;
    if (!Number.isInteger(c)) return cumulative.make({ rng, diff, grade: 10 });
    const score = 5 * int(rng, 8, 18);
    return { eq: `${n}, ${score}, ${c}`, answer: `${pct}%`, wrongs: wrongsFrom(`${pct}%`, [...(c <= 100 ? [`${c}%`] : []), `${100 - pct}%`, `${score}%`], j => `${pct + 5 * Math.abs(j)}%`), ar: `في المنحنى التكراري التراكمي لعلامات ${n} ${n % 100 === 0 ? 'طالب' : 'طالبًا'}، التكرار التراكمي المقابل للعلامة ${score} هو ${c}. ما الرتبة المئينية للعلامة ${score}؟`, en: `On the cumulative frequency curve of ${n} students' marks, the cumulative frequency at a mark of ${score} is ${c}. What is the percentile rank of ${score}?` };
  }
  const w = pick(rng, [10, 20]), size = span(diff, 4, 5, 6);
  const f = Array.from({ length: size }, () => int(rng, 2, 12));
  const label = (i: number) => `${i * w}–${(i + 1) * w - 1}`;
  const table = f.map((v, i) => `${label(i)}: ${v}`).join('، ');
  const tableEn = f.map((v, i) => `${label(i)}: ${v}`).join(', ');
  const n = sum(f);
  if (k === 2) {
    if (n % 4 !== 0) return cumulative.make({ rng, diff, grade: 10 });
    const third = rng() < 0.5, at = third ? (3 * n) / 4 : n / 4;
    return { eq: table, answer: String(at), wrongs: countOpts(at, [third ? n / 4 : (3 * n) / 4, n / 2, n, at + 1]), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما ترتيب ${third ? 'الربيع الثالث Q3' : 'الربيع الأول Q1'} بين البيانات مرتّبةً تصاعديًا؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the position of ${third ? 'the upper quartile Q3' : 'the lower quartile Q1'} in the data in ascending order?` };
  }
  const j = int(rng, 1, size - 2);
  if (k === 0) { const c = sum(f.slice(0, j + 1)); return { eq: table, answer: String(c), wrongs: countOpts(c, [f[j]!, c + f[j + 1]!, c - f[0]!, n]), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما التكرار التراكمي حتى نهاية الفئة ${label(j)}؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the cumulative frequency up to the end of the class ${label(j)}?` }; }
  let acc = 0, mc = 0;
  for (let i = 0; i < size; i++) { acc += f[i]!; if (acc >= n / 2) { mc = i; break; } }
  const others = Array.from({ length: size }, (_, i) => i).filter(i => i !== mc).map(label);
  return { eq: table, answer: label(mc), wrongs: others.slice(0, 3), ar: `الجدول التكراري (الفئة: التكرار): ${table}. في أي فئة يقع الوسيط (القيمة التي ترتيبها n/2)؟`, en: `Frequency table (class: frequency): ${tableEn}. In which class does the median (the value in position n/2) lie?` };
});

const groupedMean = T('grouped_mean', /^مقاييس التشتت للجداول التكراريه ذات الفئات$/, [10, 10], ({ rng, diff }) => {
  const w = pick(rng, [4, 6, 10]);
  for (;;) {
    const k = span(diff, 3, 5, 5), half = (k - 1) / 2;
    const mid0 = half * w + w / 2 + int(rng, 0, 6) * w; // centre class midpoint; the first class starts at a non-negative multiple of w
    const f = Array.from({ length: k }, () => int(rng, 1, 8));
    for (let i = 0; i < half; i++) f[k - 1 - i] = f[i]!; // symmetric, so the mean is the centre midpoint
    const n = sum(f);
    const dev = f.map((v, i) => v * ((i - half) * w) ** 2);
    const variance = sum(dev) / n;
    if (variance * 10 !== Math.round(variance * 10) || variance === 0) continue;
    const mids = Array.from({ length: k }, (_, i) => mid0 + (i - half) * w);
    const lo = (m: number) => m - w / 2, hi = (m: number) => m + w / 2;
    // continuous classes: «60 إلى أقل من 70», so a boundary value belongs to exactly one class
    const table = mids.map((m, i) => `${lo(m)} إلى أقل من ${hi(m)}: ${f[i]}`).join('، ');
    const tableEn = mids.map((m, i) => `${lo(m)} to under ${hi(m)}: ${f[i]}`).join(', ');
    if (rng() < 0.5) return { eq: table, answer: String(mid0), wrongs: countOpts(mid0, [mid0 + w, mid0 - w, mids[0]!, mids[k - 1]!]), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما الوسط الحسابي التقريبي باستعمال مراكز الفئات؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the approximate mean using class midpoints?` };
    return { eq: table, answer: n1(variance), wrongs: decOpts(variance, [Math.sqrt(variance), variance * 2, sum(dev) / (n - 1), mid0].map(v => Math.round(v * 10) / 10).filter(v => v !== variance && v > 0), 0.5), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما التباين التقريبي باستعمال مراكز الفئات (القسمة على مجموع التكرارات)؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the approximate variance using class midpoints (divide by the total frequency)?` };
  }
});

void gcd; void signed; void tier;

export const STATS_TOPICS: readonly Topic[] = [
  certainty('certainty_g3', /^اكيد ممكن مستحيل$/, [3, 3]), { id: 'certainty_g4', match: /^التجربه العشوائيه وانواع الحوادث$/, grades: [4, 4], make: c => (c.rng() < 0.4 ? outcomes : certainty('c4', /./, [4, 4])).make(c) },
  likelihood,
  probability('prob_g6', /^الاحتمالات$/, 6), probability('prob_g7', /^الاحتمالات$/, 7), experimental, counting, compound,
  venn('venn_g3', /^اشكال ڤن$/, [3, 3]), venn('venn_g4', /^تمثيل البيانات باشكال ڤن$/, [4, 4]), venn('venn_g9', /^الاحتمالات واشكال ڤن$/, [9, 9]), geometricProb,
  meanT('mean_g5', /^الوسط الحسابي$/, [5, 5]), meanT('mean_g7', /^الوسط الحسابي$/, [7, 7]),
  medianModeT('median_mode_g5', /^الوسيط والمنوال$/, [5, 5], ['median', 'mode', 'medianMissing', 'modeContext']), medianModeT('range_g5', /^المدي$/, [5, 5], ['range', 'rangeTable', 'rangeEnd']),
  medianModeT('median_mode_range_g7', /^الوسيط والمنوال والمدي$/, [7, 7], ['median', 'mode', 'range', 'medianMissing', 'bestMeasure']),
  stemLeaf,
  readData('read_data_g12', /^(?:جداول البيانات|تمثيل البيانات بالصور|تفسير بيانات ممثله بالصور|تفسير البيانات الممثله بالصور|تفسير البيانات الممثله بجدول الاشارات|جمع البيانات وتنظيمها)$/, [1, 2]),
  readData('read_data_g34', /^(?:تمثيل البيانات بالاعمده|تفسير البيانات الممثله بالاعمده|تمثيل البيانات بالنقاط)$/, [3, 4]),
  freqTable,
  grouped('grouped_g6', /^الجداول والمخططات التكراريه ذات الفئات$/, [6, 6]), grouped('grouped_g9', /^(?:الجداول التكراريه ذات الفئات|المدرجات التكراريه)$/, [9, 9]),
  dispersion, scatter, cumulative, groupedMean,
];
