import { startTransition, useEffect, useState } from 'react';
import { authApi } from '../api/client.js';
import { AuthContext } from './context.js';

const initialState = Object.freeze({
  status: 'loading',
  user: null,
  error: null,
});

function normalizeUser(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const normalizePhotoUrl = (value) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    return value.trim().replace(/^\/rentease\/backend/, '/backend');
  };

  const profilePictureUrl = normalizePhotoUrl(input.profile_picture);
  const profilePhotoUrl = normalizePhotoUrl(input.profile_photo_url) || profilePictureUrl;

  return {
    user_id: input.user_id ?? null,
    full_name: input.full_name ?? '',
    email: input.email ?? '',
    role: input.role ?? null,
    contact_number: input.contact_number ?? '',
    account_status: input.account_status ?? 'inactive',
    profile_photo: input.profile_photo ?? null,
    profile_photo_url: profilePhotoUrl,
    profile_picture: profilePictureUrl,
    auth_provider: input.auth_provider ?? 'local',
    email_verified: input.email_verified ?? null,
    google_linked: Boolean(input.google_linked),
    has_password: Boolean(input.has_password),
    emergency_contact_name: input.emergency_contact_name ?? '',
    emergency_contact_number: input.emergency_contact_number ?? '',
    school_or_workplace: input.school_or_workplace ?? '',
    created_at: input.created_at ?? null,
  };
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(initialState);

  async function refreshSession({ silent = false } = {}) {
    if (!silent) {
      startTransition(() => {
        setAuthState((current) => ({
          ...current,
          status: 'loading',
          error: null,
        }));
      });
    }

    try {
      const payload = await authApi.me();
      const user = normalizeUser(payload.data);
      const nextState = {
        status: 'authenticated',
        user,
        error: null,
      };

      if (silent) {
        setAuthState(nextState);
      } else {
        startTransition(() => {
          setAuthState(nextState);
        });
      }

      return user;
    } catch {
      const nextState = {
        status: 'unauthenticated',
        user: null,
        error: null,
      };

      if (silent) {
        setAuthState(nextState);
      } else {
        startTransition(() => {
          setAuthState(nextState);
        });
      }

      return null;
    }
  }

  async function login(credentials) {
    startTransition(() => {
      setAuthState((current) => ({
        ...current,
        status: 'loading',
        error: null,
      }));
    });

    try {
      const payload = await authApi.login(credentials);
      const user = normalizeUser(payload.data);

      startTransition(() => {
        setAuthState({
          status: 'authenticated',
          user,
          error: null,
        });
      });

      return {
        success: true,
      };
    } catch (error) {
      const message = error?.message || 'Login failed.';

      startTransition(() => {
        setAuthState({
          status: 'unauthenticated',
          user: null,
          error: message,
        });
      });

      return {
        success: false,
        message,
        errors: Array.isArray(error?.errors) ? error.errors : [],
      };
    }
  }

  async function googleLogin(credential) {
    startTransition(() => {
      setAuthState((current) => ({
        ...current,
        status: 'loading',
        error: null,
      }));
    });

    try {
      const payload = await authApi.googleLogin(credential);
      if (payload.data?.requires_profile_completion) {
        startTransition(() => {
          setAuthState({
            status: 'unauthenticated',
            user: null,
            error: null,
          });
        });

        return {
          success: true,
          requiresProfileCompletion: true,
          googleProfile: payload.data.google_profile,
          credential,
          payload,
        };
      }

      const user = normalizeUser(payload.data);

      startTransition(() => {
        setAuthState({
          status: 'authenticated',
          user,
          error: null,
        });
      });

      return {
        success: true,
        user,
        payload,
      };
    } catch (error) {
      const message = error?.message || 'Google sign-in failed.';

      startTransition(() => {
        setAuthState({
          status: 'unauthenticated',
          user: null,
          error: message,
        });
      });

      return {
        success: false,
        message,
        errors: Array.isArray(error?.errors) ? error.errors : [],
      };
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Session can already be invalidated on server.
    }

    startTransition(() => {
      setAuthState({
        status: 'unauthenticated',
        user: null,
        error: null,
      });
    });
  }

  useEffect(() => {
    const sessionTimer = window.setTimeout(() => {
      refreshSession();
    }, 0);

    return () => window.clearTimeout(sessionTimer);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authState,
        login,
        googleLogin,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
