/**
 * «المصادر وإخلاء المسؤولية» — what the app is not, and where its curriculum
 * comes from.
 *
 * The Arabic disclaimer is the same sentence as the Play Store listing, with
 * the brand spelled «إقرأ» (CLAUDE.md, «Product wording»). Change one and the
 * other in the same sitting: Play's review compares the app with its listing.
 *
 * Read by `app/legal/sources.tsx` (public, signed out — it sits under
 * `/legal`), by the links to it on the login, register and Settings screens,
 * and by `SourceCredit`, the one-line credit under textbook figures and
 * curriculum content. Pure data, so `node --test` can pin it
 * (`services/__tests__/sourcesDisclaimer.test.ts`).
 */

export type SourcesLang = 'ar' | 'en';

/** The route of the screen. Under `/legal`, so `PUBLIC_ROUTES` already lets a signed-out visitor in. */
export const SOURCES_ROUTE = '/legal/sources';

export type SourceLink = {
  url: string;
  label: Record<SourcesLang, string>;
};

/** The two official sources. Each opens in the browser, never inside the app. */
export const SOURCE_LINKS: readonly SourceLink[] = [
  {
    url: 'https://nccd.gov.jo/Ar/Pages/textbooks',
    label: {
      ar: 'الكتب المدرسية – المركز الوطني لتطوير المناهج',
      en: 'Textbooks – National Center for Curriculum Development',
    },
  },
  {
    url: 'https://moehrd.gov.jo/',
    label: {
      ar: 'وزارة التربية والتعليم وتنمية الموارد البشرية',
      en: 'Ministry of Education and Human Resource Development',
    },
  },
];

type SourcesCopy = {
  /** Screen title, and the label of every link to the screen. */
  title: string;
  disclaimerHeading: string;
  disclaimer: string;
  sourcesHeading: string;
  sourcesIntro: string;
  /** Read out with each link, so a screen reader says it leaves the app. */
  opensInBrowser: string;
  /** The line under textbook figures and curriculum content. */
  credit: string;
};

export const SOURCES_COPY: Record<SourcesLang, SourcesCopy> = {
  ar: {
    title: 'المصادر وإخلاء المسؤولية',
    disclaimerHeading: 'إخلاء المسؤولية',
    disclaimer:
      '«إقرأ» تطبيق مستقل، وليس تطبيقًا حكوميًا. لا يمثّل وزارة التربية والتعليم وتنمية الموارد البشرية، ولا المركز الوطني لتطوير المناهج، ولا أي جهة حكومية أردنية، ولا يرتبط بها أو يحظى بتزكيتها.',
    sourcesHeading: 'المصادر',
    sourcesIntro: 'محتوى المنهاج في التطبيق مبني على الكتب المدرسية الأردنية الرسمية. تجد المصادر الأصلية هنا:',
    opensInBrowser: 'يفتح في المتصفح',
    credit: 'المصدر: المركز الوطني لتطوير المناهج',
  },
  en: {
    title: 'Sources and disclaimer',
    disclaimerHeading: 'Disclaimer',
    disclaimer:
      'Iqrra is an independent app, not a government app. It does not represent the Ministry of Education and Human Resource Development, the National Center for Curriculum Development, or any Jordanian government body, and is not affiliated with or endorsed by them.',
    sourcesHeading: 'Sources',
    sourcesIntro: 'The curriculum content in the app is based on the official Jordanian school textbooks. The original sources are here:',
    opensInBrowser: 'Opens in the browser',
    credit: 'Source: National Center for Curriculum Development',
  },
};

/** `https://moehrd.gov.jo/` → `moehrd.gov.jo`: what the screen prints under a link. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function sourcesCopy(lang: string): SourcesCopy {
  return lang === 'en' ? SOURCES_COPY.en : SOURCES_COPY.ar;
}
