import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

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

function loadGoogleScript(onLoad: () => void) {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    if (window.google?.accounts?.id) onLoad();
    else existing.addEventListener('load', onLoad, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.addEventListener('load', onLoad, { once: true });
  document.head.appendChild(script);
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  locale: 'ar' | 'en';
}

export function GoogleSignInButton({ onCredential, locale }: GoogleSignInButtonProps) {
  const containerRef = useRef<View>(null);
  const [width, setWidth] = useState(300);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return; // Unset means no button — matches the API's own 503 when unconfigured.

    loadGoogleScript(() => {
      const google = window.google;
      const node = containerRef.current as unknown as HTMLElement | null;
      if (!google || !node) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential),
      });
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
  }, [locale, onCredential, width]);

  if (Platform.OS !== 'web') return null;

  return (
    <View
      ref={containerRef}
      nativeID="google-signin-button"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ width: '100%', alignItems: 'center', minHeight: 44 }}
    />
  );
}
