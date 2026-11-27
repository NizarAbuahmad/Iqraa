/**
 * A generated exam's warnings, worded in the teacher's language at display time.
 *
 * The API sends each warning three ways, one for one: `warnings` (English),
 * `warningsAr` (since 2026-11-27) and `warningCodes` (since 2026-11-27, a code
 * and its parameters — `GenerationWarning` in @workspace/exam-paper). The app
 * used to pick one sentence list and carry it through the `/evaluations/[id]`
 * URL, so a teacher read «Produced 3 of 5 requested questions» under an Arabic
 * paper. Now a coded warning is worded here, from the `genWarn…` keys in
 * `services/i18n.ts`; the sentences are only the fallback for a warning with no
 * code this build knows (an older API, or a newer code).
 *
 * What travels between screens is a `GenNotice[]` (`encodeNotices` /
 * `decodeNotices`): codes and parameters, and a sentence only for a fallback.
 */
import { isGenerationWarning, type GenerationWarning } from '@workspace/exam-paper';
import translations, { type Lang, type TranslationKey, type Translations } from './i18n.ts';
import { optionLetter } from './optionLabels.ts';

/** One warning to show: a code to word, or (fallback) the API's own sentences. */
export type GenNotice =
  | { warning: GenerationWarning }
  | { en: string; ar?: string };

interface GenerateWarningsPayload {
  warnings?: readonly string[];
  warningsAr?: readonly string[];
  warningCodes?: readonly unknown[];
}

/** The API's three lists as notices, one per English warning, in order. */
export function generationNotices(result: GenerateWarningsPayload): GenNotice[] {
  const en = result.warnings ?? [];
  const ar = result.warningsAr && result.warningsAr.length === en.length ? result.warningsAr : undefined;
  const codes = result.warningCodes && result.warningCodes.length === en.length ? result.warningCodes : undefined;
  return en.map((text, i) => {
    const code = codes?.[i];
    if (isGenerationWarning(code)) return { warning: code };
    return ar ? { en: text, ar: ar[i]! } : { en: text };
  });
}

const COMPETENCY_KEY: Record<string, TranslationKey> = {
  knowledge: 'competencyKnowledge',
  understanding: 'competencyUnderstanding',
  application: 'competencyApplication',
  critical_thinking: 'competencyCriticalThinking',
};

/** The type picker's own names (`type…` keys). */
const TYPE_KEY: Record<string, TranslationKey> = {
  multiple_choice: 'typeMultipleChoice',
  true_false: 'typeTrueFalse',
  matching: 'typeMatching',
  fill_blank: 'typeFillBlank',
  short_answer: 'typeShortAnswer',
  open_ended: 'typeOpenEnded',
  problem_solving: 'typeProblemSolving',
  practical_task: 'typePracticalTask',
  read_aloud: 'typeReadAloud',
  dictation: 'typeDictation',
};

/** Thrown when a parameter is not what its code promises; the notice falls back or is dropped. */
class BadParam extends Error {}

const num = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  throw new BadParam(String(v));
};
const str = (v: unknown): string => {
  if (typeof v === 'string') return v;
  throw new BadParam(String(v));
};
const list = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  throw new BadParam(String(v));
};

