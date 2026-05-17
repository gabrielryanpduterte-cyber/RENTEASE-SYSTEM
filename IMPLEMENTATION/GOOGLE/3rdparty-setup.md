Finding your Google Client ID
Look in your project folder for any of these files:
client_secret_*.json — downloaded from Google Cloud Console
.env or .env.local — may contain VITE_GOOGLE_CLIENT_ID=...
config.php or constants.php — may have define('GOOGLE_CLIENT_ID', '...')

The Client ID looks like: 123456789-abc123def.apps.googleusercontent.com

You need TWO values from Google Cloud Console:
GOOGLE_CLIENT_ID — used in React frontend (safe to expose)
GOOGLE_CLIENT_SECRET — used in PHP backend ONLY (never expose to frontend)
Google Cloud Console setup checklist
Go to console.cloud.google.com → your project → APIs & Services → Credentials

Under OAuth 2.0 Client IDs, click your client → verify these are set:

Authorized JavaScript origins:
http://localhost:5173 (Vite dev)
http://localhost:8000 (PHP dev server)
https://rentease.vercel.app (staging/production)

Authorized redirect URIs (for backend verification — not needed for GSI flow, but add anyway):
http://localhost:8000/api/auth/google/callback
https://rentease-api.up.railway.app/api/auth/google/callback

OAuth consent screen: set User Type to "External" so any Google account can log in (not just your org).

PHPMailer setup (for forgot password emails)
Install via Composer: composer require phpmailer/phpmailer

Use Gmail SMTP with an App Password (not your real Gmail password):
Go to myaccount.google.com → Security → 2-Step Verification → App passwords
Generate an app password for "Mail" → copy the 16-char password

Config values needed in your .env:
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=renteasesupport@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=renteasesupport@gmail.com

Alternative (no Gmail): use Resend.com free tier (3,000 emails/month free). Their PHP SDK is simpler.
