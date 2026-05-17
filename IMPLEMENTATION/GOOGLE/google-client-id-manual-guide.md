# Google Client ID Manual Setup Guide for RentEase

Purpose: create a real Google OAuth Client ID for the RentEase Google sign-in button.

Use this guide for the current RentEase implementation:

- Frontend: React + Vite, running by Docker on `http://localhost:5173`
- Backend: PHP, running by Docker on `http://localhost:8080`
- Google endpoint: `backend/google-auth.php`
- Recommended Google/support email: `renteasesupport@gmail.com`

## Important notes

Google Client ID is safe to expose in the frontend.

Google Client Secret is private. Do not put it in frontend code or any `VITE_` variable.

For this RentEase implementation, the frontend receives a Google ID token and sends it to:

```text
POST /backend/google-auth.php?action=google-auth
```

The PHP backend verifies the token with Google. New Google users are registered as `seeker`. Admin users must use email and password only.

## Step 1 - Open Google Cloud Console

1. Go to:

```text
https://console.cloud.google.com
```

2. Login using the deployment/support Google account:

```text
renteasesupport@gmail.com
```

3. If you are using another Google account, make sure `renteasesupport@gmail.com` is added later as an owner/editor or support email.

## Step 2 - Create or select a project

1. Click the project selector at the top of Google Cloud Console.
2. Click `New Project`.
3. Use this project name:

```text
RentEase
```

4. Click `Create`.
5. Wait until the project is created.
6. Make sure the selected project is now `RentEase`.

Recommended project naming:

```text
RentEase Local Development
RentEase Staging
RentEase Production
```

For a school/capstone/demo deployment, one `RentEase` project is acceptable.

## Step 3 - Configure OAuth consent / app branding

1. In Google Cloud Console, open:

```text
Google Auth Platform
```

or:

```text
APIs & Services > OAuth consent screen
```

2. If Google asks for app audience/user type, choose:

```text
External
```

Use `External` because RentEase users may use any Google account, including Gmail, `.edu`, `.com`, or institutional accounts.

3. Fill in the app branding:

```text
App name: RentEase
User support email: renteasesupport@gmail.com
Developer contact email: renteasesupport@gmail.com
```

4. For scopes, keep only the basic/default identity scopes:

```text
openid
email
profile
```

Do not add Gmail, Drive, Calendar, or other sensitive scopes. RentEase only needs verified identity.

5. For local development, you can leave production links/domains unfinished if Google allows it.

For production later, add real public links:

```text
Homepage: https://YOUR_FRONTEND_DOMAIN
Privacy Policy: https://YOUR_FRONTEND_DOMAIN/privacy
Terms: https://YOUR_FRONTEND_DOMAIN/terms
Authorized domain: YOUR_DOMAIN
```

Do not add `localhost` as an authorized domain. `localhost` belongs in the OAuth client origins, not in authorized domains.

## Step 4 - Set audience / publishing status

For development:

1. Keep the app in `Testing` if Google asks.
2. Add test users:

```text
renteasesupport@gmail.com
your-personal-test-email@gmail.com
```

For real production:

1. Use `External`.
2. Publish the app when your production domain, privacy policy, and terms are ready.
3. Since RentEase only uses `openid`, `email`, and `profile`, the verification burden is much lower than apps requesting sensitive scopes.

## Step 5 - Create the OAuth Client ID

1. Open:

```text
APIs & Services > Credentials
```

or:

```text
Google Auth Platform > Clients
```

2. Click:

```text
Create Credentials
```

3. Select:

```text
OAuth client ID
```

4. Application type:

```text
Web application
```

5. Name:

```text
RentEase Web Docker Local
```

## Step 6 - Add Authorized JavaScript origins

Add these for local Docker development:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Optional only if you later serve the frontend from the PHP backend:

```text
http://localhost:8080
http://127.0.0.1:8080
```

For Railway production later, add your real frontend domain:

```text
https://YOUR_FRONTEND_RAILWAY_DOMAIN
https://YOUR_CUSTOM_FRONTEND_DOMAIN
```

Example:

```text
https://rentease.up.railway.app
https://rentease.com
```

The origin must match exactly. If the browser URL is `http://localhost:5173`, then `http://localhost:5173` must be listed.

## Step 7 - Add Authorized redirect URIs

The current RentEase frontend uses the Google button popup/token flow, so redirect URIs are not the main login path. Still, add these for compatibility with the existing env variables and future redirect flows:

```text
http://localhost:5173/auth/google/callback
http://127.0.0.1:5173/auth/google/callback
```

For Railway production later:

```text
https://YOUR_FRONTEND_RAILWAY_DOMAIN/auth/google/callback
https://YOUR_CUSTOM_FRONTEND_DOMAIN/auth/google/callback
```

