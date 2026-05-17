Complete one-text implementation prompt. Paste into your AI coding session. Replace YOUR_GOOGLE_CLIENT_ID and YOUR_GOOGLE_CLIENT_SECRET with real values from your project files.


====================================================================
RENTEASE — REAL AUTHENTICATION SYSTEM
Google OAuth + Email/Password + Forgot Password + Remember Me
====================================================================

TECH STACK:
  Frontend : React (Vite) + React Router + Tailwind CSS + Axios
  Backend  : Plain PHP 8.x (vanilla — NO Laravel, NO framework)
             Organized as: /backend/api/ with index.php router
  Database : MySQL 8.x (via phpMyAdmin / XAMPP or Railway MySQL)
  Email    : PHPMailer (via Composer) using Gmail SMTP
  Auth     : Google Identity Services (GSI) library for OAuth
             + custom PHP JWT for session tokens
  Design   : Palette 01 — Ivory (#F7F5F0) + Slate (#1C1C1A)
             + Gold (#C9A96E) · Playfair Display + DM Sans

IMPORTANT — FIND GOOGLE CREDENTIALS FIRST:
  Before writing any code, look in the project directory for:
  - client_secret_*.json (downloaded from Google Cloud Console)
  - .env or .env.local containing VITE_GOOGLE_CLIENT_ID
  - config.php or constants.php with define('GOOGLE_CLIENT_ID')
  The Client ID looks like: xxxxx.apps.googleusercontent.com
  Plug it into the constants below before proceeding.

====================================================================
SECTION 0: DATABASE RESET + NEW MIGRATIONS
====================================================================

--- 0A. Run this FIRST — clears all test data, keeps admin ---

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE error_logs;
TRUNCATE TABLE guardian_links;
TRUNCATE TABLE payments;
TRUNCATE TABLE billing_cycles;
TRUNCATE TABLE reservations;
TRUNCATE TABLE room_amenities;
TRUNCATE TABLE rooms;
TRUNCATE TABLE boarding_houses;
DELETE FROM users WHERE role != 'admin';
SET FOREIGN_KEY_CHECKS = 1;

After this runs, the admin account is the only user left.
All new users register via Google OAuth or the real sign-up form.

--- 0B. Modify users table ---

ALTER TABLE users
  ADD COLUMN google_id      VARCHAR(100) NULL UNIQUE AFTER password,
  ADD COLUMN avatar_url     VARCHAR(500) NULL        AFTER google_id,
  ADD COLUMN auth_provider  ENUM('local','google')
                            NOT NULL DEFAULT 'local'  AFTER avatar_url;

Index:
  CREATE INDEX idx_google_id ON users(google_id);

--- 0C. Create password_reset_tokens table ---

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  email      VARCHAR(150)     NOT NULL,
  token      VARCHAR(64)      NOT NULL UNIQUE,
  expires_at TIMESTAMP        NOT NULL,
  created_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_token (token),
  INDEX      idx_email (email)
);

--- 0D. Create remember_tokens table ---

CREATE TABLE IF NOT EXISTS remember_tokens (
  id         BIGINT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED  NOT NULL,
  token_hash VARCHAR(128)     NOT NULL UNIQUE,
  expires_at TIMESTAMP        NOT NULL,
  created_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hash (token_hash),
  INDEX      idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

====================================================================
SECTION 1: BACKEND — PLAIN PHP
====================================================================

--- 1A. Project structure ---

backend/
  config/
    config.php          ← DB + app constants
    mail.php            ← PHPMailer factory
  middleware/
    auth.php            ← JWT validation middleware
    cors.php            ← CORS headers
  api/
    auth/
      google.php        ← POST /api/auth/google
      login.php         ← POST /api/auth/login
      register.php      ← POST /api/auth/register
      logout.php        ← POST /api/auth/logout
      forgot-password.php  ← POST /api/auth/forgot-password
      reset-password.php   ← POST /api/auth/reset-password
      me.php            ← GET /api/auth/me (validate session)
    [existing endpoints unchanged]
  helpers/
    jwt.php             ← JWT encode/decode helpers
    response.php        ← json_response() helper
  vendor/               ← Composer packages
  composer.json
  index.php             ← Router / entry point

--- 1B. config/config.php ---

 PDO::ERRMODE_EXCEPTION,
       PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
  }
  return $pdo;
}

