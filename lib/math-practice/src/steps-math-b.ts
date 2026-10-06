import type { SolutionSteps } from './steps-types.ts';

export const MATH_B_STEPS: Record<string, SolutionSteps> = {
  // ── Circle ──
  'c-e1': {
    ar: ['صيغة المحيط: C = 2πr', 'نعوّض r = 5: C = 2π × 5', 'C = 10π', 'إذن محيط = 10π'],
    en: ['Circumference formula: C = 2πr', 'Substitute r = 5: C = 2π × 5', 'C = 10π', 'So circumference = 10π'],
  },
  'c-e2': {
    ar: ['صيغة المساحة: A = πr²', 'نعوّض r = 4: A = π × 4²', 'A = π × 16', 'إذن مساحة = 16π'],
    en: ['Area formula: A = πr²', 'Substitute r = 4: A = π × 4²', 'A = π × 16', 'So area = 16π'],
  },
  'c-m1': {
    ar: [
      'الصورة القياسية للدائرة: (x−h)² + (y−k)² = r²',
      'نقارن (x−2)² مع (x−h)²: h = 2',
      'نكتب (y+1)² على الصورة (y−(−1))²: k = −1',
      'r² = 9 فيكون r = √9 = 3',
      'إذن المركز (2 ، −1) ، r = 3',
    ],
    en: [
      'Standard form of a circle: (x−h)² + (y−k)² = r²',
      'Compare (x−2)² with (x−h)²: h = 2',
      'Write (y+1)² as (y−(−1))²: k = −1',
      'r² = 9, so r = √9 = 3',
      'So centre (2, −1), r = 3',
    ],
  },
  'c-m2': {
    ar: [
      'طول القوس: l = (θ/360°) × 2πr',
      'نعوّض θ = 60° و r = 6: l = (60/360) × 2π × 6',
      'l = (1/6) × 12π',
      'إذن طول القوس = 2π',
    ],
    en: [
      'Arc length: l = (θ/360°) × 2πr',
      'Substitute θ = 60° and r = 6: l = (60/360) × 2π × 6',
      'l = (1/6) × 12π',
      'So arc length = 2π',
    ],
  },
  'c-h1': {
    ar: [
      'نجمع حدود x وحدود y وننقل الثابت: (x² − 6x) + (y² + 4y) = 3',
      'نكمل المربع: نصف معامل x هو −3 ومربعه 9، ونصف معامل y هو 2 ومربعه 4',
      'نضيف 9 و 4 إلى الطرفين: (x² − 6x + 9) + (y² + 4y + 4) = 3 + 9 + 4',
      'الصورة القياسية: (x−3)² + (y+2)² = 16',
      'نقارن مع (x−h)² + (y−k)² = r²: h = 3 و k = −2 و r = √16 = 4',
      'إذن المركز (3 ، −2) ، r = 4',
    ],
    en: [
      'Group the x terms and the y terms and move the constant: (x² − 6x) + (y² + 4y) = 3',
      'Complete the square: half the x coefficient is −3, squared 9; half the y coefficient is 2, squared 4',
      'Add 9 and 4 to both sides: (x² − 6x + 9) + (y² + 4y + 4) = 3 + 9 + 4',
      'Standard form: (x−3)² + (y+2)² = 16',
      'Compare with (x−h)² + (y−k)² = r²: h = 3, k = −2 and r = √16 = 4',
      'So centre (3, −2), r = 4',
    ],
  },

  // ── Trig ──
  't-e1': {
    ar: [
      'نرسم مثلثاً قائماً زاويتاه 30° و 60° وأضلاعه 1 ، √3 ، 2 (الوتر 2)',
      'الضلع المقابل للزاوية 30° يساوي 1',
      'sin 30° = المقابل ÷ الوتر = 1/2',
      'إذن sin 30° = 1/2',
    ],
    en: [
      'Draw a right triangle with angles 30° and 60° and sides 1, √3, 2 (hypotenuse 2)',
      'The side opposite the 30° angle is 1',
      'sin 30° = opposite ÷ hypotenuse = 1/2',
      'So sin 30° = 1/2',
    ],
  },
  't-e2': {
    ar: [
      'نرسم مثلثاً قائماً زاويتاه 30° و 60° وأضلاعه 1 ، √3 ، 2 (الوتر 2)',
      'الضلع المجاور للزاوية 60° يساوي 1',
      'cos 60° = المجاور ÷ الوتر = 1/2',
      'إذن cos 60° = 1/2',
    ],
    en: [
      'Draw a right triangle with angles 30° and 60° and sides 1, √3, 2 (hypotenuse 2)',
      'The side adjacent to the 60° angle is 1',
      'cos 60° = adjacent ÷ hypotenuse = 1/2',
      'So cos 60° = 1/2',
    ],
  },
  't-e3': {
    ar: [
      'نرسم مثلثاً قائماً متطابق الضلعين زاويتاه الحادتان 45° وضلعاه القائمان 1 و 1',
      'tan 45° = المقابل ÷ المجاور',
      'tan 45° = 1 ÷ 1',
      'إذن tan 45° = 1',
    ],
    en: [
      'Draw an isosceles right triangle with acute angles 45° and legs 1 and 1',
      'tan 45° = opposite ÷ adjacent',
      'tan 45° = 1 ÷ 1',
      'So tan 45° = 1',
    ],
  },
  't-m1': {
    ar: [
      'sin 30° = 1/2، فالزاوية المرجعية 30°',
      'sin θ موجبة في الربعين الأول والثاني',
      'الربع الأول: θ = 30°',
      'الربع الثاني: θ = 180° − 30° = 150°',
      'إذن θ = 30° أو 150° (خلال دورة)',
    ],
    en: [
      'sin 30° = 1/2, so the reference angle is 30°',
      'sin θ is positive in the first and second quadrants',
      'First quadrant: θ = 30°',
      'Second quadrant: θ = 180° − 30° = 150°',
      'So θ = 30° or 150° (within one revolution)',
    ],
  },
  't-m2': {
    ar: [
      'نأخذ نقطة على دائرة الوحدة إحداثياتها (cos θ ، sin θ)',
      'بعد النقطة عن المركز يساوي 1، فمن فيثاغورس: cos²θ + sin²θ = 1²',
      'إذن cos²θ + sin²θ = 1',
    ],
    en: [
      'Take a point on the unit circle with coordinates (cos θ, sin θ)',
      'Its distance from the centre is 1, so by Pythagoras: cos²θ + sin²θ = 1²',
      'So cos²θ + sin²θ = 1',
    ],
  },
  't-h1': {
    ar: [
      'نقسم الطرفين على 2: cos θ = 1/2',
      'cos 60° = 1/2، فالزاوية المرجعية 60°',
      'cos θ موجبة في الربعين الأول والرابع',
      'الربع الأول: θ = 60°، والربع الرابع: θ = 360° − 60° = 300°',
      'إذن θ = 60° أو 300°',
    ],
    en: [
      'Divide both sides by 2: cos θ = 1/2',
      'cos 60° = 1/2, so the reference angle is 60°',
      'cos θ is positive in the first and fourth quadrants',
      'First quadrant: θ = 60°; fourth quadrant: θ = 360° − 60° = 300°',
      'So θ = 60° or 300°',
    ],
  },

  // ── Trig applications ──
  'ta-e1': {
    ar: [
      'قانون المساحة: A = (1/2)ab sin C',
      'نعوّض a = 5 و b = 5 و C = 60°: A = (1/2) × 5 × 5 × sin 60°',
      'sin 60° = √3/2، فتكون A = (25/2) × (√3/2)',
      'إذن مساحة = (25√3)/4',
    ],
    en: [
      'Area formula: A = (1/2)ab sin C',
      'Substitute a = 5, b = 5 and C = 60°: A = (1/2) × 5 × 5 × sin 60°',
      'sin 60° = √3/2, so A = (25/2) × (√3/2)',
      'So area = (25√3)/4',
    ],
  },
  'ta-m1': {
    ar: [
      'قانون جيب التمام: c² = a² + b² − 2ab cos C',
      'نعوّض: c² = 7² + 7² − 2 × 7 × 7 × cos 60°',
      'cos 60° = 1/2، فتكون c² = 98 − 98 × (1/2)',
      'c² = 98 − 49 = 49',
      'c = √49 (طول موجب)',
      'إذن c = 7',
    ],
    en: [
      'Cosine rule: c² = a² + b² − 2ab cos C',
      'Substitute: c² = 7² + 7² − 2 × 7 × 7 × cos 60°',
      'cos 60° = 1/2, so c² = 98 − 98 × (1/2)',
      'c² = 98 − 49 = 49',
      'c = √49 (a length is positive)',
      'So c = 7',
    ],
  },
  'ta-h1': {
    ar: [
      'قانون الجيوب: a / sin A = b / sin B',
      'نعوّض: 8 / sin 30° = b / sin 45°',
      'نحلّ لـ b: b = 8 × sin 45° / sin 30°',
      'sin 45° = √2/2 و sin 30° = 1/2: b = 8 × (√2/2) ÷ (1/2)',
      'إذن b = 8√2',
    ],
    en: [
      'Sine rule: a / sin A = b / sin B',
      'Substitute: 8 / sin 30° = b / sin 45°',
      'Solve for b: b = 8 × sin 45° / sin 30°',
      'sin 45° = √2/2 and sin 30° = 1/2: b = 8 × (√2/2) ÷ (1/2)',
      'So b = 8√2',
    ],
  },

  // ── Functions ──
  'f-e1': {
    ar: ['نعوّض x = 4 في f(x) = 2x + 3', 'f(4) = 2(4) + 3 = 8 + 3', 'إذن f(4) = 11'],
    en: ['Substitute x = 4 into f(x) = 2x + 3', 'f(4) = 2(4) + 3 = 8 + 3', 'So f(4) = 11'],
  },
  'f-e2': {
    ar: ['نعوّض x = 3 في f(x) = x² − 1', 'f(3) = 3² − 1 = 9 − 1', 'إذن f(3) = 8'],
    en: ['Substitute x = 3 into f(x) = x² − 1', 'f(3) = 3² − 1 = 9 − 1', 'So f(3) = 8'],
  },
  'f-m1': {
    ar: [
      'تعريف التركيب: (f∘g)(2) = f(g(2))',
      'نحسب الاقتران الداخلي: g(2) = 2 + 1 = 3',
      'نعوّض في f: f(3) = 3² = 9',
      'إذن (f∘g)(2) = 9',
    ],
    en: [
      'Definition of composition: (f∘g)(2) = f(g(2))',
      'Evaluate the inner function: g(2) = 2 + 1 = 3',
      'Substitute into f: f(3) = 3² = 9',
      'So (f∘g)(2) = 9',
    ],
  },
  'f-m2': {
    ar: [
      'نكتب y = 2x − 6',
      'نبدّل x و y: x = 2y − 6',
      'نحلّ لـ y: x + 6 = 2y',
      'y = (x+6)/2',
      'إذن f⁻¹(x) = (x+6)/2',
    ],
    en: [
      'Write y = 2x − 6',
      'Swap x and y: x = 2y − 6',
      'Solve for y: x + 6 = 2y',
      'y = (x+6)/2',
      'So f⁻¹(x) = (x+6)/2',
    ],
  },
  'f-h1': {
    ar: ['نعوّض n = 5 في a_n = 3n − 1', 'a_5 = 3(5) − 1 = 15 − 1', 'إذن a_5 = 14'],
    en: ['Substitute n = 5 into a_n = 3n − 1', 'a_5 = 3(5) − 1 = 15 − 1', 'So a_5 = 14'],
  },

  // ── Derivatives ──
  'd-e1': {
    ar: ['قاعدة القوة: إذا كان f(x) = xⁿ فإن f\'(x) = n·xⁿ⁻¹', 'هنا n = 2: f\'(x) = 2·x¹', "إذن f'(x) = 2x"],
    en: ['Power rule: if f(x) = xⁿ then f\'(x) = n·xⁿ⁻¹', 'Here n = 2: f\'(x) = 2·x¹', "So f'(x) = 2x"],
  },
  'd-e2': {
    ar: ['قاعدة القوة: مشتقة x هي 1', 'مشتقة ثابت × اقتران = الثابت × مشتقة الاقتران: (5x)\' = 5 × 1', "إذن f'(x) = 5"],
    en: ['Power rule: the derivative of x is 1', 'Constant multiple rule: (5x)\' = 5 × 1', "So f'(x) = 5"],
  },
  'd-m1': {
    ar: [
      'نشتق كل حد على حدة (مشتقة الفرق = الفرق بين المشتقتين)',
      'قاعدة القوة: (x³)\' = 3x²',
      'قاعدة الثابت × اقتران: (4x)\' = 4',
      "إذن f'(x) = 3x² − 4",
    ],
    en: [
      'Differentiate term by term (the derivative of a difference is the difference of derivatives)',
      'Power rule: (x³)\' = 3x²',
      'Constant multiple rule: (4x)\' = 4',
      "So f'(x) = 3x² − 4",
    ],
  },
  'd-m2': {
    ar: [
      'ميل المماس عند x = a يساوي المشتقة عند a',
      'نشتق بقاعدة القوة: y\' = 2x',
      'نعوّض x = 3: y\' = 2 × 3 = 6',
      'إذن الميل = 6',
    ],
    en: [
      'The slope of the tangent at x = a equals the derivative at a',
      'Differentiate with the power rule: y\' = 2x',
      'Substitute x = 3: y\' = 2 × 3 = 6',
      'So the slope = 6',
    ],
  },
  'd-h1': {
    ar: [
      'القيم الحرجة هي قيم x التي تكون عندها f\'(x) = 0',
      "نشتق: f'(x) = 3x² − 3",
      'نضع المشتقة تساوي صفراً: 3x² − 3 = 0',
      'نقسم على 3: x² = 1',
      'إذن قيم حرجة عند x = ±1',
    ],
    en: [
      'Critical points are the values of x where f\'(x) = 0',
      "Differentiate: f'(x) = 3x² − 3",
      'Set the derivative equal to zero: 3x² − 3 = 0',
      'Divide by 3: x² = 1',
      'So critical points at x = ±1',
    ],
  },

  // ── Vectors ──
  'v-e1': {
    ar: [
      'المتجه من A إلى B: AB⃗ = B − A (نهاية − بداية)',
      'AB⃗ = ⟨4 − 1 ، 6 − 2⟩',
      'إذن AB⃗ = ⟨3 ، 4⟩',
    ],
    en: [
      'The vector from A to B: AB⃗ = B − A (end minus start)',
      'AB⃗ = ⟨4 − 1, 6 − 2⟩',
      'So AB⃗ = ⟨3, 4⟩',
    ],
  },
  'v-e2': {
    ar: [
      'مقدار المتجه ⟨a ، b⟩ هو |v| = √(a² + b²)',
      'نعوّض: |v| = √(3² + 4²) = √(9 + 16)',
      '|v| = √25',
      'إذن |v| = 5',
    ],
    en: [
      'The magnitude of ⟨a, b⟩ is |v| = √(a² + b²)',
      'Substitute: |v| = √(3² + 4²) = √(9 + 16)',
      '|v| = √25',
      'So |v| = 5',
    ],
  },
  'v-m1': {
    ar: [
      'نجمع المركبات المتناظرة: u + v = ⟨1 + 3 ، 2 + (−1)⟩',
      'إذن u+v = ⟨4 ، 1⟩',
    ],
    en: [
      'Add corresponding components: u + v = ⟨1 + 3, 2 + (−1)⟩',
      'So u+v = ⟨4, 1⟩',
    ],
  },
  'v-m2': {
    ar: [
      'الضرب القياسي: ⟨a ، b⟩ · ⟨c ، d⟩ = ac + bd',
      'نعوّض: 2 × 4 + 3 × (−1)',
      '= 8 − 3',
      'إذن u·v = 5',
    ],
    en: [
      'Dot product: ⟨a, b⟩ · ⟨c, d⟩ = ac + bd',
      'Substitute: 2 × 4 + 3 × (−1)',
      '= 8 − 3',
      'So u·v = 5',
    ],
  },
  'v-h1': {
    ar: [
      'متجهان غير صفريين متعامدان إذا كان ضربهما القياسي يساوي صفراً',
      'نحسب: ⟨1 ، 0⟩ · ⟨0 ، 1⟩ = 1 × 0 + 0 × 1',
      'الناتج = 0 + 0 = 0',
      'إذن متعامدان (الضرب القياسي = 0)',
    ],
    en: [
      'Two non-zero vectors are perpendicular if their dot product is zero',
      'Compute: ⟨1, 0⟩ · ⟨0, 1⟩ = 1 × 0 + 0 × 1',
      'The result is 0 + 0 = 0',
      'So perpendicular (dot product = 0)',
    ],
  },

  // ── Stats / probability ──
  's-e1': {
    ar: [
      'المتوسط الحسابي = مجموع القيم ÷ عددها',
      'المجموع: 2 + 4 + 6 + 8 = 20، وعدد القيم 4',
      'المتوسط الحسابي = 20 ÷ 4',
      'إذن المتوسط = 5',
    ],
    en: [
      'Mean = sum of the values ÷ number of values',
      'Sum: 2 + 4 + 6 + 8 = 20, and there are 4 values',
      'Mean = 20 ÷ 4',
      'So the mean = 5',
    ],
  },
  's-e2': {
    ar: [
      'الاحتمال = عدد النتائج المناسبة ÷ عدد النتائج الممكنة',
      'النتائج المناسبة: وجه واحد فقط (5)، والنتائج الممكنة: 6',
      'إذن احتمال ظهور 5 = 1/6',
    ],
    en: [
      'Probability = favourable outcomes ÷ possible outcomes',
      'Favourable outcomes: only one face (5); possible outcomes: 6',
      'So the probability of rolling a 5 = 1/6',
    ],
  },
  's-m1': {
    ar: [
      'نرتّب البيانات تصاعدياً: 1 ، 3 ، 3 ، 5 ، 8 (مرتبة أصلاً)',
      'عدد القيم 5 (فردي)، فالوسيط هو القيمة الوسطى، وموقعها (5 + 1) ÷ 2 = 3',
      'القيمة الثالثة هي 3',
      'إذن الوسيط = 3',
    ],
    en: [
      'Order the data ascending: 1, 3, 3, 5, 8 (already ordered)',
      'There are 5 values (odd), so the median is the middle value, at position (5 + 1) ÷ 2 = 3',
      'The third value is 3',
      'So the median = 3',
    ],
  },
  's-m2': {
    ar: [
      'للحادثتين المستقلتين: P(A∩B) = P(A) × P(B)',
      'نعوّض: P(A∩B) = 0.3 × 0.5',
      'إذن P(A∩B) = 0.15',
    ],
    en: [
      'For independent events: P(A∩B) = P(A) × P(B)',
      'Substitute: P(A∩B) = 0.3 × 0.5',
      'So P(A∩B) = 0.15',
    ],
  },
  's-h1': {
    ar: [
      'قانون الاتحاد: P(A∪B) = P(A) + P(B) − P(A∩B)',
      'نعوّض: P(A∪B) = 0.4 + 0.5 − 0.1',
      'P(A∪B) = 0.9 − 0.1',
      'إذن P(A∪B) = 0.8',
    ],
    en: [
      'Addition rule: P(A∪B) = P(A) + P(B) − P(A∩B)',
      'Substitute: P(A∪B) = 0.4 + 0.5 − 0.1',
      'P(A∪B) = 0.9 − 0.1',
      'So P(A∪B) = 0.8',
    ],
  },

  // ── Algebra ──
  'a-e1': {
    ar: ['نطرح 5 من الطرفين: 2x = 17 − 5 = 12', 'نقسم الطرفين على 2: x = 12 ÷ 2', 'إذن x = 6'],
    en: ['Subtract 5 from both sides: 2x = 17 − 5 = 12', 'Divide both sides by 2: x = 12 ÷ 2', 'So x = 6'],
  },
  'a-e2': {
    ar: ['نضيف 4 إلى الطرفين: 3x = 11 + 4 = 15', 'نقسم الطرفين على 3: x = 15 ÷ 3', 'إذن x = 5'],
    en: ['Add 4 to both sides: 3x = 11 + 4 = 15', 'Divide both sides by 3: x = 15 ÷ 3', 'So x = 5'],
  },
  'a-e3': {
    ar: ['نضرب الطرفين في 2: x = 9 × 2', 'x = 18', 'إذن x = 18'],
    en: ['Multiply both sides by 2: x = 9 × 2', 'x = 18', 'So x = 18'],
  },
  'a-m1': {
    ar: [
      'نحلّل المقدار: نبحث عن عددين حاصل ضربهما 6 ومجموعهما −5، وهما −2 و −3',
      '(x − 2)(x − 3) = 0',
      'حاصل الضرب صفر، فأحد العاملين صفر: x − 2 = 0 أو x − 3 = 0',
      'إذن x = 2 أو x = 3',
    ],
    en: [
      'Factor: find two numbers with product 6 and sum −5, namely −2 and −3',
      '(x − 2)(x − 3) = 0',
      'The product is zero, so one factor is zero: x − 2 = 0 or x − 3 = 0',
      'So x = 2 or x = 3',
    ],
  },
  'a-m2': {
    ar: ['نأخذ الجذر التربيعي للطرفين، وللجذر إشارتان: x = ±√49', '√49 = 7', 'إذن x = ±7'],
    en: ['Take the square root of both sides; the root has two signs: x = ±√49', '√49 = 7', 'So x = ±7'],
  },
  'a-m3': {
    ar: [
      'من المعادلة الثانية y = 3',
      'نعوّض في الأولى: 2x + 3 = 7',
      'نطرح 3 من الطرفين: 2x = 4، ثم x = 2',
      'إذن x = 2 ، y = 3',
    ],
    en: [
      'From the second equation y = 3',
      'Substitute into the first: 2x + 3 = 7',
      'Subtract 3 from both sides: 2x = 4, then x = 2',
      'So x = 2, y = 3',
    ],
  },
  'a-h1': {
    ar: [
      'القانون العام: x = (−b ± √(b² − 4ac)) / 2a',
      'من المعادلة x² − 4x + 1 = 0: a = 1 و b = −4 و c = 1',
      'المميّز: b² − 4ac = (−4)² − 4(1)(1) = 16 − 4 = 12',
      'x = (4 ± √12) / 2',
      '√12 = 2√3، فتكون x = (4 ± 2√3) / 2 ونقسم كل حد على 2',
      'إذن x = 2 ± √3',
    ],
    en: [
      'Quadratic formula: x = (−b ± √(b² − 4ac)) / 2a',
      'From x² − 4x + 1 = 0: a = 1, b = −4 and c = 1',
      'Discriminant: b² − 4ac = (−4)² − 4(1)(1) = 16 − 4 = 12',
      'x = (4 ± √12) / 2',
      '√12 = 2√3, so x = (4 ± 2√3) / 2; divide each term by 2',
      'So x = 2 ± √3',
    ],
  },
  'a-h2': {
    ar: [
      'x² − 9 فرق بين مربعين: x² − 3² = (x − 3)(x + 3)',
      '(x − 3)(x + 3) = 0، فأحد العاملين صفر: x − 3 = 0 أو x + 3 = 0',
      'إذن x = ±3',
    ],
    en: [
      'x² − 9 is a difference of squares: x² − 3² = (x − 3)(x + 3)',
      '(x − 3)(x + 3) = 0, so one factor is zero: x − 3 = 0 or x + 3 = 0',
      'So x = ±3',
    ],
  },
  'a-h3': {
    ar: [
      'نكتب 16 كقوة للأساس 2: 16 = 2^4',
      'تصبح المعادلة 2^n = 2^4',
      'الأساسان متساويان، فالأسّان متساويان',
      'إذن n = 4',
    ],
    en: [
      'Write 16 as a power of 2: 16 = 2^4',
      'The equation becomes 2^n = 2^4',
      'The bases are equal, so the exponents are equal',
      'So n = 4',
    ],
  },
};
