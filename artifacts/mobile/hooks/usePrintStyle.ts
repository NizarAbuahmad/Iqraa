import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parsePrintStyle, type PrintStyle } from '@/services/printStyle';

/**
 * The print style this device last exported a worksheet or quiz in.
 *
 * Per device, not per account: it follows the school's copier, not the
 * teacher. Every export menu reads and writes the same key, so picking
 * Ink-saver once on the worksheet screen holds in موادي and the chat too.
 */
const PRINT_STYLE_KEY = '@iqra_print_style_v1';

/** The stored style, read once — for a print with no export menu to pick it in. */
export async function readPrintStyle(): Promise<PrintStyle> {
  try {
    return parsePrintStyle(await AsyncStorage.getItem(PRINT_STYLE_KEY));
  } catch {
    return 'colour';
  }
}

export function usePrintStyle(): [PrintStyle, (style: PrintStyle) => void] {
  const [style, setStyle] = useState<PrintStyle>('colour');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PRINT_STYLE_KEY)
      .then(raw => { if (alive) setStyle(parsePrintStyle(raw)); })
      .catch(() => { /* unreadable store: colour, as before */ });
    return () => { alive = false; };
  }, []);

  const choose = useCallback((next: PrintStyle) => {
    setStyle(next);
    AsyncStorage.setItem(PRINT_STYLE_KEY, next).catch(() => { /* best-effort */ });
  }, []);

  return [style, choose];
}
