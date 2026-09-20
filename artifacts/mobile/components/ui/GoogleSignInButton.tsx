import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
// Safe to import statically even though the web branch never uses it: the
// package ships `.web.js` variants of GoogleSignin, GoogleSigninButton and
// errorCodes, so Metro resolves a real module for the web bundle rather than
// failing to resolve a native-only one.
import {
  GoogleSignin,
  GoogleSigninButton,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';

// Google Identity Services (GIS) — loaded lazily, web only. Renders Google's
// own button widget rather than a custom Pressable: a hand-rolled trigger
// (google.accounts.id.prompt()) only shows One Tap, which Google suppresses
// after a dismissal, so a "click to sign in" button would silently stop
// working. renderButton() always opens the full account chooser.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_ID = 'google-identity-services';

// The `locale` option `renderButton()` takes is documented, but does nothing
// on an already-parsed client library — the button text is decided once, from
// the `hl` query param the *script itself* was loaded with, and later
// renderButton() calls keep whatever that first load resolved. So switching
// the app to English left the Google button announcing itself in Arabic no
// matter how many times it was redrawn. The fix is to reload the script
// (dropping the old tag and `window.google`) whenever the requested locale
// no longer matches the one it was fetched with.
let loadedLocale: string | null = null;

function loadGoogleScript(locale: string, onLoad: () => void) {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing && loadedLocale === locale) {
    if (window.google?.accounts?.id) onLoad();
    else existing.addEventListener('load', onLoad, { once: true });
    return;
  }
  existing?.remove();
  delete window.google;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = `https://accounts.google.com/gsi/client?hl=${locale}`;
  script.async = true;
  script.defer = true;
  script.addEventListener('load', () => { loadedLocale = locale; onLoad(); }, { once: true });
  document.head.appendChild(script);
}

/**
 * Whether to offer Google at all. Not platform-gated any more — native has its
 * own path below — so this is simply "is a client ID configured", mirroring the
 * API's own 503 when it is not. Both call sites (`app/(auth)/login.tsx`,
 * `app/(auth)/register.tsx`) wrap the button, its loading line AND the "or"
 * divider in this, so an unset key leaves no orphan divider behind.
 *
 * The ID is the **web** client in both cases. That is not a mistake on native:
 * `@react-native-google-signin` takes the web client as `webClientId` and uses
 * it to request an ID token the server can verify, while the Android client it
 * signs in with is read from `google-services.json`.
 */
export function isGoogleSignInAvailable(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  locale: 'ar' | 'en';
}

/**
 * Android/iOS sign-in. Separate component rather than another branch inside
 * the one above, because the two share nothing: this one has no script to
 * load, no container to measure and no locale to re-render for.
 *
 * `webClientId` is the **web** OAuth client, not the Android one. That reads
 * wrong and is correct: the library signs in with the Android client it finds
 * in `google-services.json`, and uses the web client to request an ID token
 * whose audience the API can verify. Getting this backwards yields a token the
 * server rejects with a 401 that looks like a bad password.
 */
function NativeGoogleButton({
  onCredential,
  locale,
}: GoogleSignInButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePress = async () => {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!webClientId || busy) return;

    setBusy(true);
    setError('');
    try {
      // Configure on press rather than on mount: it is cheap, idempotent, and
      // this way a build with the key missing never half-initialises.
      GoogleSignin.configure({ webClientId });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await GoogleSignin.signIn();
      // Cancelling is not an error and must not show one — the user chose it.
      if (!isSuccessResponse(response)) return;

      const idToken = response.data.idToken;
      if (!idToken) {
        // Happens when webClientId is wrong or missing: sign-in "succeeds"
        // against the Android client but no verifiable token comes back, which
        // would otherwise surface as an opaque 401 from the API.
        setError(locale === 'ar' ? 'تعذّر إتمام الدخول عبر Google.' : 'Could not complete Google sign-in.');
        return;
      }
      onCredential(idToken);
    } catch {
      // Play Services missing or out of date, no network, or the native flow
      // failing. The parent only sees credentials, so this is the one place
      // that can say anything at all.
      setError(locale === 'ar' ? 'تعذّر الاتصال بـ Google. حاول مرّة أخرى.' : 'Could not reach Google. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      {/* Google's own button component — their identity guidelines require
          their branding, and a rejected submission costs more than the
          styling freedom a custom Pressable would buy. */}
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        onPress={() => { void handlePress(); }}
        disabled={busy}
      />
      {error ? (
        <Text
          style={{ color: '#EF4444', fontSize: 13, marginTop: 8, textAlign: 'center' }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function GoogleSignInButton({ onCredential, locale }: GoogleSignInButtonProps) {
  const containerRef = useRef<View>(null);
  const [width, setWidth] = useState(300);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  // Which locale initialize() last ran for. A locale change forces
  // loadGoogleScript to fetch a freshly-`hl`'d script (and drop
  // `window.google`), so initialize() must run again on the new instance —
  // but not on every width-only redraw, which would just log a GIS warning
  // for no reason. One effect below decides which of the two it needs.
  const initializedLocaleRef = useRef<string | null>(null);

  // Load, (re)initialize when the locale changed, and redraw the button —
  // one effect, so there is a single loadGoogleScript call per change rather
  // than two racing to reload the same script tag.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return; // Unset means no button — matches the API's own 503 when unconfigured.

    loadGoogleScript(locale, () => {
      const google = window.google;
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!google || !node) return;

      if (initializedLocaleRef.current !== locale) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        });
        initializedLocaleRef.current = locale;
      }

      // renderButton() appends rather than replaces — without this, a
      // width-only redraw left the previous button's iframe behind it,
      // stacked and still in the DOM.
      node.innerHTML = '';

      google.accounts.id.renderButton(node, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'center',
        locale,
        width: Math.min(400, Math.max(200, width)),
      });
    });
  }, [locale, width]);

  if (Platform.OS !== 'web') {
    return <NativeGoogleButton onCredential={onCredential} locale={locale} />;
  }

  return (
    <View
      ref={containerRef}
      nativeID="google-signin-button"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ width: '100%', alignItems: 'center', minHeight: 44 }}
    />
  );
}
