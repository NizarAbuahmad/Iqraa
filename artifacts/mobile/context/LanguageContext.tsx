import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getT, Lang, TranslationKey } from '@/services/i18n';

const LANG_KEY = '@iqra_language';

interface LanguageContextType {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => Promise<void>;
  t: (key: TranslationKey, ...args: any[]) => string;
  toggleLang: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar'); // Arabic default

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(stored => {
      if (stored === 'en' || stored === 'ar') {
        setLangState(stored);
        applyRTL(stored);
      } else {
        // Default to Arabic
        applyRTL('ar');
      }
    });
  }, []);

  const applyRTL = (l: Lang) => {
    if (Platform.OS !== 'web') {
      // Same reasoning as the web branch below: every row flips itself with
      // `isRTL ? 'row-reverse' : 'row'`, which assumes a neutral LTR layout.
      // Letting the OS mirror too (an Arabic-locale phone, allowRTL(true))
      // cancels those flips back to LTR and swaps textAlign left/right.
      // So native is pinned LTR and direction stays per component.
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
      return;
    }

    // On web the document is pinned to LTR *on purpose*, even in Arabic.
    //
    // This app expresses direction per component: ~190 call sites write
    // `flexDirection: isRTL ? 'row-reverse' : 'row'`. Those flips assume a
    // neutral document. In a `dir="rtl"` document `flexDirection: 'row'` is
    // already reversed, so `'row-reverse'` cancels back to visual LTR — icon
    // and title render on the wrong side while `textAlign: 'right'` (a physical
    // value, unaffected by direction) keeps the text right-aligned. That is a
    // half-mirrored screen, and it is worse than either direction applied
    // consistently.
    //
    // Measured on the deployed build, the children of one such row:
    //   dir="rtl" → x = [913, 998]  (ascending  → visually LTR — the bug)
    //   no dir    → x = [288, 211]  (descending → visually RTL — correct)
    //
    // The bug only ever appeared in production, and for a while nobody could
    // say why: `expo export` and the dev server both emit a shell with no
    // `dir`, while the deployed HTML served `<html lang="ar" dir="rtl">`. This
    // comment used to call that something "this repo cannot produce" and blame
    // the host. It is ours — `scripts/inject-pwa.mjs:39` rewrites the tag after
    // the export, and `render.yaml` runs that script on every deploy.
    //
    // So this line is not defending against a host; it is overruling our own
    // build about four hundred milliseconds after it loads. That is worth
    // knowing before touching either side: the two disagree by construction,
    // and the later one silently wins.
    //
    // `lang` still tracks the real language — it drives spellcheck and
    // screen-reader voice selection, and neither is affected by `dir`.
    //
    // If the per-component flips are ever replaced by real document-level RTL,
    // this is one of three places that must change together: set `dir` from
    // `l === 'ar'` here (and on native), stop the injector hard-coding it, and delete the
    // flips — all in the same commit. Any two without the third brings the
    // double-flip straight back.
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root) {
      root.setAttribute('dir', 'ltr');
      root.setAttribute('lang', l);
    }
  };

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    applyRTL(l);
    await AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const toggleLang = useCallback(async () => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    await setLang(next);
  }, [lang, setLang]);

  const t = useCallback(
    (key: TranslationKey, ...args: any[]) => getT(lang)(key, ...args),
    [lang],
  );

  return (
    <LanguageContext.Provider
      value={{ lang, isRTL: lang === 'ar', setLang, t, toggleLang }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
