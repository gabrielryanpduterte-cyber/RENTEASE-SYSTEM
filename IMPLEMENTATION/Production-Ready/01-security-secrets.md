# 01 - Security and Secrets

Goal: make sure sensitive data cannot leak when RentEase is used by real users.

## Sensitive data in RentEase

Treat these as sensitive:

- Database host, username, password, and URL
- Google OAuth client secret
- Gmail or SMTP app password
- Admin account credentials
- Session/cookie secrets
- Valid ID uploads
- Payment proof uploads
- User email, phone, and profile data
- Guardian/parent links
- Error logs that may expose request context
- Activity logs that contain user actions

## Current good signs

The root `.gitignore` already ignores:

- `.env`
- `.env.local`
- `backend/.env`
- `frontend/.env.local`
- `backend/storage/`
- `backend/vendor/`
- `frontend/node_modules/`

Keep that rule. Do not commit runtime uploads or real secrets.

## Production secret rules

1. Never commit real `.env` files.
2. Use `.env.example` only for safe placeholder values.
3. Put production values in Railway Variables, not in source code.
4. Use separate secrets for local, staging, and production.
5. Rotate any secret that was ever pasted into a chat, commit, screenshot, or public doc.
6. Do not put backend-only secrets in frontend `VITE_` variables.
7. Do not log passwords, tokens, cookies, reset tokens, valid ID URLs, or payment proof URLs.

## Backend variables that must stay private

```env
RENTEASE_DB_HOST=
RENTEASE_DB_PORT=
RENTEASE_DB_NAME=
RENTEASE_DB_USER=
RENTEASE_DB_PASS=
GOOGLE_CLIENT_SECRET=
MAIL_PASSWORD=
JWT_SECRET=
```

Frontend variables are visible to users after build. Only expose safe values:

```env
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=
VITE_APP_ENV=
```

The Google client ID is safe to expose. The Google client secret is not.

## CORS and domains

Production must use exact allowed origins:

```env
RENTEASE_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

Do not use `*` for production authenticated requests. Cookies and credentials should only work from your real frontend domain.

## Cookie/session rules

Production cookies should be:

- `HttpOnly`
- `Secure`
- `SameSite=Lax` or `SameSite=None` only when cross-site cookies require it
- scoped to the correct production domain

If frontend and backend are on different domains, test login persistence carefully.

## Upload privacy rules

Public files:

- Room photos
- Boarding house cover photos
- Public profile images, if intended

Private files:

- Valid IDs
- Payment proofs
- Guardian documents
- Any file related to verification or billing

Private files should not be served as direct static URLs. They should be served through a backend endpoint that checks:

1. Is the user logged in?
2. Does the user role allow access?
3. Does the user own or manage this record?
4. Is the file path inside the allowed storage root?

The current payment proof download pattern already follows this direction by checking access before `readfile`.

## Admin security

Admin must remain a database-created account, not a public registration option.

Production requirements:

- No public "admin role" selector on login or registration.
- Admin login uses email/password.
- Admin password is changed from any seeded/demo value.
- Admin account has a real support email controlled by the project owner.
- Admin actions are logged.

## Error and activity logs

Logs are useful, but logs can leak data.

Rules:

- Log user ID and action, not raw passwords or tokens.
- Do not log full request bodies for upload/auth endpoints.
- Keep error detail internal; show generic messages to users.
- Rotate or archive old logs.
- Delete old non-critical logs after a defined retention period.

Recommended retention:

- Error logs: 30 to 90 days
- Activity logs: 90 to 180 days
- Payment/audit records: keep according to business/legal need

## Secret leak response

If a secret leaks:

1. Remove it from the visible place.
2. Rotate the secret immediately.
3. Check Git history; removing from latest commit is not enough.
4. Revoke old credentials in Railway, Google Cloud, Gmail, and database.
5. Redeploy services with new variables.
6. Review access logs for suspicious use.

## Security implementation prompt

```text
Act as a Senior Full Stack Security Engineer for my RentEase PHP + React + MySQL system.

Audit the project for secret leaks, unsafe upload access, weak CORS, exposed admin paths, unsafe logs, and production misconfiguration.

Do not rewrite the app. Make only targeted production-hardening changes.

Requirements:
- No real secrets in Git.
- No backend secrets in frontend VITE variables.
- Exact production CORS origins.
- Secure session/cookie configuration.
- Private files must require backend authorization.
- Admin cannot be created from public registration.
- Logs must not contain passwords, tokens, cookies, reset links, valid ID URLs, or payment proof URLs.
- Provide a final checklist and changed files.
```
