import type { SolutionSteps } from './steps-types.ts';

export const MATH_A_STEPS: Record<string, SolutionSteps> = {
  'exp-e1': {
    ar: [
      'نكتب 32 بالأساس 2: 32 = 2^5',
      'نعوّض في المعادلة: 2^x = 2^5',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 5',
    ],
    en: [
      'Write 32 with base 2: 32 = 2^5',
      'Substitute: 2^x = 2^5',
      'The bases are equal, so the exponents are equal: x = 5',
    ],
  },
  'exp-e2': {
    ar: [
      'نكتب 27 بالأساس 3: 27 = 3^3',
      'نعوّض في المعادلة: 3^x = 3^3',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 3',
    ],
    en: [
      'Write 27 with base 3: 27 = 3^3',
      'Substitute: 3^x = 3^3',
      'The bases are equal, so the exponents are equal: x = 3',
    ],
  },
  'exp-e3': {
    ar: [
      'نكتب 125 بالأساس 5: 125 = 5^3',
      'نعوّض في المعادلة: 5^x = 5^3',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 3',
    ],
    en: [
      'Write 125 with base 5: 125 = 5^3',
      'Substitute: 5^x = 5^3',
      'The bases are equal, so the exponents are equal: x = 3',
    ],
  },
  'exp-e4': {
    ar: [
      'نكتب 16 بالأساس 2: 16 = 2^4',
      'نعوّض في المعادلة: 2^x = 2^4',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 4',
    ],
    en: [
      'Write 16 with base 2: 16 = 2^4',
      'Substitute: 2^x = 2^4',
      'The bases are equal, so the exponents are equal: x = 4',
    ],
  },
  'exp-e5': {
    ar: [
      'نكتب 1000 بالأساس 10: 1000 = 10^3',
      'نعوّض في المعادلة: 10^x = 10^3',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 3',
    ],
    en: [
      'Write 1000 with base 10: 1000 = 10^3',
      'Substitute: 10^x = 10^3',
      'The bases are equal, so the exponents are equal: x = 3',
    ],
  },
  'exp-e6': {
    ar: [
      'نكتب 64 بالأساس 4: 64 = 4^3',
      'نعوّض في المعادلة: 4^x = 4^3',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 3',
    ],
    en: [
      'Write 64 with base 4: 64 = 4^3',
      'Substitute: 4^x = 4^3',
      'The bases are equal, so the exponents are equal: x = 3',
    ],
  },
  'exp-m1': {
    ar: [
      'نكتب 32 بالأساس 2: 32 = 2^5',
      'نعوّض: 2^{x+1} = 2^5',
      'الأساسان متساويان فنساوي الأسّين: x + 1 = 5',
      'نطرح 1 من الطرفين، إذن x = 4',
    ],
    en: [
      'Write 32 with base 2: 32 = 2^5',
      'Substitute: 2^{x+1} = 2^5',
      'The bases are equal, so equate the exponents: x + 1 = 5',
      'Subtract 1 from both sides, so x = 4',
    ],
  },
  'exp-m2': {
    ar: [
      'نكتب 81 بالأساس 3: 81 = 3^4',
      'نعوّض: 3^{2x} = 3^4',
      'الأساسان متساويان فنساوي الأسّين: 2x = 4',
      'نقسم الطرفين على 2، إذن x = 2',
    ],
    en: [
      'Write 81 with base 3: 81 = 3^4',
      'Substitute: 3^{2x} = 3^4',
      'The bases are equal, so equate the exponents: 2x = 4',
      'Divide both sides by 2, so x = 2',
    ],
  },
  'exp-m3': {
    ar: [
      'نوحّد الأساس: 4 = 2^2',
      'قوة القوة: 4^x = (2^2)^x = 2^{2x}',
      'تصبح المعادلة 2^{2x} = 2^{x+3}، فنساوي الأسّين: 2x = x + 3',
      'نطرح x من الطرفين، إذن x = 3',
    ],
    en: [
      'Make the bases match: 4 = 2^2',
      'Power of a power: 4^x = (2^2)^x = 2^{2x}',
      'The equation becomes 2^{2x} = 2^{x+3}, so equate the exponents: 2x = x + 3',
      'Subtract x from both sides, so x = 3',
    ],
  },
  'exp-m4': {
    ar: [
      'نوحّد الأساس: 9 = 3^2 و 27 = 3^3',
      'قوة القوة: 9^x = (3^2)^x = 3^{2x}، فتصبح المعادلة 3^{2x} = 3^3',
      'الأساسان متساويان فنساوي الأسّين: 2x = 3',
      'نقسم الطرفين على 2، إذن x = 3/2',
    ],
    en: [
      'Make the bases match: 9 = 3^2 and 27 = 3^3',
      'Power of a power: 9^x = (3^2)^x = 3^{2x}, so the equation is 3^{2x} = 3^3',
      'The bases are equal, so equate the exponents: 2x = 3',
      'Divide both sides by 2, so x = 3/2',
    ],
  },
  'exp-m5': {
    ar: [
      'نوحّد الأساس: 8 = 2^3 و 4 = 2^2',
      'قوة القوة: 8^x = 2^{3x} و 4^{x+1} = 2^{2(x+1)}',
      'الأساسان متساويان فنساوي الأسّين: 3x = 2x + 2',
      'نطرح 2x من الطرفين، إذن x = 2',
    ],
    en: [
      'Make the bases match: 8 = 2^3 and 4 = 2^2',
      'Power of a power: 8^x = 2^{3x} and 4^{x+1} = 2^{2(x+1)}',
      'The bases are equal, so equate the exponents: 3x = 2x + 2',
      'Subtract 2x from both sides, so x = 2',
    ],
  },
  'exp-m6': {
    ar: [
      'نكتب 25 بالأساس 5: 25 = 5^2',
      'نعوّض: 5^{x−1} = 5^2',
      'الأساسان متساويان فنساوي الأسّين: x − 1 = 2',
      'نضيف 1 إلى الطرفين، إذن x = 3',
    ],
    en: [
      'Write 25 with base 5: 25 = 5^2',
      'Substitute: 5^{x−1} = 5^2',
      'The bases are equal, so equate the exponents: x − 1 = 2',
      'Add 1 to both sides, so x = 3',
    ],
  },
  'exp-h1': {
    ar: [
      'نوحّد الأساس: 4 = 2^2، فيكون 4^y = 2^{2y}',
      'المعادلة الأولى 2^x = 2^{2y}، والأساسان متساويان فنساوي الأسّين: x = 2y',
      'نعوّض x = 2y في المعادلة الثانية x + y = 6: 2y + y = 6',
      '3y = 6، إذن y = 2',
      'نجد x من x = 2y = 4',
      'إذن x = 4 ، y = 2',
    ],
    en: [
      'Make the bases match: 4 = 2^2, so 4^y = 2^{2y}',
      'The first equation is 2^x = 2^{2y}; the bases are equal, so equate the exponents: x = 2y',
      'Substitute x = 2y into x + y = 6: 2y + y = 6',
      '3y = 6, so y = 2',
      'Find x from x = 2y = 4',
      'So x = 4 , y = 2',
    ],
  },
  'exp-h2': {
    ar: [
      'نوحّد الأساس: 9 = 3^2، فيكون 9^y = 3^{2y}',
      'المعادلة الأولى 3^x = 3^{2y}، والأساسان متساويان فنساوي الأسّين: x = 2y',
      'نعوّض x = 2y في المعادلة الثانية x − y = 1: 2y − y = 1',
      'إذن y = 1، ومنه x = 2y = 2',
      'إذن x = 2 ، y = 1',
    ],
    en: [
      'Make the bases match: 9 = 3^2, so 9^y = 3^{2y}',
      'The first equation is 3^x = 3^{2y}; the bases are equal, so equate the exponents: x = 2y',
      'Substitute x = 2y into x − y = 1: 2y − y = 1',
      'So y = 1, and then x = 2y = 2',
      'So x = 2 , y = 1',
    ],
  },
  'exp-h3': {
    ar: [
      'نوحّد الأساس: 4 = 2^2 و 8 = 2^3',
      'قوة القوة: 4^x = 2^{2x} و 8^{x−1} = 2^{3(x−1)}',
      'الأساسان متساويان فنساوي الأسّين: 2x = 3(x − 1)',
      'نفكّ الأقواس: 2x = 3x − 3',
      'ننقل 2x إلى الطرف الأيمن: 0 = x − 3، إذن x = 3',
    ],
    en: [
      'Make the bases match: 4 = 2^2 and 8 = 2^3',
      'Power of a power: 4^x = 2^{2x} and 8^{x−1} = 2^{3(x−1)}',
      'The bases are equal, so equate the exponents: 2x = 3(x − 1)',
      'Expand the brackets: 2x = 3x − 3',
      'Move 2x to the right: 0 = x − 3, so x = 3',
    ],
  },
  'exp-h4': {
    ar: [
      'نفكّ القوة بقاعدة الضرب: 2^{x+2} = 2^x · 2^2 = 4 · 2^x',
      'المعادلة: 4 · 2^x = 2^x + 12',
      'نطرح 2^x من الطرفين: 3 · 2^x = 12',
      'نقسم على 3: 2^x = 4 = 2^2',
      'الأساسان متساويان فنساوي الأسّين، إذن x = 2',
    ],
    en: [
      'Split the power using the product rule: 2^{x+2} = 2^x · 2^2 = 4 · 2^x',
      'The equation: 4 · 2^x = 2^x + 12',
      'Subtract 2^x from both sides: 3 · 2^x = 12',
      'Divide by 3: 2^x = 4 = 2^2',
      'The bases are equal, so the exponents are equal: x = 2',
    ],
  },
  'exp-h5': {
    ar: [
      'الحجم 32 ضعف الحجم الابتدائي: N = 32 N₀ ، فنكتب N₀ · 2^t = 32 N₀',
      'نقسم الطرفين على N₀: 2^t = 32',
      'نكتب 32 بالأساس 2: 32 = 2^5، فتصبح 2^t = 2^5',
      'الأساسان متساويان فنساوي الأسّين، إذن t = 5 أي بعد 5 ساعات',
    ],
    en: [
      'The size is 32 times the initial size: N = 32 N₀, so N₀ · 2^t = 32 N₀',
      'Divide both sides by N₀: 2^t = 32',
      'Write 32 with base 2: 32 = 2^5, so 2^t = 2^5',
      'The bases are equal, so the exponents are equal: t = 5, that is, after 5 hours',
    ],
  },
  'g-e1': {
    ar: [
      'عند نقطة التقاطع تكون y واحدة في المعادلتين، فنساويهما: x + 1 = −x + 3',
      'نجمع x ونطرح 1: 2x = 2، إذن x = 1',
      'نعوّض في y = x + 1: y = 1 + 1 = 2',
      'نتحقق في المعادلة الثانية: −1 + 3 = 2',
      'إذن نقطة التقاطع (1 ، 2)',
    ],
    en: [
      'At the intersection y is the same in both equations, so set them equal: x + 1 = −x + 3',
      'Add x and subtract 1: 2x = 2, so x = 1',
      'Substitute into y = x + 1: y = 1 + 1 = 2',
      'Check in the second equation: −1 + 3 = 2',
      'So the intersection point is (1 , 2)',
    ],
  },
  'g-e2': {
    ar: [
      'نساوي قيمتي y: 2x = −x + 6',
      'نضيف x إلى الطرفين: 3x = 6، إذن x = 2',
      'نعوّض في y = 2x: y = 2 × 2 = 4',
      'نتحقق في المعادلة الثانية: −2 + 6 = 4',
      'إذن نقطة التقاطع (2 ، 4)',
    ],
    en: [
      'Set the two values of y equal: 2x = −x + 6',
      'Add x to both sides: 3x = 6, so x = 2',
      'Substitute into y = 2x: y = 2 × 2 = 4',
      'Check in the second equation: −2 + 6 = 4',
      'So the intersection point is (2 , 4)',
    ],
  },
  'g-m1': {
    ar: [
      'نساوي قيمتي y: x² = x + 2',
      'ننقل كل الحدود إلى طرف واحد: x² − x − 2 = 0',
      'نحلّل: (x − 2)(x + 1) = 0',
      'كل عامل يساوي صفراً: x = 2 أو x = −1',
      'نجد y من y = x + 2: عندما x = −1 فإن y = 1، وعندما x = 2 فإن y = 4',
      'إذن (−1 ، 1) و (2 ، 4)، أي نقطتا تقاطع',
    ],
    en: [
      'Set the two values of y equal: x² = x + 2',
      'Move every term to one side: x² − x − 2 = 0',
      'Factor: (x − 2)(x + 1) = 0',
      'Set each factor to zero: x = 2 or x = −1',
      'Find y from y = x + 2: when x = −1, y = 1; when x = 2, y = 4',
      'So (−1 , 1) and (2 , 4): two intersection points',
    ],
  },
  'g-m2': {
    ar: [
      'على المحور السيني y = 0، فنعوّض في المنحنى: x² − 4 = 0',
      'نحلّل فرق مربعين: (x − 2)(x + 2) = 0',
      'كل عامل يساوي صفراً: x = 2 أو x = −2',
      'وفي الحالتين y = 0 لأنهما على المحور السيني',
      'إذن (−2 ، 0) و (2 ، 0)',
    ],
    en: [
      'On the x-axis y = 0, so substitute into the curve: x² − 4 = 0',
      'Factor the difference of two squares: (x − 2)(x + 2) = 0',
      'Set each factor to zero: x = 2 or x = −2',
      'In both cases y = 0 because the points lie on the x-axis',
      'So (−2 , 0) and (2 , 0)',
    ],
  },
  'g-m3': {
    ar: [
      'نساوي قيمتي y: x² − 1 = 2x + 2',
      'ننقل كل الحدود إلى طرف واحد: x² − 2x − 3 = 0',
      'نحلّل: (x − 3)(x + 1) = 0',
      'كل عامل يساوي صفراً: x = 3 أو x = −1',
      'نجد y من y = 2x + 2: عندما x = −1 فإن y = 0، وعندما x = 3 فإن y = 8',
      'إذن (−1 ، 0) و (3 ، 8)',
    ],
    en: [
      'Set the two values of y equal: x² − 1 = 2x + 2',
      'Move every term to one side: x² − 2x − 3 = 0',
      'Factor: (x − 3)(x + 1) = 0',
      'Set each factor to zero: x = 3 or x = −1',
      'Find y from y = 2x + 2: when x = −1, y = 0; when x = 3, y = 8',
      'So (−1 , 0) and (3 , 8)',
    ],
  },
  'g-h1': {
    ar: [
      'نساوي قيمتي y: x² − 2x = x',
      'ننقل x إلى الطرف الأيسر: x² − 3x = 0',
      'نخرج العامل المشترك x ولا نقسم عليه كي لا نفقد الحل x = 0: x(x − 3) = 0',
      'كل عامل يساوي صفراً: x = 0 أو x = 3',
      'نجد y من y = x: عندما x = 0 فإن y = 0، وعندما x = 3 فإن y = 3',
      'إذن (0 ، 0) و (3 ، 3)',
    ],
    en: [
      'Set the two values of y equal: x² − 2x = x',
      'Move x to the left: x² − 3x = 0',
      'Take out the common factor x (do not divide by it, or the solution x = 0 is lost): x(x − 3) = 0',
      'Set each factor to zero: x = 0 or x = 3',
      'Find y from y = x: when x = 0, y = 0; when x = 3, y = 3',
      'So (0 , 0) and (3 , 3)',
    ],
  },
  'g-h2': {
    ar: [
      'نساوي قيمتي y: x² + 1 = −x² + 3',
      'نجمع x² ونطرح 1: 2x² = 2، إذن x² = 1',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 1 أو x = −1',
      'نجد y من y = x² + 1: في الحالتين y = 1 + 1 = 2',
      'إذن (−1 ، 2) و (1 ، 2)',
    ],
    en: [
      'Set the two values of y equal: x² + 1 = −x² + 3',
      'Add x² and subtract 1: 2x² = 2, so x² = 1',
      'Take the square root with both signs: x = 1 or x = −1',
      'Find y from y = x² + 1: in both cases y = 1 + 1 = 2',
      'So (−1 , 2) and (1 , 2)',
    ],
  },
  'g-h3': {
    ar: [
      'نساوي قيمتي y: 2x + 1 = x² − 3',
      'ننقل كل الحدود إلى طرف واحد: x² − 2x − 4 = 0',
      'نحسب المميّز: Δ = (−2)² − 4(1)(−4) = 20',
      'Δ > 0، فللمعادلة جذران حقيقيان مختلفان: x = 1 ± √5',
      'لكل قيمة x قيمة واحدة y = 2x + 1، فنحصل على نقطتين مختلفتين',
      'إذن نقطتا تقاطع',
    ],
    en: [
      'Set the two values of y equal: 2x + 1 = x² − 3',
      'Move every term to one side: x² − 2x − 4 = 0',
      'Compute the discriminant: Δ = (−2)² − 4(1)(−4) = 20',
      'Δ > 0, so the equation has two different real roots: x = 1 ± √5',
      'Each x gives exactly one y = 2x + 1, so we get two different points',
      'So there are two intersection points',
    ],
  },
  'lq-e1': {
    ar: [
      'نعوّض y = x في المعادلة الثانية: x = x²',
      'ننقل كل الحدود إلى طرف واحد: x² − x = 0',
      'نخرج العامل المشترك x ولا نقسم عليه كي لا نفقد الحل x = 0: x(x − 1) = 0',
      'كل عامل يساوي صفراً: x = 0 أو x = 1',
      'نجد y من y = x: عندما x = 0 فإن y = 0، وعندما x = 1 فإن y = 1',
      'إذن (0 ، 0) و (1 ، 1)',
    ],
    en: [
      'Substitute y = x into the second equation: x = x²',
      'Move every term to one side: x² − x = 0',
      'Take out the common factor x (do not divide by it, or the solution x = 0 is lost): x(x − 1) = 0',
      'Set each factor to zero: x = 0 or x = 1',
      'Find y from y = x: when x = 0, y = 0; when x = 1, y = 1',
      'So (0 , 0) and (1 , 1)',
    ],
  },
  'lq-e2': {
    ar: [
      'نعوّض y = 2 في المعادلة الثانية: 2 = x² − 2',
      'نضيف 2 إلى الطرفين: x² = 4',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 2 أو x = −2',
      'قيمة y ثابتة في الحالتين: y = 2',
      'إذن (−2 ، 2) و (2 ، 2)',
    ],
    en: [
      'Substitute y = 2 into the second equation: 2 = x² − 2',
      'Add 2 to both sides: x² = 4',
      'Take the square root with both signs: x = 2 or x = −2',
      'In both cases y is fixed: y = 2',
      'So (−2 , 2) and (2 , 2)',
    ],
  },
  'lq-m1': {
    ar: [
      'نساوي قيمتي y: x + 1 = x² − 3x + 4',
      'ننقل كل الحدود إلى الطرف الأيمن: 0 = x² − 4x + 3',
      'نحلّل: (x − 1)(x − 3) = 0',
      'كل عامل يساوي صفراً: x = 1 أو x = 3',
      'نجد y من y = x + 1: عندما x = 1 فإن y = 2، وعندما x = 3 فإن y = 4',
      'إذن (1 ، 2) و (3 ، 4)',
    ],
    en: [
      'Set the two values of y equal: x + 1 = x² − 3x + 4',
      'Move every term to the right: 0 = x² − 4x + 3',
      'Factor: (x − 1)(x − 3) = 0',
      'Set each factor to zero: x = 1 or x = 3',
      'Find y from y = x + 1: when x = 1, y = 2; when x = 3, y = 4',
      'So (1 , 2) and (3 , 4)',
    ],
  },
  'lq-m2': {
    ar: [
      'نساوي قيمتي y: −x + 4 = x² − x',
      'نضيف x إلى الطرفين: 4 = x²',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 2 أو x = −2',
      'نجد y من y = −x + 4: عندما x = 2 فإن y = 2، وعندما x = −2 فإن y = 6',
      'إذن (−2 ، 6) و (2 ، 2)',
    ],
    en: [
      'Set the two values of y equal: −x + 4 = x² − x',
      'Add x to both sides: 4 = x²',
      'Take the square root with both signs: x = 2 or x = −2',
      'Find y from y = −x + 4: when x = 2, y = 2; when x = −2, y = 6',
      'So (−2 , 6) and (2 , 2)',
    ],
  },
  'lq-h1': {
    ar: [
      'نساوي قيمتي y: 3x − 1 = x² + x − 1',
      'نضيف 1 ونطرح 3x من الطرفين: 0 = x² − 2x',
      'نخرج العامل المشترك x ولا نقسم عليه كي لا نفقد الحل x = 0: x(x − 2) = 0',
      'كل عامل يساوي صفراً: x = 0 أو x = 2',
      'نجد y من y = 3x − 1: عندما x = 0 فإن y = −1، وعندما x = 2 فإن y = 5',
      'إذن (0 ، −1) و (2 ، 5)',
    ],
    en: [
      'Set the two values of y equal: 3x − 1 = x² + x − 1',
      'Add 1 and subtract 3x on both sides: 0 = x² − 2x',
      'Take out the common factor x (do not divide by it, or the solution x = 0 is lost): x(x − 2) = 0',
      'Set each factor to zero: x = 0 or x = 2',
      'Find y from y = 3x − 1: when x = 0, y = −1; when x = 2, y = 5',
      'So (0 , −1) and (2 , 5)',
    ],
  },
  'lq-h2': {
    ar: [
      'من x + y = 5 نكتب y = 5 − x، أو نعوّض y = x² − 1 مباشرة: x + (x² − 1) = 5',
      'نرتّب: x² + x − 6 = 0',
      'نحلّل: (x + 3)(x − 2) = 0',
      'كل عامل يساوي صفراً: x = 2 أو x = −3',
      'نجد y من y = x² − 1: عندما x = 2 فإن y = 3، وعندما x = −3 فإن y = 8',
      'إذن (2 ، 3) و (−3 ، 8)',
    ],
    en: [
      'From x + y = 5 we can write y = 5 − x; or substitute y = x² − 1 directly: x + (x² − 1) = 5',
      'Rearrange: x² + x − 6 = 0',
      'Factor: (x + 3)(x − 2) = 0',
      'Set each factor to zero: x = 2 or x = −3',
      'Find y from y = x² − 1: when x = 2, y = 3; when x = −3, y = 8',
      'So (2 , 3) and (−3 , 8)',
    ],
  },
  'qq-e1': {
    ar: [
      'نساوي قيمتي y: x² = 4',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 2 أو x = −2',
      'قيمة y ثابتة في الحالتين: y = 4',
      'إذن (−2 ، 4) و (2 ، 4)',
    ],
    en: [
      'Set the two values of y equal: x² = 4',
      'Take the square root with both signs: x = 2 or x = −2',
      'In both cases y is fixed: y = 4',
      'So (−2 , 4) and (2 , 4)',
    ],
  },
  'qq-m1': {
    ar: [
      'نساوي قيمتي y: x² − 4 = −x² + 4',
      'نجمع x² ونضيف 4 إلى الطرفين: 2x² = 8، إذن x² = 4',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 2 أو x = −2',
      'نجد y من y = x² − 4: في الحالتين y = 4 − 4 = 0',
      'إذن (−2 ، 0) و (2 ، 0)',
    ],
    en: [
      'Set the two values of y equal: x² − 4 = −x² + 4',
      'Add x² and 4 to both sides: 2x² = 8, so x² = 4',
      'Take the square root with both signs: x = 2 or x = −2',
      'Find y from y = x² − 4: in both cases y = 4 − 4 = 0',
      'So (−2 , 0) and (2 , 0)',
    ],
  },
  'qq-m2': {
    ar: [
      'نساوي قيمتي y: x² + 1 = 2x² − 3',
      'نطرح x² ونضيف 3 إلى الطرفين: 4 = x²',
      'نأخذ الجذر التربيعي مع الإشارتين: x = 2 أو x = −2',
      'نجد y من y = x² + 1: في الحالتين y = 4 + 1 = 5',
      'إذن (−2 ، 5) و (2 ، 5)',
    ],
    en: [
      'Set the two values of y equal: x² + 1 = 2x² − 3',
      'Subtract x² and add 3 on both sides: 4 = x²',
      'Take the square root with both signs: x = 2 or x = −2',
      'Find y from y = x² + 1: in both cases y = 4 + 1 = 5',
      'So (−2 , 5) and (2 , 5)',
    ],
  },
  'qq-h1': {
    ar: [
      'نساوي قيمتي y: x² − 2x = −x² + 4',
      'ننقل كل الحدود إلى الطرف الأيسر: 2x² − 2x − 4 = 0',
      'نقسم على 2: x² − x − 2 = 0',
      'نحلّل: (x − 2)(x + 1) = 0، فـ x = 2 أو x = −1',
      'نجد y من y = −x² + 4: عندما x = −1 فإن y = 3، وعندما x = 2 فإن y = 0',
      'إذن (−1 ، 3) و (2 ، 0)',
    ],
    en: [
      'Set the two values of y equal: x² − 2x = −x² + 4',
      'Move every term to the left: 2x² − 2x − 4 = 0',
      'Divide by 2: x² − x − 2 = 0',
      'Factor: (x − 2)(x + 1) = 0, so x = 2 or x = −1',
      'Find y from y = −x² + 4: when x = −1, y = 3; when x = 2, y = 0',
      'So (−1 , 3) and (2 , 0)',
    ],
  },
  'se-e1': {
    ar: [
      'الأساس واحد، فنجمع الأسّين: 2^3 · 2^4 = 2^{3+4}',
      'نجمع: 2^{3+4} = 2^7',
      'نحسب القيمة، إذن 2^7 = 128',
    ],
    en: [
      'The base is the same, so add the exponents: 2^3 · 2^4 = 2^{3+4}',
      'Add: 2^{3+4} = 2^7',
      'Evaluate, so 2^7 = 128',
    ],
  },
  'se-e2': {
    ar: [
      'الأساس واحد، فنطرح الأسّين: 5^7 ÷ 5^3 = 5^{7−3}',
      'نطرح: 5^{7−3} = 5^4',
      'نحسب القيمة، إذن 5^4 = 625',
    ],
    en: [
      'The base is the same, so subtract the exponents: 5^7 ÷ 5^3 = 5^{7−3}',
      'Subtract: 5^{7−3} = 5^4',
      'Evaluate, so 5^4 = 625',
    ],
  },
  'se-e3': {
    ar: [
      'قوة القوة: نضرب الأسّين: (3^2)^3 = 3^{2×3}',
      'نضرب: 3^{2×3} = 3^6',
      'نحسب القيمة، إذن 3^6 = 729',
    ],
    en: [
      'Power of a power: multiply the exponents: (3^2)^3 = 3^{2×3}',
      'Multiply: 3^{2×3} = 3^6',
      'Evaluate, so 3^6 = 729',
    ],
  },
  'se-m1': {
    ar: [
      'نكتب 8 بالأساس 2: 8 = 2^3، فيكون 8^{2/3} = (2^3)^{2/3}',
      'قوة القوة: نضرب الأسّين: 2^{3 × 2/3}',
      'نحسب الأسّ: 3 × 2/3 = 2، فتصبح 2^2',
      'إذن 2^2 = 4',
    ],
    en: [
      'Write 8 with base 2: 8 = 2^3, so 8^{2/3} = (2^3)^{2/3}',
      'Power of a power: multiply the exponents: 2^{3 × 2/3}',
      'Compute the exponent: 3 × 2/3 = 2, giving 2^2',
      'So 2^2 = 4',
    ],
  },
  'se-m2': {
    ar: [
      'نكتب 27 بالأساس 3: 27 = 3^3، فيكون 27^{2/3} = (3^3)^{2/3}',
      'قوة القوة: نضرب الأسّين: 3^{3 × 2/3}',
      'نحسب الأسّ: 3 × 2/3 = 2، فتصبح 3^2',
      'إذن 3^2 = 9',
    ],
    en: [
      'Write 27 with base 3: 27 = 3^3, so 27^{2/3} = (3^3)^{2/3}',
      'Power of a power: multiply the exponents: 3^{3 × 2/3}',
      'Compute the exponent: 3 × 2/3 = 2, giving 3^2',
      'So 3^2 = 9',
    ],
  },
  'se-m3': {
    ar: [
      'البسط: الأساس واحد فنجمع الأسّين: 2^3 · 2^{−1} = 2^{3−1} = 2^2',
      'نكتب المقام بصورة قوة: 2 = 2^1',
      'نطرح الأسّين: 2^2 ÷ 2^1 = 2^{2−1} = 2^1',
      'إذن 2^1 = 2',
    ],
    en: [
      'Numerator: the base is the same, so add the exponents: 2^3 · 2^{−1} = 2^{3−1} = 2^2',
      'Write the denominator as a power: 2 = 2^1',
      'Subtract the exponents: 2^2 ÷ 2^1 = 2^{2−1} = 2^1',
      'So 2^1 = 2',
    ],
  },
  'se-h1': {
    ar: [
      'نكتب 16 = 2^4 ثم نضرب الأسّين: 16^{3/4} = (2^4)^{3/4} = 2^3 = 8',
      'نكتب 8 = 2^3 ثم نضرب الأسّين: 8^{1/3} = (2^3)^{1/3} = 2^1 = 2',
      'نقسم: 8 ÷ 2 = 4',
      'إذن الناتج = 4',
    ],
    en: [
      'Write 16 = 2^4 then multiply the exponents: 16^{3/4} = (2^4)^{3/4} = 2^3 = 8',
      'Write 8 = 2^3 then multiply the exponents: 8^{1/3} = (2^3)^{1/3} = 2^1 = 2',
      'Divide: 8 ÷ 2 = 4',
      'So the result is 4',
    ],
  },
  'se-h2': {
    ar: [
      'الأساس واحد، فنجمع الأسّين في الضرب: a^5 · a^{−2} = a^{5−2} = a^3',
      'نكتب المقام بصورة قوة: a = a^1',
      'نطرح الأسّين في القسمة: a^3 ÷ a^1 = a^{3−1}',
      'إذن a^2',
    ],
    en: [
      'The base is the same, so add the exponents when multiplying: a^5 · a^{−2} = a^{5−2} = a^3',
      'Write the divisor as a power: a = a^1',
      'Subtract the exponents when dividing: a^3 ÷ a^1 = a^{3−1}',
      'So a^2',
    ],
  },
};