--- 1C. middleware/cors.php ---

'HS256','typ'=>'JWT']));
  $payload['iat'] = time();
  $payload['exp'] = time() + JWT_EXPIRY;
  $body    = base64url_encode(json_encode($payload));
  $sig     = base64url_encode(hash_hmac('sha256', "$header.$body",
             JWT_SECRET, true));
  return "$header.$body.$sig";
}

function jwt_decode(string $token): ?array {
  $parts = explode('.', $token);
  if (count($parts) !== 3) return null;
  [$header, $body, $sig] = $parts;
  $expected = base64url_encode(hash_hmac('sha256',
    "$header.$body", JWT_SECRET, true));
  if (!hash_equals($expected, $sig)) return null;
  $payload = json_decode(base64url_decode($body), true);
  if ($payload['exp'] < time()) return null;
  return $payload;
}

function base64url_encode(string $data): string {
  return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function base64url_decode(string $data): string {
  return base64_decode(strtr($data, '-_', '+/'));
}

function get_auth_user(): ?array {
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (!str_starts_with($auth, 'Bearer ')) return null;
  return jwt_decode(substr($auth, 7));
}

function require_auth(): array {
  $user = get_auth_user();
  if (!$user) {
    http_response_code(401);
    echo json_encode(['message' => 'Unauthenticated.']);
    exit;
  }
  return $user;
}

function require_role(string ...$roles): array {
  $user = require_auth();
  if (!in_array($user['role'], $roles)) {
    http_response_code(403);
    echo json_encode(['message' => 'Forbidden.']);
    exit;
  }
  return $user;
}

--- 1E. api/auth/google.php ---
POST /api/auth/google
Body: { id_token: string }

 'id_token is required.']);
  exit;
}

// Verify token with Google's tokeninfo endpoint
$verify_url = 'https://oauth2.googleapis.com/tokeninfo?id_token='
              . urlencode($id_token);
$response   = file_get_contents($verify_url);
$google     = json_decode($response, true);

// Validate the token
if (!$google
    || ($google['aud'] ?? '') !== GOOGLE_CLIENT_ID
    || empty($google['email_verified'])
    || $google['email_verified'] !== 'true') {
  http_response_code(401);
  echo json_encode(['message' => 'Invalid or unverified Google token.']);
  exit;
}

$google_id  = $google['sub'];
$email      = $google['email'];
$name       = $google['name'] ?? $email;
$avatar_url = $google['picture'] ?? null;

$pdo = db();

// Check if user exists by google_id first, then by email
$stmt = $pdo->prepare(
  'SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1'
);
$stmt->execute([$google_id, $email]);
$user = $stmt->fetch();

if ($user) {
  // Existing user — update google_id and avatar if missing
  if (!$user['google_id']) {
    $pdo->prepare(
      'UPDATE users SET google_id=?, avatar_url=?,
       auth_provider="google" WHERE id=?'
    )->execute([$google_id, $avatar_url, $user['id']]);
    $user['google_id']     = $google_id;
    $user['avatar_url']    = $avatar_url;
    $user['auth_provider'] = 'google';
  }
  if ($user['account_status'] === 'inactive') {
    http_response_code(403);
    echo json_encode(['message' => 'Your account has been deactivated.']);
    exit;
  }
} else {
  // New user — auto-register as seeker
  $stmt = $pdo->prepare(
    'INSERT INTO users
     (full_name, email, password, role, account_status,
      google_id, avatar_url, auth_provider, created_at)
     VALUES (?, ?, ?, "seeker", "active", ?, ?, "google", NOW())'
  );
  // Password is a random string — google users never use it
  $dummy_pw = password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT);
  $stmt->execute([$name, $email, $dummy_pw,
                  $google_id, $avatar_url]);
  $user = [
    'id'             => $pdo->lastInsertId(),
    'full_name'      => $name,
    'email'          => $email,
    'role'           => 'seeker',
    'account_status' => 'active',
    'google_id'      => $google_id,
    'avatar_url'     => $avatar_url,
    'auth_provider'  => 'google',
  ];
}

// Update last login
$pdo->prepare('UPDATE users SET last_login_at=NOW() WHERE id=?')
    ->execute([$user['id']]);