Do not add this as a redirect URI:

```text
http://localhost:8080/google-auth.php?action=google-auth
```

That PHP endpoint receives the Google ID token from React. It is not a browser redirect callback.

## Step 8 - Create and copy credentials

1. Click `Create`.
2. Google will show:

```text
Client ID
Client Secret
```

3. Copy the Client ID. It looks like:

```text
1234567890-abc123def456.apps.googleusercontent.com
```

4. Copy the Client Secret if Google shows one.
5. Store the Client Secret privately.

For RentEase:

- Client ID goes to frontend and backend env.
- Client Secret stays backend/private only.

## Step 9 - Put the Client ID in Docker env

In the project root, create or update a root `.env` file for Docker Compose.

Do not commit this file.

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=PASTE_YOUR_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=PASTE_YOUR_CLIENT_ID_HERE
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

If you do not want to use the Client Secret yet, keep it blank:

```env
GOOGLE_CLIENT_SECRET=
```

The current backend verifies Google ID tokens using the Client ID. The secret is kept for future OAuth callback flow if needed.

## Step 10 - Restart Docker

From the project root:

```powershell
docker compose up -d --build --force-recreate backend frontend
```

Check containers:

```powershell
docker compose ps
```

Check backend logs:

```powershell
docker compose logs backend --tail=100
```

Check frontend logs:

```powershell
docker compose logs frontend --tail=100
```

## Step 11 - Test Google Sign-In

1. Open:

```text
http://localhost:5173/login
```

2. Confirm the Google button appears.
3. Click `Continue with Google`.
4. Choose a Google account.
5. Expected behavior:

```text
Existing Google user -> login
Existing local non-admin email -> link Google and login
New Google user -> auto-register as seeker and redirect to seeker dashboard
Admin email -> blocked from Google login
```

6. Check the database `users` table:

```sql
SELECT user_id, full_name, email, role, google_id, auth_provider, email_verified
FROM users
ORDER BY user_id DESC;
```

New Google users should show:

```text
role = seeker
auth_provider = google
email_verified = 1
google_id = not null
```

## Common errors and fixes

### Google button does not appear

Check root `.env`:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Then recreate frontend:

```powershell
docker compose up -d --force-recreate frontend
```

### Google OAuth is disabled

Backend env is disabled.

Set:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Then recreate backend:

```powershell
docker compose up -d --force-recreate backend
```

### Origin is not allowed

The current browser URL is not listed in Authorized JavaScript origins.

If you open:

```text
http://localhost:5173
```

Google must contain:

```text
http://localhost:5173
```

If you open:

```text
http://127.0.0.1:5173
```

Google must contain:

```text
http://127.0.0.1:5173
```

### Invalid Google token

Usually caused by mismatched Client IDs.

Make sure these are exactly the same:

```env
GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_ID=
```

### Admin cannot login with Google

This is intentional.

Admin must use email and password only. This protects the admin account from being tied to any Google account.

### New Google user goes to seeker dashboard

This is intentional.

Google sign-up creates a seeker account. Owners/landlords and parent accounts should use the normal registration form.

## Production Railway setup

When deploying to Railway:

1. Add production frontend domain to Authorized JavaScript origins.
2. Add production frontend callback to Authorized redirect URIs.
3. Add Railway variables to backend:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

4. Add Railway variables to frontend:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

5. Redeploy backend and frontend.

## Security checklist

- Do not commit `.env`.
- Do not paste Client Secret into frontend files.
- Do not put Client Secret in `VITE_` variables.
- Use only `openid`, `email`, and `profile` scopes.
- Keep admin Google login blocked.
- Use exact production domains in Google and backend CORS.
- Rotate the Client Secret if it was exposed.

## Enhanced AI prompt for setup help

```text
Act as a Google OAuth Setup Specialist, Full Stack Developer, Deployment Specialist, and Troubleshooting Expert for my RentEase system.

Guide me step by step in Google Cloud Console to create a Web OAuth Client ID for Sign in with Google.

My local Docker URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:8080

My support email:
- renteasesupport@gmail.com

My implementation:
- React Google button sends Google ID token to PHP backend.
- Backend endpoint is google-auth.php?action=google-auth.
- New Google users become seeker.
- Admin must never use Google OAuth.

Give me:
1. Exact Google Cloud steps.
2. Authorized JavaScript origins.
3. Authorized redirect URIs.
4. Env variables for Docker.
5. Railway production variables.
6. Troubleshooting checklist.
7. Security reminders so Client Secret is not leaked.
```

## Official references

- Google Identity Services setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Sign in with Google HTML API: https://developers.google.com/identity/gsi/web/reference/html-reference
- Google app audience/testing/production: https://support.google.com/cloud/answer/15549945
