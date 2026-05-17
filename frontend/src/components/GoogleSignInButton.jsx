import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { ENABLE_GOOGLE_AUTH, GOOGLE_CONFIG } from '../config/google-oauth.js';

let initializedClientId = '';
let activeCredentialHandler = null;

function initializeGoogleClient() {
  if (!window.google?.accounts?.id || initializedClientId === GOOGLE_CONFIG.clientId) {
    return Boolean(initializedClientId);
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CONFIG.clientId,
    callback: (credentialResponse) => {
      activeCredentialHandler?.(credentialResponse);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  initializedClientId = GOOGLE_CONFIG.clientId;
  return true;
}

function GoogleSignInButton({ onSuccess, onError }) {
  const { googleLogin } = useAuth();
  const buttonRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ENABLE_GOOGLE_AUTH) {
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timerId = 0;

    const render = () => {
      if (cancelled) {
        return;
      }

      attempts += 1;
      const initialized = initializeGoogleClient();
      if (!initialized || !buttonRef.current) {
        if (attempts < 40) {
          timerId = window.setTimeout(render, 150);
        } else {
          onError?.('Google Sign-In could not load. Check your network and Client ID.');
        }
        return;
      }

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(buttonRef.current.offsetWidth || 320, 400),
      });
      setReady(true);
    };

    render();

    return () => {
      cancelled = true;
      activeCredentialHandler = null;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [onError]);

  useEffect(() => {
    activeCredentialHandler = async (credentialResponse) => {
      const credential = credentialResponse?.credential;
      if (!credential) {
        onError?.('Google did not return a sign-in token.');
        return;
      }

      if (submitting) {
        return;
      }

      setSubmitting(true);
      const result = await googleLogin(credential);
      setSubmitting(false);

      if (result.success) {
        onSuccess?.(result);
        return;
      }

      onError?.(result.errors?.[0] || result.message || 'Google sign-in failed. Please try again.');
    };

    return () => {
      activeCredentialHandler = null;
    };
  }, [googleLogin, onError, onSuccess, submitting]);

  if (!ENABLE_GOOGLE_AUTH) {
    return null;
  }

  return (
    <div className="google-signin-wrapper" aria-busy={submitting ? 'true' : 'false'}>
      <div ref={buttonRef} />
      {!ready && <span className="google-signin-loading">Loading Google...</span>}
    </div>
  );
}

export default GoogleSignInButton;