// Log activity
$pdo->prepare(
  'INSERT INTO activity_logs
   (user_id, action_performed, affected_module, severity,
    ip_address, created_at)
   VALUES (?, "User logged in via Google", "auth", "info", ?, NOW())'
)->execute([$user['id'], $_SERVER['REMOTE_ADDR'] ?? null]);

// Issue JWT
$token = jwt_encode([
  'sub'   => $user['id'],
  'email' => $user['email'],
  'role'  => $user['role'],
  'name'  => $user['full_name'],
]);

echo json_encode([
  'token' => $token,
  'user'  => [
    'id'           => $user['id'],
    'full_name'    => $user['full_name'],
    'email'        => $user['email'],
    'role'         => $user['role'],
    'avatar_url'   => $user['avatar_url'],
    'auth_provider'=> $user['auth_provider'],
  ],
]);

--- 1F. api/auth/login.php ---
POST /api/auth/login
Body: { email, password, remember_me: bool }

Find user by email.
If auth_provider = 'google': return 400
  "You signed up with Google. Please use the Sign in with Google button."
If password_verify fails: return 401 "Invalid credentials."
If account_status = 'inactive': return 403

If remember_me = true:
  $raw_token  = bin2hex(random_bytes(64));         // 128 hex chars
  $token_hash = hash('sha256', $raw_token);
  $expires    = date('Y-m-d H:i:s',
                  strtotime('+'.REMEMBER_DAYS.' days'));
  // Delete any existing remember token for this user
  $pdo->prepare('DELETE FROM remember_tokens WHERE user_id=?')
      ->execute([$user['id']]);
  // Insert new
  $pdo->prepare(
    'INSERT INTO remember_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)'
  )->execute([$user['id'], $token_hash, $expires]);
  // Set HTTP-only cookie (30 days, secure in production)
  $secure = APP_ENV === 'production';
  setcookie('remember_token', $raw_token, [
    'expires'  => time() + (REMEMBER_DAYS * 86400),
    'path'     => '/',
    'httponly' => true,
    'secure'   => $secure,
    'samesite' => 'Lax',
  ]);

Update last_login_at. Log activity. Issue JWT. Return token + user.

--- 1G. api/auth/register.php ---
POST /api/auth/register
Body: { full_name, email, password, confirm_password,
        contact_number, role (seeker|owner) }

Validation:
  full_name: required, min 2, max 100
  email: required, valid format, not already registered
  password: required, min 8, at least 1 uppercase + 1 number
  confirm_password: must match password
  contact_number: required, Philippine format preferred
  role: must be 'seeker' or 'owner' (not admin — admin is
    created directly in DB only)

If email exists AND auth_provider = 'google':
  Return 409: "This email is registered with Google.
  Please use Sign in with Google."

Hash password with PASSWORD_BCRYPT, set auth_provider='local'.
Insert user. Log activity. Issue JWT. Return token + user.

--- 1H. api/auth/forgot-password.php ---
POST /api/auth/forgot-password
Body: { email: string }

Always return 200 with the same message regardless of
whether the email exists — prevents email enumeration.
Message: "If an account with that email exists, a reset
link has been sent."

Find user by email. If not found: return 200 (silent).
If user.auth_provider = 'google':
  Do NOT send reset email.
  Return 200 (still silent — don't reveal they're a Google user
  to a potential attacker). The UI will guide real users.

Generate reset token:
  $raw_token  = bin2hex(random_bytes(32));   // 64 hex chars
  $expires    = date('Y-m-d H:i:s', strtotime('+60 minutes'));

Delete any existing token for this email:
  DELETE FROM password_reset_tokens WHERE email = ?

Insert new token:
  INSERT INTO password_reset_tokens (email, token, expires_at)

Build reset link:
  FRONTEND_URL . '/reset-password?token=' . $raw_token

Send email via PHPMailer (see config/mail.php):
  Subject: "Reset your RentEase password"
  Body (HTML):
    RentEase logo/heading
    "We received a request to reset your password."
    Link button: "Reset Password"
    "This link expires in 60 minutes."
    "If you didn't request this, ignore this email."

--- 1I. api/auth/reset-password.php ---
POST /api/auth/reset-password
Body: { token, password, confirm_password }

Validate: password min 8, has uppercase + number.
Confirm match.

Find token in password_reset_tokens:
  SELECT * FROM password_reset_tokens WHERE token = ?
