import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { authApi } from '../api/client.js';
import PasswordInput from '../components/PasswordInput.jsx';
import { authImage } from '../data/renteaseContent.js';

function passwordChecks(value) {
  return {
    length: value.length >= 8,
    uppercase: /[A-Z]/.test(value),
    number: /\d/.test(value),
  };
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({
    password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const checks = passwordChecks(form.password);
  const validPassword = checks.length && checks.uppercase && checks.number;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!validPassword) {
      setError('Password must be at least 8 characters and include an uppercase letter and a number.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        token,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      setSuccess(true);
    } catch (requestError) {
      setError(requestError?.errors?.[0] || requestError?.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="re-auth-page">
      <section className="re-auth-visual" style={{ '--auth-image': `url(${authImage})` }}>
        <div>
          <Link to="/" className="re-brand light">
            RentEase
          </Link>
          <h1>Create a new RentEase password.</h1>
          <p>This reset link is single-use and expires after 60 minutes.</p>
        </div>
      </section>

      <section className="re-auth-panel">
        <div className="re-auth-card">
          <p className="re-eyebrow">Password reset</p>
          <h2>{success ? 'Password updated' : 'Set new password'}</h2>

          {success ? (
            <div className="re-success-panel">
              <CheckCircle2 size={24} />
              <div>
                <h3>You can now sign in</h3>
                <p>Your RentEase password has been updated.</p>
              </div>
            </div>
          ) : (
            <form className="re-form-stack" onSubmit={handleSubmit}>
              <label>
                <span>New password</span>
                <PasswordInput
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </label>
              <div className="re-password-rules">
                <span className={checks.length ? 'valid' : ''}>8 characters</span>
                <span className={checks.uppercase ? 'valid' : ''}>uppercase</span>
                <span className={checks.number ? 'valid' : ''}>number</span>
              </div>
              <label>
                <span>Confirm password</span>
                <PasswordInput
                  value={form.confirm_password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirm_password: event.target.value }))
                  }
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && <div className="re-error-panel">{error}</div>}
              <button type="submit" className="re-btn re-btn-primary" disabled={submitting}>
                <KeyRound size={17} />
                {submitting ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}

          <p className="re-auth-switch">
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
