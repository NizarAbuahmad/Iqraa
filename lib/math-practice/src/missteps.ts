/**
 * A deliberate, realistic mistake in one step of a bank item's working, for
 * «أين الخطأ؟». Hand-written: an automatic swap can produce another correct
 * line, and a mistake only teaches when it is the kind students make.
 * `stepIndex` is 0-based into `stepsFor(itemId)` and never the last line,
 * which states the result. `missteps.test.ts` checks every entry.
 */
export interface Misstep {
  itemId: string;
  stepIndex: number;
  wrongAr: string;
  wrongEn: string;
  whyAr: string;
  whyEn: string;
}

export const MISSTEPS: readonly Misstep[] = [
  // ── exp_eq ──
  {
    itemId: 'exp-h4', // 2^{x+2} = 2^x + 12
    stepIndex: 0,
    wrongAr: 'نفكّ القوة بقاعدة الضرب: 2^{x+2} = 2^x + 2^2 = 2^x + 4',
    wrongEn: 'Split the power using the product rule: 2^{x+2} = 2^x + 2^2 = 2^x + 4',
    whyAr: 'جمع الأسّين يأتي من ضرب القوتين لا من جمعهما: 2^{x+2} = 2^x · 2^2 = 4 · 2^x.',
    whyEn: 'Adding exponents comes from multiplying powers, not adding them: 2^{x+2} = 2^x · 2^2 = 4 · 2^x.',
  },
  {
    itemId: 'exp-h3', // 4^x = 8^{x−1}
    stepIndex: 3,
    wrongAr: 'نفكّ الأقواس: 2x = 3x − 1',
    wrongEn: 'Expand the brackets: 2x = 3x − 1',
    whyAr: 'العدد 3 يُضرب في كل حد داخل القوس: 3(x − 1) = 3x − 3.',
    whyEn: 'The 3 multiplies every term in the bracket: 3(x − 1) = 3x − 3.',
  },

  // ── system_graph ──
  {
    itemId: 'g-m1', // y = x², y = x + 2
    stepIndex: 1,
    wrongAr: 'ننقل كل الحدود إلى طرف واحد: x² + x − 2 = 0',
    wrongEn: 'Move every term to one side: x² + x − 2 = 0',
    whyAr: 'عند نقل x + 2 إلى الطرف الآخر تتغيّر إشارة كل حد منه: x² − x − 2 = 0.',
    whyEn: 'Moving x + 2 to the other side changes the sign of each of its terms: x² − x − 2 = 0.',
  },
  {
    itemId: 'g-h3', // y = 2x + 1, y = x² − 3
    stepIndex: 2,
    wrongAr: 'نحسب المميّز: Δ = (−2)² − 4(1)(−4) = −12',
    wrongEn: 'Compute the discriminant: Δ = (−2)² − 4(1)(−4) = −12',
    whyAr: 'حاصل ضرب سالبين موجب: −4(1)(−4) = +16، فيكون Δ = 4 + 16 = 20.',
    whyEn: 'A negative times a negative is positive: −4(1)(−4) = +16, so Δ = 4 + 16 = 20.',
  },

  // ── linear_quad ──
  {
    itemId: 'lq-m1', // y = x + 1, y = x² − 3x + 4
    stepIndex: 1,
    wrongAr: 'ننقل كل الحدود إلى الطرف الأيمن: 0 = x² − 2x + 3',
    wrongEn: 'Move every term to the right: 0 = x² − 2x + 3',
    whyAr: 'نقل x إلى الطرف الآخر يطرحه ولا يضيفه: −3x − x = −4x.',
    whyEn: 'Moving x to the other side subtracts it rather than adding it: −3x − x = −4x.',
  },
  {
    itemId: 'lq-e1', // y = x, y = x²
    stepIndex: 2,
    wrongAr: 'نقسم الطرفين على x: x − 1 = 0',
    wrongEn: 'Divide both sides by x: x − 1 = 0',
    whyAr: 'القسمة على x تُضيّع الحل x = 0؛ نُخرج x عاملًا مشتركًا بدلها: x(x − 1) = 0.',
    whyEn: 'Dividing by x loses the solution x = 0; take x out as a common factor instead: x(x − 1) = 0.',
  },

  // ── quad_system ──
  {
    itemId: 'qq-m1', // y = x² − 4, y = −x² + 4
    stepIndex: 1,
    wrongAr: 'نجمع x² ونضيف 4 إلى الطرفين: 2x² = 4، إذن x² = 2',
    wrongEn: 'Add x² and 4 to both sides: 2x² = 4, so x² = 2',
    whyAr: 'ما نضيفه إلى طرف نضيفه إلى الآخر أيضًا: −x² + 4 + x² + 4 = 8، فيكون 2x² = 8.',
    whyEn: 'What is added to one side is added to the other too: −x² + 4 + x² + 4 = 8, so 2x² = 8.',
  },
  {
    itemId: 'qq-h1', // y = x² − 2x, y = −x² + 4
    stepIndex: 2,
    wrongAr: 'نقسم على 2: x² − x − 4 = 0',
    wrongEn: 'Divide by 2: x² − x − 4 = 0',
    whyAr: 'نقسم كل الحدود على 2 ومنها الحد الثابت: −4 ÷ 2 = −2.',
    whyEn: 'Divide every term by 2, the constant included: −4 ÷ 2 = −2.',
  },

  // ── simplify_exp ──
  {
    itemId: 'se-e1', // 2^3 · 2^4
    stepIndex: 0,
    wrongAr: 'الأساس واحد، فنضرب الأسّين: 2^3 · 2^4 = 2^{3×4}',
    wrongEn: 'The base is the same, so multiply the exponents: 2^3 · 2^4 = 2^{3×4}',
    whyAr: 'عند ضرب قوتين لهما الأساس نفسه نجمع الأسّين ولا نضربهما: 2^{3+4}.',
    whyEn: 'When multiplying powers with the same base, add the exponents rather than multiplying them: 2^{3+4}.',
  },
  {
    itemId: 'se-m3', // (2^3 · 2^{−1}) ÷ 2
    stepIndex: 0,
    wrongAr: 'البسط: الأساس واحد فنجمع الأسّين: 2^3 · 2^{−1} = 2^{3+1} = 2^4',
    wrongEn: 'Numerator: the base is the same, so add the exponents: 2^3 · 2^{−1} = 2^{3+1} = 2^4',
    whyAr: 'الأس −1 سالب، فجمعه طرح: 3 + (−1) = 2، فيكون الناتج 2^2.',
    whyEn: 'The exponent −1 is negative, so adding it subtracts: 3 + (−1) = 2, giving 2^2.',
  },

  // ── circle ──
  {
    itemId: 'c-m1', // (x−2)² + (y+1)² = 9
    stepIndex: 2,
    wrongAr: 'نقارن (y+1)² مع (y−k)²: k = 1',
    wrongEn: 'Compare (y+1)² with (y−k)²: k = 1',
    whyAr: 'الصورة القياسية فيها طرح k: (y+1)² = (y−(−1))²، فيكون k = −1.',
    whyEn: 'The standard form subtracts k: (y+1)² = (y−(−1))², so k = −1.',
  },
  {
    itemId: 'c-h1', // x² + y² − 6x + 4y − 3 = 0
    stepIndex: 2,
    wrongAr: 'نضيف 9 و 4 لإكمال المربع: (x² − 6x + 9) + (y² + 4y + 4) = 3',
    wrongEn: 'Add 9 and 4 to complete the square: (x² − 6x + 9) + (y² + 4y + 4) = 3',
    whyAr: 'ما نضيفه إلى طرف يجب أن نضيفه إلى الطرف الآخر: 3 + 9 + 4 = 16.',
    whyEn: 'Whatever is added to one side must be added to the other: 3 + 9 + 4 = 16.',
  },

  // ── trig ──
  {
    itemId: 't-m1', // sin θ = 1/2
    stepIndex: 3,
    wrongAr: 'الربع الثاني: θ = 180° + 30° = 210°',
    wrongEn: 'Second quadrant: θ = 180° + 30° = 210°',
    whyAr: 'زاوية الربع الثاني هي 180° ناقص الزاوية المرجعية؛ أما 210° فتقع في الربع الثالث حيث sin سالبة.',
    whyEn: 'A second-quadrant angle is 180° minus the reference angle; 210° lies in the third quadrant, where sin is negative.',
  },
  {
    itemId: 't-e2', // cos 60°
    stepIndex: 1,
    wrongAr: 'الضلع المجاور للزاوية 60° يساوي √3',
    wrongEn: 'The side adjacent to the 60° angle is √3',
    whyAr: '√3 هو الضلع المقابل للزاوية 60°؛ أما المجاور لها فهو الضلع الأقصر 1.',
    whyEn: '√3 is the side opposite the 60° angle; the side adjacent to it is the shortest side, 1.',
  },

  // ── trig_apps ──
  {
    itemId: 'ta-m1', // a = 7, b = 7, C = 60°
    stepIndex: 2,
    wrongAr: 'cos 60° = √3/2، فتكون c² = 98 − 98 × (√3/2)',
    wrongEn: 'cos 60° = √3/2, so c² = 98 − 98 × (√3/2)',
    whyAr: 'cos 60° = 1/2؛ أما √3/2 فهي قيمة cos 30° (أو sin 60°).',
    whyEn: 'cos 60° = 1/2; √3/2 is the value of cos 30° (or sin 60°).',
  },
  {
    itemId: 'ta-h1', // a = 8, A = 30°, B = 45°
    stepIndex: 2,
    wrongAr: 'نحلّ لـ b: b = 8 × sin 30° / sin 45°',
    wrongEn: 'Solve for b: b = 8 × sin 30° / sin 45°',
    whyAr: 'نضرب الطرفين في sin 45° فيبقى sin 30° في المقام: b = 8 × sin 45° / sin 30°.',
    whyEn: 'Multiply both sides by sin 45°; sin 30° stays in the denominator: b = 8 × sin 45° / sin 30°.',
  },

  // ── functions ──
  {
    itemId: 'f-m1', // f(x) = x², g(x) = x + 1, (f∘g)(2)
    stepIndex: 0,
    wrongAr: 'تعريف التركيب: (f∘g)(2) = g(f(2))',
    wrongEn: 'Definition of composition: (f∘g)(2) = g(f(2))',
    whyAr: 'في f∘g نطبّق g أولًا ثم f: (f∘g)(2) = f(g(2)).',
    whyEn: 'In f∘g, g is applied first and then f: (f∘g)(2) = f(g(2)).',
  },
  {
    itemId: 'f-m2', // f(x) = 2x − 6, f⁻¹
    stepIndex: 2,
    wrongAr: 'نحلّ لـ y: x − 6 = 2y',
    wrongEn: 'Solve for y: x − 6 = 2y',
    whyAr: 'لعزل 2y نضيف 6 إلى طرفي x = 2y − 6، فنحصل على x + 6 = 2y.',
    whyEn: 'To isolate 2y, add 6 to both sides of x = 2y − 6, giving x + 6 = 2y.',
  },

  // ── sequences ──
  {
    itemId: 'q-m1', // 3, 7, 11, … a_10
    stepIndex: 2,
    wrongAr: 'a_10 = 3 + (10)(4) = 3 + 40',
    wrongEn: 'a_10 = 3 + (10)(4) = 3 + 40',
    whyAr: 'الحد العام يستخدم (n − 1) لا n: (10 − 1)(4) = 36.',
    whyEn: 'The general term uses (n − 1), not n: (10 − 1)(4) = 36.',
  },
  {
    itemId: 'q-h2', // a_1 = 3, r = 2, a_6
    stepIndex: 1,
    wrongAr: 'a_6 = 3 · 2^(6 − 1) = 6^5',
    wrongEn: 'a_6 = 3 · 2^(6 − 1) = 6^5',
    whyAr: 'الأس يخص الأساس r = 2 وحده، فنحسب 2^5 أولًا ثم نضرب في 3.',
    whyEn: 'The exponent applies only to r = 2: work out 2^5 first, then multiply by 3.',
  },

  // ── derivative ──
  {
    itemId: 'd-m1', // f(x) = x³ − 4x
    stepIndex: 1,
    wrongAr: "قاعدة القوة: (x³)' = 3x³",
    wrongEn: "Power rule: (x³)' = 3x³",
    whyAr: "قاعدة القوة تُنزل الأس معاملًا ثم تُنقصه 1: (x³)' = 3x².",
    whyEn: "The power rule brings the exponent down and reduces it by 1: (x³)' = 3x².",
  },
  {
    itemId: 'd-m2', // slope of y = x² at x = 3
    stepIndex: 2,
    wrongAr: "نعوّض x = 3: y' = 3² = 9",
    wrongEn: "Substitute x = 3: y' = 3² = 9",
    whyAr: "عوّضنا في y = x² بدل المشتقة؛ الميل قيمة y' = 2x: y' = 2 × 3 = 6.",
    whyEn: "That substitutes into y = x² instead of the derivative; the slope is y' = 2x: y' = 2 × 3 = 6.",
  },

  // ── vectors ──
  {
    itemId: 'v-e1', // A(1,2), B(4,6)
    stepIndex: 1,
    wrongAr: 'AB⃗ = ⟨1 − 4 ، 2 − 6⟩',
    wrongEn: 'AB⃗ = ⟨1 − 4, 2 − 6⟩',
    whyAr: 'AB⃗ = B − A، أي النهاية ناقص البداية: ⟨4 − 1 ، 6 − 2⟩.',
    whyEn: 'AB⃗ = B − A, end minus start: ⟨4 − 1, 6 − 2⟩.',
  },
  {
    itemId: 'v-e2', // |⟨3, 4⟩|
    stepIndex: 1,
    wrongAr: 'نعوّض: |v| = √(3² + 4²) = 3 + 4',
    wrongEn: 'Substitute: |v| = √(3² + 4²) = 3 + 4',
    whyAr: 'جذر المجموع لا يساوي مجموع الجذرين: √(3² + 4²) = √(9 + 16) = √25.',
    whyEn: 'The root of a sum is not the sum of the roots: √(3² + 4²) = √(9 + 16) = √25.',
  },

  // ── stats ──
  {
    itemId: 's-h1', // P(A) = 0.4, P(B) = 0.5, P(A∩B) = 0.1
    stepIndex: 1,
    wrongAr: 'نعوّض: P(A∪B) = 0.4 + 0.5',
    wrongEn: 'Substitute: P(A∪B) = 0.4 + 0.5',
    whyAr: 'التقاطع محسوب مرتين في P(A) + P(B)، فنطرح P(A∩B) = 0.1 مرة واحدة.',
    whyEn: 'The overlap is counted twice in P(A) + P(B), so subtract P(A∩B) = 0.1 once.',
  },
  {
    itemId: 's-m2', // independent, P(A) = 0.3, P(B) = 0.5
    stepIndex: 1,
    wrongAr: 'نعوّض: P(A∩B) = 0.3 + 0.5',
    wrongEn: 'Substitute: P(A∩B) = 0.3 + 0.5',
    whyAr: 'للحادثتين المستقلتين نضرب الاحتمالين ولا نجمعهما: 0.3 × 0.5.',
    whyEn: 'For independent events multiply the probabilities, do not add them: 0.3 × 0.5.',
  },

  // ── algebra ──
  {
    itemId: 'a-e1', // 2x + 5 = 17
    stepIndex: 0,
    wrongAr: 'ننقل 5 إلى الطرف الآخر: 2x = 17 + 5 = 22',
    wrongEn: 'Move 5 to the other side: 2x = 17 + 5 = 22',
    whyAr: 'نقل +5 إلى الطرف الآخر يغيّر إشارته، أي نطرح 5 من الطرفين: 17 − 5 = 12.',
    whyEn: 'Moving +5 to the other side changes its sign, so subtract 5 from both sides: 17 − 5 = 12.',
  },
  {
    itemId: 'a-h1', // x² − 4x + 1 = 0
    stepIndex: 2,
    wrongAr: 'المميّز: b² − 4ac = (−4)² − 4(1)(1) = −16 − 4 = −20',
    wrongEn: 'Discriminant: b² − 4ac = (−4)² − 4(1)(1) = −16 − 4 = −20',
    whyAr: 'مربع العدد السالب موجب: (−4)² = 16، فيكون المميّز 16 − 4 = 12.',
    whyEn: 'Squaring a negative gives a positive: (−4)² = 16, so the discriminant is 16 − 4 = 12.',
  },
];

const BY_ITEM = new Map<string, Misstep[]>();
for (const m of MISSTEPS) BY_ITEM.set(m.itemId, [...(BY_ITEM.get(m.itemId) ?? []), m]);

export function misstepsFor(itemId: string): Misstep[] {
  return BY_ITEM.get(itemId) ?? [];
}