If not found: return 400 "Reset link is invalid."
If expires_at < NOW(): return 400 "Reset link has expired.
  Please request a new one."

Find user by token.email:
  SELECT * FROM users WHERE email = ? AND auth_provider = 'local'
If not found: return 400 (should not happen, but guard it)

Update password:
  UPDATE users SET password = password_hash(new_pw, BCRYPT)

Delete the reset token immediately:
  DELETE FROM password_reset_tokens WHERE token = ?

Also invalidate all remember tokens for this user:
  DELETE FROM remember_tokens WHERE user_id = ?

Log activity: "Password reset successfully" severity: "warning"

Return 200: { message: "Password updated. You can now log in." }

--- 1J. api/auth/me.php ---
GET /api/auth/me
Headers: Authorization: Bearer {token}

Validates JWT. If expired or invalid, check for remember_me cookie:
  $cookie_token = $_COOKIE['remember_token'] ?? null;
  If cookie exists:
    $hash = hash('sha256', $cookie_token);
    Find in remember_tokens WHERE token_hash = ? AND expires_at > NOW()
    If found:
      Rotate token (delete old, generate new raw+hash, set new cookie)
      Load user from user_id
      Issue new JWT
      Return 200 with new token + user
    Else:
      Clear the cookie:
        setcookie('remember_token', '', time()-3600, '/');
      Return 401

If JWT valid: return user data from DB (fresh fetch, not just JWT payload)

--- 1K. api/auth/logout.php ---
POST /api/auth/logout
Headers: Authorization: Bearer {token}

Delete remember_token from DB (if user has one):
  $user = get_auth_user();
  DELETE FROM remember_tokens WHERE user_id = ?

Clear the cookie:
  setcookie('remember_token', '', time()-3600, '/', '', true, true);

Log activity: "User logged out"
Return 200: { message: "Logged out." }

--- 1L. config/mail.php --- PHPMailer factory ---

isSMTP();
  $mail->Host       = getenv('MAIL_HOST') ?: 'smtp.gmail.com';
  $mail->SMTPAuth   = true;
  $mail->Username   = getenv('MAIL_USERNAME');
  $mail->Password   = getenv('MAIL_PASSWORD');
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
  $mail->Port       = 587;
  $mail->setFrom(
    getenv('MAIL_FROM_ADDRESS'),
    getenv('MAIL_FROM_NAME') ?: 'RentEase'
  );
  $mail->isHTML(true);
  $mail->CharSet = 'UTF-8';
  return $mail;
}

function send_reset_email(string $to_email, string $reset_link): void {
  $mail = mailer();
  $mail->addAddress($to_email);
  $mail->Subject = 'Reset your RentEase password';
  $mail->Body    = '
    

      

        Reset your password

      


        We received a request to reset the password for your
        RentEase account.


      Reset password
      


        This link expires in 60 minutes. If you did not request a
        password reset, you can ignore this email.


    
';
  $mail->AltBody = "Reset your RentEase password: $reset_link
    (expires in 60 minutes)";
  $mail->send();
}

====================================================================
SECTION 2: FRONTEND — REACT + VITE
====================================================================

--- 2A. Environment variables (frontend/.env.local) ---

VITE_API_BASE_URL=http://localhost:8000/api
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
VITE_APP_ENV=local

--- 2B. index.html — load Google Identity Services ---

In the  of index.html, BEFORE the React scripts:
  

--- 2C. src/lib/auth.js — auth state management ---

Store JWT in memory (not localStorage) for security.
Use a module-level variable:
  let _token = null;
  let _user  = null;

export const setToken = (token, user) => { _token = token; _user = user; };
export const getToken = () => _token;
export const getUser  = () => _user;
export const clearAuth= () => { _token = null; _user = null; };
export const isLoggedIn = () => !!_token;
export const hasRole  = (...roles) => roles.includes(_user?.role);

On app init (App.jsx useEffect), call GET /api/auth/me
  with credentials: 'include' (lets the browser send the
  remember_me cookie). If it returns a new token, store it.
  This is how remember_me restores the session silently.

--- 2D. src/lib/axios.js — configured Axios instance ---

import axios from 'axios';
import { getToken, clearAuth } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,   // sends remember_me cookie
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

--- 2E. src/pages/LoginPage.jsx ---

UI layout: split screen (left: RentEase branding/house image,
right: form). Palette 01 design system. Playfair Display heading.

