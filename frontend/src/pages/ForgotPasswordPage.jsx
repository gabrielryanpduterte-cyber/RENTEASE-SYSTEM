import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { authApi } from '../api/client.js';
import { authImage } from '../data/renteaseContent.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError?.errors?.[0] || requestError?.message || 'Unable to request password reset.');
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
          <h1>Reset access to your boarding house account.</h1>
          <p>Use the email connected to your RentEase account.</p>
        </div>
      </section>

      <section className="re-auth-panel">
        <div className="re-auth-card">
          <p className="re-eyebrow">Account recovery</p>
          <h2>Forgot password</h2>
          <p>We will send a password reset link when this email belongs to a password account.</p>

          {submitted ? (
            <div className="re-success-panel">
              <MailCheck size={24} />
              <div>
                <h3>Check your email</h3>
                <p>
                  If an account with that email exists, a reset link has been sent. It expires in
                  60 minutes.
                </p>
              </div>
            </div>
          ) : (
            <form className="re-form-stack" onSubmit={handleSubmit}>
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <p className="re-google-note">
                Signed in with Google? Return to login and use Continue with Google instead.
              </p>
              {error && <div className="re-error-panel">{error}</div>}
              <button type="submit" className="re-btn re-btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <p className="re-auth-switch">
            Remembered your password? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
