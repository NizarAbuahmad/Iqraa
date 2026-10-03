/**
 * A confirm dialog that works on every target.
 *
 * `Alert.alert` with action buttons does not fire its handlers on react-native
 * web — the dialog appears, the buttons do nothing. The sign-out flow in
 * profile.tsx worked around it inline with a Platform check, and every
 * destructive action written since has been quietly broken in the browser:
 * removing a student from a class, deleting a saved material. Both looked fine
 * on a phone and did nothing on the web build that teachers are demoed on.
 *
 * One helper so the next destructive action does not have to rediscover this.
 */
import { Alert, Platform } from 'react-native';

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label for the action that goes ahead. */
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

/**
 * On web the dialog is drawn in-app by `ConfirmHost` (components/ui/ConfirmDialog),
 * not by the browser. `window.confirm` cannot be styled, always prints the site
 * name ("app.iqrra.com says"), ignores our RTL layout and font, and shows a bare
 * OK/Cancel instead of the action's own label. The host registers itself here.
 */
type WebConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;
let webHandler: WebConfirmHandler | null = null;

export function registerWebConfirmHandler(handler: WebConfirmHandler | null) {
  webHandler = handler;
}

/** Resolves true when the user confirms, false on cancel or dismissal. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmLabel, cancelLabel, destructive } = options;

  if (Platform.OS === 'web') {
    if (webHandler) return webHandler(options);
    // Host not mounted yet (very early boot) — the native prompt still works.
    const text = message ? `${title}\n\n${message}` : title;
    const ok = typeof window !== 'undefined' && window.confirm(text);
    return Promise.resolve(!!ok);
  }

  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
