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
    const shouldBeRTL = l === 'ar';
    if (Platform.OS !== 'web') {
      // On mobile the app must restart for I18nManager to take full effect.
      // We handle per-component RTL via `writingDirection` and `textAlign`.
      I18nManager.allowRTL(shouldBeRTL);
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
