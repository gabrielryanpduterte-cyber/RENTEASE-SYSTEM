import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../auth/useAuth.js';
import { needsProfileCompletion, roleDashboardPath } from '../utils/roles.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { ENABLE_GOOGLE_AUTH } from '../config/google-oauth.js';
import { authImage } from '../data/renteaseContent.js';

function LoginPage() {
  const { authState, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const fromPath = location.state?.from;
  const nextPathForUser = (user) => {
    if (needsProfileCompletion(user)) {
      return '/complete-profile';
    }

    return roleDashboardPath(user?.role);
  };

  if (authState.status === 'authenticated') {
    return <Navigate to={nextPathForUser(authState.user)} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFeedback('');
    setSubmitting(true);

    const result = await login({
      email: form.email,
      password: form.password,
      remember_me: form.remember,
    });
    setSubmitting(false);

    if (!result.success) {
      const apiError = result.errors?.[0] || result.message || 'Unable to login.';
      setFeedback(apiError);
    }
  }

  const handleGoogleSuccess = (result) => {
    if (result?.requiresProfileCompletion) {
      navigate('/complete-profile', {
        replace: true,
        state: {
          googleCredential: result.credential,
          googleUserInfo: result.googleProfile,
        },
      });
      return;
    }

    const user = result?.user || result?.payload?.data;
    if (user?.role) {
      navigate(nextPathForUser(user), { replace: true });
    }
  };

  const handleGoogleError = (error) => {
    setFeedback(error || 'Google sign-in failed. Please try again.');
  };

  return (
    <main className="re-auth-page">
      <section className="re-auth-visual" style={{ '--auth-image': `url(${authImage})` }}>
        <div>
          <Link to="/" className="re-brand light">
            <span>
              <Home size={20} />
            </span>
            RentEase
          </Link>
          <h1>Boarding house access for every role.</h1>
          <p>
            Students, guardians, and landlords sign in to the same trusted platform with
            role-aware dashboards.
          </p>
          <ul>
            <li>
              <CheckCircle2 size={18} /> Verified properties and reservation tracking
            </li>
            <li>
              <CheckCircle2 size={18} /> Payment status and guardian visibility
            </li>
            <li>
              <CheckCircle2 size={18} /> Landlord room and payment controls
            </li>
          </ul>
        </div>
      </section>

      <section className="re-auth-panel">
        <div className="re-auth-card">
          <div className="theme-auth-row">
            <p className="re-eyebrow">Welcome back</p>
          </div>
          <h2>Sign in</h2>
          <p>Use your account email and password. RentEase will open the correct dashboard.</p>

          {fromPath && (
            <div className="re-notice-panel">
              Protected page requested: <strong>{fromPath}</strong>
            </div>
          )}

          <form onSubmit={onSubmit} className="re-form-stack">
            <label>
              <span>Email address</span>
              <div className="re-input-with-icon">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <PasswordInput
                className="re-input-with-icon"
                leadingIcon={<LockKeyhole size={17} />}
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter your password"
                required
              />
            </label>

            <div className="re-auth-options">
              <label>
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, remember: event.target.checked }))
                  }
                />
                Remember me
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            {feedback && <div className="re-error-panel">{feedback}</div>}

            <button type="submit" className="re-btn re-btn-primary" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          {ENABLE_GOOGLE_AUTH && (
            <>
              <div className="re-divider">
                <span>or</span>
              </div>

              <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
            </>
          )}

          <p className="re-auth-switch">
            No account yet? <Link to="/register">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
