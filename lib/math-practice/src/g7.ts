/**
 * Grade 7 lessons that had no offline questions (Grade 7 audit, 2026-11-14):
 * «التطابق» and the two problem-solving plans, «الحل العكسي» and «الرسم».
 *
 * Same contract as the other topic modules: the lesson title picks the
 * generator, and every answer is computed from the numbers in the stem. A plan
 * lesson is served with problems the plan solves, as Grade 6 «حل مسألة أبسط»
 * and Grade 4's two plans are: the stem is a problem, the key its answer.
 */
import { int, numWrongs, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [7, 7], make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const ints = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(c => Number.isInteger(c) && c > 0));
const shuffle = <X,>(rng: Rng, xs: readonly X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const counted = (n: number, plural: string, acc: string, gen: string) => `${n} ${tamyiz(n, plural, acc, gen)}`;
const dinars = (n: number) => counted(n, 'دنانير', 'دينارًا', 'دينار');
const minutes = (n: number) => counted(n, 'دقائق', 'دقيقةً', 'دقيقة');
const deg = (ans: number, cands: number[]) => wrongsFrom(`${ans}°`, cands.filter(c => Number.isInteger(c) && c > 0 && c < 180).map(c => `${c}°`), k => `${ans + Math.abs(k) * 5}°`);

// ─── congruence ────────────────────────────────────────────────────────────

const LETTERS: Array<[string, string]> = [['ABC', 'DEF'], ['PQR', 'XYZ'], ['LMN', 'STU'], ['ABC', 'KLM']];
/** A congruence «ABC ≅ (a permutation of DEF)» and its vertex map. */
function triangles(rng: Rng) {
  const [one, other] = pick(rng, LETTERS);
  const two = shuffle(rng, [...other]).join('');
  const map: Record<string, string> = { [one[0]!]: two[0]!, [one[1]!]: two[1]!, [one[2]!]: two[2]! };
  const side = (s: string) => map[s[0]!]! + map[s[1]!]!;
  return { one, two, map, side };
}

/** «التطابق»: corresponding sides and angles, a congruent shape's perimeter, an unknown from equal sides, congruent or not. */
const congruence = T('congruence_g7', /^التطابق$/, ({ rng, diff }) => {
  const k = int(rng, 0, 5);
  if (k === 0) { // the corresponding side
    const { one, two, side } = triangles(rng);
    const s = pick(rng, [one[0]! + one[1]!, one[1]! + one[2]!, one[0]! + one[2]!]), ans = side(s);
    const all = [two[0]! + two[1]!, two[1]! + two[2]!, two[0]! + two[2]!, two[1]! + two[0]!].filter(x => x !== ans && [...x].reverse().join('') !== ans);
    return { eq: `side ${one} ${two} ${s}`, answer: ans, wrongs: [...new Set(all)].slice(0, 2).concat(s), ar: `المثلث ${one} يطابق المثلث ${two}. ما الضلع المناظر للضلع ${s}؟`, en: `Triangle ${one} is congruent to triangle ${two}. Which side corresponds to side ${s}?` };
  }
  if (k === 1) { // a side's length from its corresponding side
    const { one, two, side } = triangles(rng);
    const ls = shuffle(rng, [int(rng, 4, 9), int(rng, 10, 14), int(rng, 15, 20)]);
    const names = [one[0]! + one[1]!, one[1]! + one[2]!, one[0]! + one[2]!];
    const i = int(rng, 0, 2), asked = side(names[i]!);
    return { eq: `length ${one} ${two} ${names[i]}`, answer: String(ls[i]), wrongs: ints(ls[i]!, [...ls.filter((_, j) => j !== i), ls[i]! * 2, ls[i]! + 1]), ar: `المثلث ${one} يطابق المثلث ${two}، حيث ${names.map((n, j) => `${n} = ${ls[j]} سم`).join(' و ')}. ما طول الضلع ${asked} بالسنتيمتر؟`, en: `Triangle ${one} is congruent to triangle ${two}, with ${names.map((n, j) => `${n} = ${ls[j]} cm`).join(', ')}. How long is side ${asked} in centimetres?` };
  }
  if (k === 2) { // an angle: given directly, or the third through the angle sum
    const { one, two, map } = triangles(rng);
    const a = int(rng, 35, 75), b = int(rng, 30, 70), c = 180 - a - b;
    const vals: Record<string, number> = { [one[0]!]: a, [one[1]!]: b, [one[2]!]: c };
    const third = rng() < 0.6, src = third ? one[2]! : pick(rng, [one[0]!, one[1]!]), ans = vals[src]!;
    return { eq: `angle ${one} ${two} ${src}`, answer: `${ans}°`, wrongs: deg(ans, [a, b, c, 180 - ans, 90 - ans].filter(x => x !== ans)), ar: `المثلث ${one} يطابق المثلث ${two}. إذا كان قياس الزاوية ${one[0]} يساوي ${a}° وقياس الزاوية ${one[1]} يساوي ${b}°، فما قياس الزاوية ${map[src]}؟`, en: `Triangle ${one} is congruent to triangle ${two}. If angle ${one[0]} measures ${a}° and angle ${one[1]} measures ${b}°, what does angle ${map[src]} measure?` };
  }
  if (k === 3) { // a congruent shape's perimeter
    const s = Array.from({ length: 4 }, () => int(rng, 3, span(diff, 9, 14, 20))), P = s.reduce((x, y) => x + y, 0);
    return { eq: `perimeter ${s.join(',')}`, answer: String(P), wrongs: ints(P, [P - s[0]!, 2 * P, P + s[3]!, s[0]! * 4]), ar: `الشكل الرباعي ABCD يطابق الشكل الرباعي PQRS، وأطوال أضلاعه ${s.map(x => `${x} سم`).join(' و ')}. ما محيط الشكل PQRS بالسنتيمتر؟`, en: `Quadrilateral ABCD is congruent to quadrilateral PQRS, and its sides are ${s.map(x => `${x} cm`).join(', ')}. What is the perimeter of PQRS in centimetres?` };
  }
  if (k === 4) { // an unknown from two corresponding sides
    const { one, two, side } = triangles(rng);
    const m = int(rng, 2, 5), x = int(rng, 2, span(diff, 6, 9, 12)), c = int(rng, 1, 9), L = m * x + c, s = one[0]! + one[1]!;
    return { eq: `solve ${m}x + ${c} = ${L}`, answer: String(x), wrongs: ints(x, [L - c, L / m, x + 1, (L + c) / m]), ar: `المثلث ${one} يطابق المثلث ${two}. إذا كان طول الضلع ${s} يساوي (${m}x + ${c}) سم، وطول الضلع المناظر له ${L} سم، فما قيمة x؟`, en: `Triangle ${one} is congruent to triangle ${two}. Side ${s} is (${m}x + ${c}) cm and its corresponding side ${side(s)} is ${L} cm. What is x?` };
  }
  // congruent, or only similar (or neither)
  const a = int(rng, 3, 9), b = a + int(rng, 1, 6), yes = rng() < 0.5;
  const [c, d] = yes ? (rng() < 0.5 ? [b, a] : [a, b]) : pick(rng, [[2 * a, 2 * b], [a, b + 1], [a + 1, b + 1]] as Array<[number, number]>);
  return { eq: `congruent ${a}x${b} ${c}x${d}`, answer: yes ? 'نعم' : 'لا', wrongs: [yes ? 'لا' : 'نعم'], ar: `مستطيل بُعداه ${a} سم و ${b} سم، ومستطيل آخر بُعداه ${c} سم و ${d} سم. هل الشكلان متطابقان؟ (نعم / لا)`, en: `One rectangle is ${a} cm by ${b} cm and another is ${c} cm by ${d} cm. Are they congruent? (yes / no)` };
});

// ─── problem-solving plan: work backwards ──────────────────────────────────

/** «خطة حل المسألة: الحل العكسي»: the start, from the end and the steps taken. */
const workBackwards = T('work_backwards_g7', /^خطه حل المساله الحل العكسي$/, ({ rng, diff }) => {
  const k = int(rng, 0, 2);
  if (k === 0) { // a number puzzle undone step by step
    for (let t = 0; t < 200; t++) {
      const x = int(rng, 2, span(diff, 15, 30, 50)), m = int(rng, 2, 5), c = int(rng, 1, 12), d = pick(rng, [2, 3, 4]), plus = rng() < 0.5;
      const v = x * m + (plus ? c : -c);
      if (v <= 0 || v % d !== 0) continue;
      const r = v / d, boy = pick(rng, ['سامي', 'خالد', 'عمر', 'يزن']);
      return { eq: `back ${x}`, answer: String(x), wrongs: ints(x, [r * d, (r * d + (plus ? c : -c)) / m, x + 1, r]), ar: `فكّر ${boy} في عدد، ثم ضربه في ${m}، ثم ${plus ? 'أضاف' : 'طرح'} ${c}، ثم قسم الناتج على ${d}، فكان الناتج النهائي ${r}. ما العدد الذي فكّر فيه؟`, en: `A boy thought of a number, multiplied it by ${m}, ${plus ? 'added' : 'subtracted'} ${c}, then divided by ${d} and got ${r}. What was the number?` };
    }
  }
  if (k === 1) { // money: half on one thing, a fixed amount on another
    const left = int(rng, 3, span(diff, 10, 20, 30)), spent = int(rng, 3, span(diff, 10, 15, 25)), start = 2 * (left + spent);
    const girl = pick(rng, ['ليلى', 'سلمى', 'هند', 'جود']);
    return { eq: `money ${start}`, answer: String(start), wrongs: ints(start, [left + spent, 2 * left + spent, start + spent, 2 * left]), ar: `أنفقت ${girl} نصف ما معها على كتاب، ثم ${dinars(spent)} على قلم، فبقي معها ${dinars(left)}. كم دينارًا كان معها في البداية؟`, en: `A girl spent half her money on a book, then ${spent} dinars on a pen, and had ${left} dinars left. How many dinars did she have at the start?` };
  }
  // time: the latest moment to start, from the arrival time and the durations
  const arriveH = int(rng, 7, 8), arriveM = pick(rng, [0, 15, 30, 45]), road = pick(rng, [15, 20, 25, 35]), ready = pick(rng, [30, 40, 45, 50]);
  const t = arriveH * 60 + arriveM - road - ready, hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const ans = hm(t);
  const girl = pick(rng, ['هند', 'ليلى', 'تالا']);
  return { eq: `time ${ans}`, answer: ans, wrongs: wrongsFrom(ans, [hm(t + road), hm(t + ready), hm(t - 10)], k2 => hm(t + 5 * k2)), ar: `يجب أن تصل ${girl} إلى المدرسة الساعة ${hm(arriveH * 60 + arriveM)}. تحتاج ${minutes(road)} للطريق، و${minutes(ready)} لتستعد. متى يجب أن تستيقظ على الأكثر؟`, en: `A girl must reach school at ${hm(arriveH * 60 + arriveM)}. The way takes ${road} minutes and getting ready ${ready} minutes. What is the latest she can wake up?` };
});

// ─── problem-solving plan: draw a diagram ──────────────────────────────────

/** «خطة حل المسألة: الرسم»: problems a sketch makes plain (posts and gaps, cuts and pieces, handshakes, a climbing snail). */
const drawDiagram = T('draw_diagram_g7', /^خطه حل المساله الرسم$/, ({ rng, diff }) => {
  const k = int(rng, 0, 3);
  if (k === 0) {
    const gap = pick(rng, [2, 3, 4, 5, 6]), n = int(rng, 4, span(diff, 8, 12, 16)), L = gap * n, ans = n + 1;
    return { eq: `posts ${L} / ${gap}`, answer: String(ans), wrongs: ints(ans, [n, n - 1, n + 2, L]), ar: `سياج مستقيم طوله ${L} م، تُثبَّت فيه أعمدة كل ${gap} م بدءًا من أحد طرفيه وانتهاءً بالطرف الآخر. كم عمودًا يلزم؟`, en: `A straight fence is ${L} m long, with a post every ${gap} m from one end to the other. How many posts are needed?` };
  }
  if (k === 1) {
    const pieces = int(rng, 3, span(diff, 6, 9, 12)), per = int(rng, 2, 6), ans = (pieces - 1) * per;
    return { eq: `cuts ${pieces} × ${per}`, answer: String(ans), wrongs: ints(ans, [pieces * per, (pieces + 1) * per, ans - 1, pieces + per]), ar: `يريد نجار قطع لوح خشبي إلى ${counted(pieces, 'قطع', 'قطعةً', 'قطعة')}، ويستغرق كل قطع ${minutes(per)}. كم دقيقة يحتاج؟`, en: `A carpenter cuts a plank into ${pieces} pieces, and each cut takes ${per} minutes. How many minutes does he need?` };
  }
  if (k === 2) {
    const n = int(rng, 4, span(diff, 6, 8, 10)), ans = (n * (n - 1)) / 2;
    return { eq: `handshakes ${n}`, answer: String(ans), wrongs: ints(ans, [n * (n - 1), n * n, n, ans + n]), ar: `حضر ${counted(n, 'أشخاص', 'شخصًا', 'شخص')} اجتماعًا، وصافح كل منهم كل واحد من الآخرين مرة واحدة. كم مصافحة حدثت؟`, en: `${n} people meet and each shakes hands once with every other one. How many handshakes are there?` };
  }
  const up = int(rng, 3, 5), down = int(rng, 1, up - 1), depth = up + (up - down) * int(rng, 2, span(diff, 5, 8, 10));
  let h = 0, day = 0;
  for (;;) { day++; h += up; if (h >= depth) break; h -= down; }
  return { eq: `snail ${depth} ${up} ${down}`, answer: String(day), wrongs: ints(day, [depth / (up - down), day + 1, day - 1, depth - up]), ar: `حلزون في قاع بئر عمقها ${depth} م، يصعد ${up} م في النهار وينزلق ${down} م في الليل. بعد كم يومًا يصل إلى أعلى البئر؟`, en: `A snail at the bottom of a ${depth} m well climbs ${up} m by day and slips ${down} m at night. After how many days does it reach the top?` };
});

export const G7_TOPICS: readonly Topic[] = [congruence, workBackwards, drawDiagram];
