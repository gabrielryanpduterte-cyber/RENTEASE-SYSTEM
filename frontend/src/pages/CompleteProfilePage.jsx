import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Home, LockKeyhole, Phone, UserRound } from 'lucide-react';
import { authApi } from '../api/client.js';
import { useAuth } from '../auth/useAuth.js';
import PasswordInput from '../components/PasswordInput.jsx';
import { roleDashboardPath } from '../utils/roles.js';
import { authImage } from '../data/renteaseContent.js';

const GOOGLE_PROFILE_ROLES = [
  {
    value: 'seeker',
    label: 'Seeker',
    description: 'Find and reserve a room.',
  },
  {
    value: 'owner',
    label: 'Landlord',
    description: 'List and manage rooms.',
  },
  {
    value: 'parent',
    label: 'Parent',
    description: 'Monitor a linked seeker.',
  },
];

function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authState, logout, refreshSession } = useAuth();
  const user = authState.user;
  const pendingGoogleCredential = location.state?.googleCredential || '';
  const pendingGoogleProfile = location.state?.googleUserInfo || null;
  const isPendingGoogleProfile = Boolean(pendingGoogleCredential && pendingGoogleProfile);
  const [form, setForm] = useState({
    role: 'seeker',
    full_name: '',
    contact_number: '',
    school_or_workplace: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isPendingGoogleProfile) {
      queueMicrotask(() => {
        setForm({
          role: 'seeker',
          full_name: pendingGoogleProfile.full_name || pendingGoogleProfile.name || '',
          contact_number: '',
          school_or_workplace: '',
          emergency_contact_name: '',
          emergency_contact_number: '',
          password: '',
          confirm_password: '',
        });
      });
      return;
    }

    if (!user) {
      return;
    }

    queueMicrotask(() => {
      setForm({
        role: ['seeker', 'owner', 'parent'].includes(user.role) ? user.role : 'seeker',
        full_name: user.full_name || '',
        contact_number: user.contact_number || '',
        school_or_workplace: user.school_or_workplace || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_number: user.emergency_contact_number || '',
        password: '',
        confirm_password: '',
      });
    });
  }, [isPendingGoogleProfile, pendingGoogleProfile, user]);

  if (!isPendingGoogleProfile && authState.status === 'loading') {
    return (
      <div className="fullscreen-center">
        <div className="status-panel">
          <p>Checking account...</p>
        </div>
      </div>
    );
  }

  if (!isPendingGoogleProfile && authState.status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  if (!isPendingGoogleProfile && user?.contact_number && user?.has_password) {
    return <Navigate to={roleDashboardPath(user.role)} replace />;
  }

  const displayUser = isPendingGoogleProfile ? pendingGoogleProfile : user;
  const needsRentEasePassword = isPendingGoogleProfile || !user?.has_password;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.contact_number.trim()) {
      setError('Contact number is required.');
      return;
    }

    if (needsRentEasePassword && form.password.length < 8) {
      setError('RentEase password must be at least 8 characters.');
      return;
    }

    if (needsRentEasePassword && form.password !== form.confirm_password) {
      setError('RentEase password and confirmation do not match.');
      return;
    }

    const updatePayload = {
      role: form.role,
      full_name: form.full_name,
      contact_number: form.contact_number,
      school_or_workplace: form.school_or_workplace,
      emergency_contact_name: form.emergency_contact_name,
      emergency_contact_number: form.emergency_contact_number,
    };

    if (needsRentEasePassword) {
      updatePayload.password = form.password;
      updatePayload.confirm_password = form.confirm_password;
    }

    setSubmitting(true);
    try {
      const payload = isPendingGoogleProfile
        ? await authApi.googleCompleteProfile(pendingGoogleCredential, updatePayload)
        : await authApi.updateProfile(updatePayload);
      const refreshedUser = await refreshSession({ silent: true });
      navigate(roleDashboardPath(refreshedUser?.role || payload?.data?.role || form.role || user?.role), { replace: true });
    } catch (requestError) {
      setError(requestError?.errors?.[0] || requestError?.message || 'Unable to update profile.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (authState.status === 'authenticated') {
      await logout();
    }
    navigate('/login', { replace: true });
  }

  const profileImageUrl = displayUser?.profile_photo_url || displayUser?.profile_picture || displayUser?.picture || '';
  const displayName = displayUser?.full_name || displayUser?.name || 'Google User';
  const displayEmail = displayUser?.email || '';
  const userInitial = displayName.trim()?.charAt(0)?.toUpperCase() || 'U';

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
          <h1>Complete your RentEase profile.</h1>
          <p>Google verified your email. Choose the role you need, then add your local contact details.</p>
          <ul>
            <li>
              <CheckCircle2 size={18} /> Google account verified
            </li>
            <li>
              <CheckCircle2 size={18} /> Seeker, landlord, and parent profiles supported
            </li>
          </ul>
        </div>
      </section>

      <section className="re-auth-panel">
        <div className="re-auth-card">
          <p className="re-eyebrow">Google sign-up</p>
          <h2>One more step</h2>
          <p>Choose how you will use RentEase, then create a RentEase password for manual login.</p>

          <div className="user-info-preview">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="profile-preview-img" referrerPolicy="no-referrer" />
            ) : (
              <div className="profile-preview-fallback" aria-hidden="true">
                {userInitial}
              </div>
            )}
            <div className="user-info-text">
              <p className="user-name">{displayName}</p>
              <p className="user-email">{displayEmail}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="re-form-stack">
            <fieldset className="re-profile-role-field">
              <legend>Account type</legend>
              <div className="re-profile-role-options">
                {GOOGLE_PROFILE_ROLES.map((roleOption) => (
                  <button
                    type="button"
                    key={roleOption.value}
                    className={form.role === roleOption.value ? 'active' : ''}
                    onClick={() => setForm((current) => ({ ...current, role: roleOption.value }))}
                  >
                    <strong>{roleOption.label}</strong>
                    <span>{roleOption.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <label>
              <span>Full name</span>
              <div className="re-input-with-icon">
                <UserRound size={17} />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  required
                />
              </div>
            </label>

            <label>
              <span>Contact number</span>
              <div className="re-input-with-icon">
                <Phone size={17} />
                <input
                  type="text"
                  value={form.contact_number}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contact_number: event.target.value }))
                  }
                  placeholder="09XXXXXXXXX"
                  required
                />
              </div>
            </label>

            {needsRentEasePassword && (
              <div className="re-form-two-col">
                <label>
                  <span>RentEase password</span>
                  <PasswordInput
                    className="re-input-with-icon"
                    leadingIcon={<LockKeyhole size={17} />}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                  />
                </label>

                <label>
                  <span>Confirm password</span>
                  <PasswordInput
                    className="re-input-with-icon"
                    leadingIcon={<LockKeyhole size={17} />}
                    autoComplete="new-password"
                    value={form.confirm_password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, confirm_password: event.target.value }))
                    }
                    placeholder="Repeat password"
                    minLength={8}
                    required
                  />
                </label>
              </div>
            )}

            <label>
              <span>School / Workplace</span>
              <input
                type="text"
                value={form.school_or_workplace}
                onChange={(event) =>
                  setForm((current) => ({ ...current, school_or_workplace: event.target.value }))
                }
                placeholder="University or workplace"
              />
            </label>

            <div className="re-form-two-col">
              <label>
                <span>Emergency contact name</span>
                <input
                  type="text"
                  value={form.emergency_contact_name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))
                  }
                  placeholder="Parent or guardian"
                />
              </label>

              <label>
                <span>Emergency contact number</span>
                <input
                  type="text"
                  value={form.emergency_contact_number}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, emergency_contact_number: event.target.value }))
                  }
                  placeholder="09XXXXXXXXX"
                />
              </label>
            </div>

            {error && <div className="re-error-panel">{error}</div>}

            <button type="submit" className="re-btn re-btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Continue'}
            </button>
            <button type="button" className="re-btn re-btn-secondary" onClick={handleCancel} disabled={submitting}>
              Cancel and use another account
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default CompleteProfilePage;