State: email, password, rememberMe (bool), isLoading, error

"Sign in with Google" button:
  Use Google's rendered button via useEffect:
    useEffect(() => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-btn'),
        {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'rectangular',
        }
      );
    }, []);

  handleGoogleResponse = async ({ credential }) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/google', { id_token: credential });
      setToken(res.data.token, res.data.user);
      redirectByRole(res.data.user.role);
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

Divider between Google button and email form:
  "─────── or continue with email ───────"
  (DM Sans 12px, #9A9890, centered)

Email + Password form:
  Fields: email (type="email"), password (type="password",
    show/hide toggle with ti-eye / ti-eye-off icon)
  Remember me: checkbox + "Remember me for 30 days" label
  Forgot password: link below password field → /forgot-password
  Submit: "Sign in" button (slate bg, ivory text)
  Error: amber or red notice box below form

redirectByRole function:
  admin  → /admin/dashboard
  owner  → /owner/dashboard
  seeker → /dashboard

"Don't have an account? Sign up" link → /register

--- 2F. src/pages/RegisterPage.jsx ---

Same split-screen layout as login.
Heading: "Create your account" (Playfair Display)

Fields:
  Full name (text)
  Email (type="email" — any real email, .edu, .com, .ph all valid)
  Password (with strength indicator)
  Confirm password
  Contact number
  Role: radio buttons — "I'm looking for a room" (seeker)
    vs "I'm a boarding house owner" (owner)

"Sign up with Google" button (same Google GSI button):
  On Google sign-up: calls same /api/auth/google endpoint.
  Google users are always registered as 'seeker'.
  Show message: "Signing up with Google creates a Seeker
  account. To register as a Landlord, please use email."

Submit calls POST /api/auth/register.
On success: setToken + redirectByRole.

--- 2G. src/pages/ForgotPasswordPage.jsx ---

Minimal centered card layout (no split screen — simple):
  Back arrow → /login
  Heading: "Forgot your password?" (Playfair Display)
  Body: "Enter your email and we'll send you a reset link."
  Email input (type="email")
  Submit button: "Send reset link"

State: email, isSubmitted, isLoading, error

On submit: POST /api/auth/forgot-password { email }
On success (regardless of response):
  Show success state:
    Green checkmark icon (ti-check)
    "Check your email"
    "If an account with that email exists, we've sent a
    password reset link. It expires in 60 minutes."
    "Back to login" link
  Do NOT show different message if email not found —
  this prevents email enumeration.

Special case — user trying forgot password on Google account:
  The backend silently ignores it (returns 200 anyway).
  The UI shows the same success message. The user will simply
  not receive an email, and they'll realize they need to
  use the Google button instead.
  Add help text below the form:
    "Signed in with Google? Use the Sign in with Google button
    on the login page — no password needed."

--- 2H. src/pages/ResetPasswordPage.jsx ---

Extract token from URL query string:
  const [params] = useSearchParams();
  const token = params.get('token');
  If no token: redirect to /login.

UI: centered card.
  Heading: "Set a new password" (Playfair Display)
  Fields:
    New password (with strength indicator)
    Confirm new password (match validation)
  Submit: "Update password"

Password strength indicator:
  Checks: length ≥ 8, has uppercase, has number, has symbol
  Visual: 4 segment bar
    Red (1 check) → Orange (2) → Amber (3) → Green (4)
  Label: Weak / Fair / Good / Strong

On submit: POST /api/auth/reset-password
  { token, password, confirm_password }
On success:
  Show: "Password updated!"
  Subtext: "You can now sign in with your new password."
  Button: "Go to login" → /login
On error (invalid/expired token):
  Show: "This reset link is invalid or has expired."
  Button: "Request a new link" → /forgot-password

--- 2I. src/App.jsx — session restore on load ---

useEffect(() => {
  const restoreSession = async () => {
    try {
      const res = await api.get('/auth/me');
      // /auth/me either validates JWT or uses remember_me cookie
      if (res.data.token) {
        // New token was issued (remember_me rotation)
        setToken(res.data.token, res.data.user);
      } else {
        setToken(getToken(), res.data.user);
      }
    } catch {
      clearAuth();
    } finally {
      setAppReady(true);  // show the app (not a blank screen)
    }
  };
  restoreSession();
}, []);

Show a loading state (spinner or RentEase logo) while
setAppReady is false. This prevents the flash of the login
page before the session is restored.

--- 2J. Auth context (src/contexts/AuthContext.jsx) ---

Provide: user, isLoggedIn, isLoading, login, loginGoogle,
  logout, hasRole

AuthProvider wraps the entire app in main.jsx.
ProtectedRoute component: checks isLoggedIn, if false →
  redirect to /login (preserves the intended URL in state).
RoleRoute component: checks hasRole, if false → redirect
  to the user's correct dashboard.

====================================================================
SECTION 3: ROUTE PROTECTION
====================================================================

React Router protected routes:

Public routes (no auth needed):
  /                    PublicHomePage
  /rooms               RoomsListingPage
  /rooms/:id           RoomDetailPage
  /login               LoginPage
  /register            RegisterPage
  /forgot-password     ForgotPasswordPage
  /reset-password      ResetPasswordPage
  /guardian-view/:token GuardianViewPage
  /maintenance         MaintenancePage

Protected (any authenticated user):
  /dashboard           → seeker only (RoleRoute)
  /owner/dashboard     → owner only (RoleRoute)
  /admin/dashboard     → admin only (RoleRoute)

If logged-in user visits /login → redirect to their dashboard.

====================================================================
SECTION 4: SECURITY RULES
====================================================================

1. JWT stored in memory only (not localStorage, not sessionStorage).
   localStorage is vulnerable to XSS. Memory clears on tab close,
   which is fine — remember_me cookie restores it on next visit.

2. Remember token stored as SHA-256 hash in DB.
   Cookie contains raw token. Never store raw token in DB.
   Rotate remember token on every use to prevent token theft replay.

3. Forgot password: always return 200 with the same message.
   Never reveal whether an email is registered (prevents enumeration).

4. Google token verification: verify with Google's endpoint, not
   just decode the JWT locally. A client can forge a local JWT.
   Always verify server-side against Google's tokeninfo endpoint.

5. Password reset tokens: single-use, deleted immediately after use.
   Also invalidate all remember tokens on password reset
   (forces re-login on all devices after a password change).

6. Admin account: NEVER register admin via Google OAuth.
   Admin uses email+password only. Admin email+password is set
   directly in the database (no public registration path to admin).

7. Rate limit forgot-password endpoint in production:
   Track by IP: max 3 requests per 15 minutes.
   Add a simple rate_limits table or use APCu if available.
   Without this, the reset email endpoint can be abused.

====================================================================
SECTION 5: .env FILES
====================================================================

backend/.env (gitignored):
  DB_HOST=127.0.0.1
  DB_NAME=rentease_db
  DB_USER=root
  DB_PASS=
  GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
  JWT_SECRET=generate_random_64_chars_here
  FRONTEND_URL=http://localhost:5173
  APP_ENV=local
  MAIL_HOST=smtp.gmail.com
  MAIL_PORT=587
  MAIL_USERNAME=renteasesupport@gmail.com
  MAIL_PASSWORD=your-16-char-gmail-app-password
  MAIL_FROM_NAME=RentEase
  MAIL_FROM_ADDRESS=renteasesupport@gmail.com

frontend/.env.local (gitignored):
  VITE_API_BASE_URL=http://localhost:8000/api
  VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
  VITE_APP_ENV=local

====================================================================
SECTION 6: COMPOSER.JSON (backend)
====================================================================

{
  "require": {
    "phpmailer/phpmailer": "^6.9"
  },
  "autoload": {
    "psr-4": {
      "App\\": "src/"
    }
  }
}

Run: composer install
This creates vendor/autoload.php which your config/mail.php
requires for PHPMailer.

====================================================================
SECTION 7: GOOGLE CLOUD CONSOLE SETUP VERIFICATION
====================================================================

Before testing, verify these in Google Cloud Console:
  console.cloud.google.com → your project →
  APIs & Services → Credentials → OAuth 2.0 Client IDs

Authorized JavaScript origins MUST include:
  http://localhost:5173
  http://localhost:8000

OAuth consent screen:
  User Type: External (allows any Google account — .edu, .com, etc.)
  Scopes: email, profile, openid (these are defaults — do not add more)
  Test users: add your own email during development
  Publishing status: set to "In production" when ready to go live
    (otherwise only test users can log in)

====================================================================
END OF PROMPT
====================================================================
