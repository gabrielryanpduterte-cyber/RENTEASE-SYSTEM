Your Google Client ID is in your project folder — the prompt will instruct you to locate it at client_secret_*.json or .env. You will plug it in where marked. Google verifies the email is real and active — .edu, .com, .ph, any domain — before the token reaches your PHP backend.
Switching from fake seeded email accounts to real Google accounts means wiping the users table (except admin). The prompt includes a one-time SQL reset script that keeps only the admin row.

What changes
Users now log in with their real Gmail (or any Google-verified email). No more @rentease.test fake accounts. The users table gets 3 new columns. A new password_reset_tokens table is created. A new remember_tokens table handles persistent login. PHPMailer is added to send real reset emails.
What stays the same
All existing RBAC (role: admin/owner/seeker). All dashboards and their API endpoints. The session-based auth system — Google OAuth just becomes an additional login path alongside email+password. The Palette 01 design system. The React + Vite frontend. Plain PHP backend.

Three auth methods — all supported simultaneously
1. Google OAuth (primary) — "Sign in with Google" button. Google verifies the user, returns a real verified email. No password needed. Works with any Google-connected email including .edu institutional accounts.
2. Email + Password (fallback) — for users who prefer not to use Google. Real email address required for the forgot password flow to work. Validated on registration.
3. Admin bypass — admin account uses email + password only. Admin will never be a Google OAuth user. This keeps the admin credential stable and independent of any Google account.
