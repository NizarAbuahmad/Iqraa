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
 * The dialog is drawn in-app by `ConfirmHost` (components/ui/ConfirmDialog) on
 * every target, not by the system. The browser's `window.confirm` cannot be
 * styled, always prints the site name ("app.iqrra.com says"), ignores our RTL
 * layout and font, and shows a bare OK/Cancel instead of the action's own
 * label. Android's `Alert` has the same problem on a phone: a stock grey box
 * in the system font, with the buttons pushed to the far edge. The host
 * registers itself here.
 */
type ConfirmHandler = (options: ConfirmOptions) => Promise<boolean>;
let handler: ConfirmHandler | null = null;

export function registerConfirmHandler(next: ConfirmHandler | null) {
  handler = next;
}

/** Resolves true when the user confirms, false on cancel or dismissal. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmLabel, cancelLabel, destructive } = options;

  if (handler) return handler(options);

  // Host not mounted yet (very early boot) — the system prompt still works.
  if (Platform.OS === 'web') {
    const text = message ? `${title}

${message}` : title;
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
