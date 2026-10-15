/**
 * One message per expression failure, shared by the calculator and the grapher.
 * Exhaustive on purpose: a new `MathFailure` without a message fails to compile.
 */
import type { TranslationKey } from '@/services/i18n';
import type { MathFailure } from '@/services/mathExpr';

export const MATH_ERROR_KEY: Record<MathFailure, TranslationKey> = {
  empty: 'mathErrEmpty',
  'too-long': 'mathErrTooLong',
  syntax: 'mathErrSyntax',
  unbalanced: 'mathErrUnbalanced',
  'unknown-symbol': 'mathErrUnknown',
  'function-needs-brackets': 'mathErrBrackets',
  'wrong-arity': 'mathErrArity',
  domain: 'mathErrDomain',
  'divide-by-zero': 'mathErrDivZero',
  overflow: 'mathErrOverflow',
  'factorial-domain': 'mathErrFactorial',
};
