import type { SolutionSteps } from './steps-types.ts';

/** Sequences — the family neither of the first two authoring passes covered. */
export const MATH_C_STEPS: Record<string, SolutionSteps> = {
  'q-e1': {
    ar: [
      'نعوّض n = 4 في الحد العام a_n = 2n + 1',
      'a_4 = 2(4) + 1 = 8 + 1',
      'إذن a_4 = 9',
    ],
    en: [
      'Substitute n = 4 into the general term a_n = 2n + 1',
      'a_4 = 2(4) + 1 = 8 + 1',
      'So a_4 = 9',
    ],
  },
  'q-e2': {
    ar: [
      'الأساس d = الحد الثاني − الحد الأول',
      'd = 9 − 5 = 4',
      'نتحقق: 13 − 9 = 4 أيضًا، فالفرق ثابت',
      'إذن d = 4',
    ],
    en: [
      'The common difference d = second term − first term',
      'd = 9 − 5 = 4',
      'Check: 13 − 9 = 4 as well, so the difference is constant',
      'So d = 4',
    ],
  },
  'q-m1': {
    ar: [
      'نحسب الأساس: d = 7 − 3 = 4',
      'قانون الحد العام للمتتالية الحسابية: a_n = a_1 + (n − 1)d',
      'a_10 = 3 + (10 − 1)(4) = 3 + 36',
      'إذن a_10 = 39',
    ],
    en: [
      'Find the common difference: d = 7 − 3 = 4',
      'General term of an arithmetic sequence: a_n = a_1 + (n − 1)d',
      'a_10 = 3 + (10 − 1)(4) = 3 + 36',
      'So a_10 = 39',
    ],
  },
  'q-m2': {
    ar: [
      'نحسب الأساس: r = 6 ÷ 2 = 3',
      'نتحقق: 18 ÷ 6 = 3 أيضًا، فالنسبة ثابتة والمتتالية هندسية',
      'الحد التالي = 18 × 3 = 54',
      'إذن r = 3 ، الحد التالي 54',
    ],
    en: [
      'Find the common ratio: r = 6 ÷ 2 = 3',
      'Check: 18 ÷ 6 = 3 as well, so the ratio is constant and the sequence is geometric',
      'Next term = 18 × 3 = 54',
      'So r = 3 and the next term is 54',
    ],
  },
  'q-m3': {
    ar: [
      'a_1 = 2 والأساس d = 5 − 2 = 3',
      'قانون المجموع: S_n = (n ÷ 2)(2a_1 + (n − 1)d)',
      'S_5 = (5 ÷ 2)(2×2 + 4×3) = (5 ÷ 2)(16)',
      'إذن S_5 = 40',
    ],
    en: [
      'a_1 = 2 and the common difference d = 5 − 2 = 3',
      'Sum formula: S_n = (n ÷ 2)(2a_1 + (n − 1)d)',
      'S_5 = (5 ÷ 2)(2×2 + 4×3) = (5 ÷ 2)(16)',
      'So S_5 = 40',
    ],
  },
  'q-h1': {
    ar: [
      'نكتب قانون الحد العام: a_n = a_1 + (n − 1)d',
      'نعوّض: 31 = 4 + (n − 1)(3)',
      'نطرح 4 من الطرفين: 27 = 3(n − 1)، ثم نقسم على 3: n − 1 = 9',
      'إذن n = 10',
    ],
    en: [
      'Write the general term: a_n = a_1 + (n − 1)d',
      'Substitute: 31 = 4 + (n − 1)(3)',
      'Subtract 4 from both sides: 27 = 3(n − 1), then divide by 3: n − 1 = 9',
      'So n = 10',
    ],
  },
  'q-h2': {
    ar: [
      'قانون الحد العام للمتتالية الهندسية: a_n = a_1 · r^(n − 1)',
      'a_6 = 3 · 2^(6 − 1) = 3 · 2^5',
      '2^5 = 32، إذن 3 × 32 = 96',
      'إذن a_6 = 96',
    ],
    en: [
      'General term of a geometric sequence: a_n = a_1 · r^(n − 1)',
      'a_6 = 3 · 2^(6 − 1) = 3 · 2^5',
      '2^5 = 32, so 3 × 32 = 96',
      'So a_6 = 96',
    ],
  },
};