/** A coded warning in `lang`. Throws `BadParam` when its parameters are malformed. */
function wordWarning(w: GenerationWarning, lang: Lang): string {
  const T = translations[lang] as unknown as Translations;
  const label = (map: Record<string, TranslationKey>, id: unknown): string => {
    const key = map[str(id)];
    // An id this build has no name for is shown as it is rather than dropped.
    return key ? (T[key] as string) : str(id);
  };
  const types = (v: unknown) => list(v).map(id => label(TYPE_KEY, id));
  // Read through a plain record: the parameters crossed a network and maybe a URL.
  const p = w.params as Record<string, unknown>;
  switch (w.code) {
    case 'objectives_uncovered': return T.genWarnObjectivesUncovered(num(p.count));
    case 'competency_single': return T.genWarnCompetencySingle(label(COMPETENCY_KEY, p.competency));
    case 'competency_missing': return T.genWarnCompetencyMissing(label(COMPETENCY_KEY, p.competency));
    case 'true_false_one_sided': return T.genWarnTrueFalseOneSided(num(p.count), num(p.total), p.value === true);
    case 'choice_position_bunched':
      return T.genWarnChoicePositionBunched(num(p.count), num(p.total), optionLetter(num(p.position), lang === 'ar'));
    case 'same_ask': return T.genWarnSameAsk(num(p.count), num(p.total), str(p.example));
    case 'keys_unlinked': return T.genWarnKeysUnlinked(num(p.count));
    case 'verifier_unreachable': return T.genWarnVerifierUnreachable;
    case 'keys_contradicted': {
      const details = Array.isArray(p.details)
        ? p.details.map(d => {
          const r = d as Record<string, unknown>;
          return { question: num(r.question), derived: str(r.derived), key: str(r.key) };
        })
        : [];
      return T.genWarnKeysContradicted(list(p.questions).map(num), details);
    }
    case 'no_objectives': return T.genWarnNoObjectives;
    case 'no_type_producible': return T.genWarnNoTypeProducible;
    case 'types_skipped': return T.genWarnTypesSkipped(types(p.types));
    case 'library_holds':
      return T.genWarnLibraryHolds({
        questionBanks: num(p.questionBanks),
        pastPapers: num(p.pastPapers),
        answerKeys: num(p.answerKeys),
        referenceOnly: num(p.referenceOnly),
        documents: num(p.documents),
      });
    case 'shortfall': return T.genWarnShortfall(num(p.made), num(p.requested));
    case 'restatements_skipped': return T.genWarnRestatementsSkipped(num(p.count));
    case 'model_discarded': return T.genWarnModelDiscarded(num(p.count));
    case 'first_grade_types_dropped': return T.genWarnFirstGradeTypesDropped(types(p.used), types(p.dropped));
    case 'grounded_on':
      return T.genWarnGroundedOn(list(p.sources).map(s => {
        const r = s as Record<string, unknown>;
        return { title: str(r.title), page: typeof r.page === 'number' ? r.page : str(r.page) };
      }));
    case 'not_grounded': return T.genWarnNotGrounded;
    case 'model_surplus_trimmed': return T.genWarnModelSurplusTrimmed(num(p.trimmed), num(p.asked));
    case 'book_items_drawn': return T.genWarnBookItemsDrawn(num(p.count));
    case 'book_items_short': return T.genWarnBookItemsShort(num(p.drawn), num(p.planned));
    case 'surplus_trimmed': return T.genWarnSurplusTrimmed(num(p.surplus), num(p.requested));
    case 'no_key_checked': return T.genWarnNoKeyChecked;
    case 'marks_shared_short':
      return T.genWarnMarksSharedShort(num(p.written), num(p.requested), num(p.marks), num(p.target));
    case 'marks_total_unreachable': return T.genWarnMarksTotalUnreachable(num(p.target), num(p.questions), num(p.kept));
    default: {
      // A code added to the shared union without a case here fails the typecheck.
      const unhandled: never = w;
      return unhandled;
    }
  }
}

/**
 * One notice in `lang`, or null when there is nothing honest to show (a coded
 * warning whose parameters are malformed and that carries no sentence).
 */
export function wordNotice(notice: GenNotice, lang: Lang): string | null {
  if ('warning' in notice) {
    try {
      return wordWarning(notice.warning, lang);
    } catch (err) {
      if (err instanceof BadParam) return null;
      throw err;
    }
  }
  return lang === 'ar' && notice.ar ? notice.ar : notice.en;
}

/** Every notice in `lang`, in order, without the ones that cannot be worded. */
export function wordNotices(notices: readonly GenNotice[], lang: Lang): string[] {
  return notices.map(n => wordNotice(n, lang)).filter((s): s is string => !!s);
}

/** For the `/evaluations/[id]` route param. Empty when there is nothing to carry. */
export function encodeNotices(notices: readonly GenNotice[]): string {
  return notices.length ? JSON.stringify(notices) : '';
}

/**
 * The route param back into notices. Anything unreadable (a hand-edited URL, a
 * param from an older build) is dropped rather than shown raw.
 */
export function decodeNotices(param: string | undefined): GenNotice[] {
  if (!param) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(param);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((n): GenNotice[] => {
    if (typeof n !== 'object' || n === null) return [];
    const r = n as Record<string, unknown>;
    if ('warning' in r) return isGenerationWarning(r.warning) ? [{ warning: r.warning }] : [];
    if (typeof r.en !== 'string') return [];
    return typeof r.ar === 'string' ? [{ en: r.en, ar: r.ar }] : [{ en: r.en }];
  });
}
