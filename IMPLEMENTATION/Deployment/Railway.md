# RentEase Railway Deployment Guide

Account to use for deployment: `renteasesupport@gmail.com`

Use this email as the owner/support account for:
- Railway account login and billing notifications
- Google OAuth consent screen support email
- Gmail SMTP sender email, if you use Gmail App Passwords
- Production alerts and handoff documentation

## Best deployment plan for RentEase

Recommended Railway setup:

1. `rentease-mysql`
   - Railway MySQL database service.
   - Stores all production application data.

2. `rentease-backend`
   - PHP 8.x backend service.
   - Connects to Railway MySQL using Railway-provided MySQL variables.
   - Public domain example: `https://rentease-backend.up.railway.app`

3. `rentease-frontend`
   - React + Vite frontend service.
   - Calls the backend public URL.
   - Public domain example: `https://rentease.up.railway.app`

This keeps everything in Railway, which is simpler for one account and one project. Later, you can move the frontend to Vercel if you want better static frontend hosting, but Railway-only is the cleanest first production deployment.

## Important repo note before deployment

Your current Docker setup works locally because Docker Compose mounts folders:

- `./backend:/var/www/html`
- `./frontend:/app`

Railway does not use your local bind mounts during production deployment. That means the backend image must contain the backend files, and the frontend service must build from the frontend folder.

Before deploying the backend to Railway, make sure one of these is true:

1. The backend Railway service builds from repo root and uses `RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile`, and that Dockerfile copies `backend/` into `/var/www/html`.
2. Or create a production Dockerfile inside `backend/` that copies the backend files directly.

Do not skip this check. If the Docker image does not copy the backend code, Railway can build a PHP Apache container with no real app files inside it.

Current RentEase repo status:

1. The code has been pushed to `https://github.com/gabrielryanpduterte-cyber/RENTEASE-SYSTEM`.
2. The backend Dockerfile now copies `backend/` into `/var/www/html`.
3. `.dockerignore` excludes local `.env` and `.env.local` files.
4. You are ready to create the Railway project and services.

## Step 1: Create the Railway account

1. Go to `https://railway.com`.
2. Click `Login` or `Start a New Project`.
3. Sign in with GitHub if your RentEase repository is on GitHub.
4. Use or connect the account email `renteasesupport@gmail.com`.
5. Open the profile menu, then go to `Account Settings`.
6. Confirm the account email is `renteasesupport@gmail.com`.
7. Enable 2FA under account security.
8. Add billing or usage controls if Railway asks before deployment.

Recommended account ownership:

- Use `renteasesupport@gmail.com` as the long-term owner account.
- Connect the GitHub account that owns the RentEase repository.
- Do not deploy from a personal temporary email because production billing, alerts, and project access will depend on it.

You are done with Step 1 when:

1. You can see the Railway dashboard.
2. The left sidebar shows `My Projects`.
3. You can see the purple `+ New` button in the upper-right area.
4. Railway shows your trial or usage status, such as `27 days or $5.00 left`.

## Step 2: Prepare GitHub

1. Push the latest RentEase code to GitHub.
2. Confirm the repo includes:
   - `backend/`
   - `frontend/`
   - `database/`
   - `docker/backend/Dockerfile`
   - `docker-compose.yml`
3. Make sure secrets are not committed:
   - `.env`
   - `.env.local`
   - Gmail app password
   - Google client secret
   - database password
4. Keep `.env.example` files only as templates.

You are done with Step 2 when:

1. The repository exists on GitHub.
2. The latest commit is pushed to the repository.
3. GitHub did not block the push for secrets.
4. The repo contains `backend/`, `frontend/`, `database/`, `docker/backend/Dockerfile`, and `docker-compose.yml`.
5. The repo does not contain real `.env` files.

For the current RentEase deployment, Step 2 is done.

## Step 3: Create or choose the Railway project

Your screenshot shows the correct Railway screen:

- Left sidebar: `Projects` is selected.
- Main page title: `Projects`.
- Top-right button: purple `+ New`.
- Project cards: some cards show `No services`.

That means your account is already created and you are at the correct place to start Step 3.

### Option A: Use an existing empty project from the screenshot

Use this option if one of the project cards already shows `No services`.

1. On the `Projects` page, click an empty project card.
   - Example from your screenshot: a card like `attractive-transformation` or `fortunate-elegance`.
2. Confirm the project canvas has no important services yet.
3. Open the project settings.
4. Rename the project to:
   - `RentEase Production`
5. Return to the project canvas.
6. Continue to Step 4 and add the MySQL service.

This is usually the best option if the project is empty because it avoids creating extra unused Railway projects.

### Option B: Create a fresh project with the `+ New` button

Use this option if you want a clean new project instead of using the existing empty cards.

1. Stay on the `Projects` page shown in your screenshot.
2. Click the purple `+ New` button in the upper-right area.
3. Choose `Empty Project`.
4. Wait for Railway to open the new empty project canvas.
5. Open the project settings.
6. Rename the project to:
   - `RentEase Production`
7. Return to the project canvas.
8. Continue to Step 4 and add the MySQL service.

Using an empty project first is better for this repo because RentEase is a monorepo with separate backend and frontend services.

Do not choose a one-click template for this deployment. RentEase needs separate services for MySQL, backend, and frontend.

Step 3 is done when:

1. You are inside a Railway project named `RentEase Production`.
2. The project canvas is empty or ready for new services.
3. You have not deployed the repo yet.
4. You are ready to create the first service: `rentease-mysql`.

## Step 4: Add MySQL

1. In the `RentEase Production` project canvas, click `New`.
2. Choose `Database`.
3. Choose `Add MySQL`.
4. Wait until Railway creates the database service.
5. Click the MySQL service.
6. Open the service settings or service name menu.
7. Rename the MySQL service exactly to:

```text
rentease-mysql
```

8. Wait until the MySQL service shows as active or deployed.
9. Open the MySQL service `Variables` tab.
10. Confirm Railway generated these variables:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
   - `MYSQL_URL`

Use Railway's generated values. Do not use the local Docker values like `root`, `rentease`, or port `3308` in production.

Important MySQL warning:

If Railway shows a warning for `MYSQL_PUBLIC_URL`, do not use `MYSQL_PUBLIC_URL` in the RentEase backend variables.

`MYSQL_PUBLIC_URL` points through Railway's public TCP proxy. Railway warns about it because connecting through a public endpoint can create egress charges. RentEase should connect to MySQL from the backend service using Railway's private project networking variables instead.

Use these private/internal references in `rentease-backend`:

```env
RENTEASE_DB_HOST=${{rentease-mysql.MYSQLHOST}}
RENTEASE_DB_PORT=${{rentease-mysql.MYSQLPORT}}
RENTEASE_DB_NAME=${{rentease-mysql.MYSQLDATABASE}}
RENTEASE_DB_USER=${{rentease-mysql.MYSQLUSER}}
RENTEASE_DB_PASS=${{rentease-mysql.MYSQLPASSWORD}}
```

Do not add this to the backend:

```env
MYSQL_PUBLIC_URL=${{rentease-mysql.MYSQL_PUBLIC_URL}}
```

Only use public MySQL connection details when connecting from your own computer with a MySQL client. The deployed backend should use the private/internal Railway variables above.

Step 4 is done when the project has one active service named `rentease-mysql`.

## Step 5: Deploy the backend service

1. In the same `RentEase Production` project canvas, click `New`.
2. Choose `GitHub Repo`.
3. Select:

```text
gabrielryanpduterte-cyber/RENTEASE-SYSTEM
```

4. If Railway asks which branch to deploy, choose:

```text
main
```

5. After Railway creates the service, click the new service.
6. Rename the service exactly to:

```text
rentease-backend
```

7. Open `Settings`.
8. Set the root directory to:

```text
/
```

9. Set the Dockerfile path to:

```text
docker/backend/Dockerfile
```

10. If your Railway screen does not show a Dockerfile path field, open the `Variables` tab and add this variable:

```env
RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile
```

11. Open `Networking`.
12. Click `Generate Domain`.
13. Copy the generated backend URL.

Write the backend URL here before continuing:

```text
BACKEND_URL=https://PASTE_BACKEND_DOMAIN_HERE
```

Example format only:

```text
BACKEND_URL=https://rentease-backend-production.up.railway.app
```

Do not use the example value unless Railway actually gives you that exact URL.

### Backend variables to copy and paste

Before pasting, replace:

1. `https://PASTE_BACKEND_DOMAIN_HERE` with your generated backend URL.
2. `https://PASTE_FRONTEND_DOMAIN_HERE` with your generated frontend URL after Step 6.

If you have not created the frontend service yet, paste the block now with `https://PASTE_FRONTEND_DOMAIN_HERE`, then come back and replace it after Step 6.

Paste this into the `rentease-backend` service `Variables` tab:

```env
RENTEASE_APP_NAME=RentEase
RENTEASE_APP_ENV=production
RENTEASE_APP_URL=https://PASTE_BACKEND_DOMAIN_HERE
RENTEASE_FRONTEND_URL=https://PASTE_FRONTEND_DOMAIN_HERE

RENTEASE_DB_HOST=${{rentease-mysql.MYSQLHOST}}
RENTEASE_DB_PORT=${{rentease-mysql.MYSQLPORT}}
RENTEASE_DB_NAME=${{rentease-mysql.MYSQLDATABASE}}
RENTEASE_DB_USER=${{rentease-mysql.MYSQLUSER}}
RENTEASE_DB_PASS=${{rentease-mysql.MYSQLPASSWORD}}

RENTEASE_ALLOWED_ORIGINS=https://PASTE_FRONTEND_DOMAIN_HERE
RENTEASE_COOKIE_SAMESITE=Lax
RENTEASE_COOKIE_DOMAIN=

GOOGLE_OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

Optional Google OAuth backend variables for later.

Do not paste this until Google OAuth is fully configured in Google Cloud:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

Optional Gmail SMTP backend variables for later.

Do not paste a Gmail app password into GitHub. Only paste it into Railway variables:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=renteasesupport@gmail.com
MAIL_PASSWORD=your-16-character-gmail-app-password
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=renteasesupport@gmail.com
```

Step 5 is done when:

1. The backend service is named `rentease-backend`.
2. The backend service uses repo branch `main`.
3. The backend root directory is `/`.
4. The backend Dockerfile path is `docker/backend/Dockerfile`.
5. The backend has a generated public Railway URL.
6. The backend variables are pasted.

## Step 6: Deploy the frontend service

1. In the same `RentEase Production` project canvas, click `New`.
2. Choose `GitHub Repo`.
3. Select the same repository:

```text
gabrielryanpduterte-cyber/RENTEASE-SYSTEM
```

4. If Railway asks which branch to deploy, choose:

```text
main
```

5. After Railway creates the service, click the new service.
6. Rename the service exactly to:

```text
rentease-frontend
```

7. Open `Settings`.
8. Set the root directory to:

```text
/frontend
```

9. Use the frontend Dockerfile.

Railway should auto-detect this file because the service root directory is `/frontend`:

```text
Dockerfile
```

If Railway does not auto-detect it, add this variable to `rentease-frontend`:

```env
RAILWAY_DOCKERFILE_PATH=Dockerfile
```

Do not use the backend Dockerfile in the frontend service.

Wrong frontend variable:

```env
RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile
```

10. Remove custom frontend build/start commands if they are still set from an older attempt.

The frontend Dockerfile already runs:

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}
```

11. Open `Networking`.
12. Click `Generate Domain`.
13. If Railway asks for the frontend port, use:

```text
4173
```

14. Copy the generated frontend URL.

Write the frontend URL here:

```text
FRONTEND_URL=https://PASTE_FRONTEND_DOMAIN_HERE
```

Example format only:

```text
FRONTEND_URL=https://rentease-production.up.railway.app
```

Do not use the example value unless Railway actually gives you that exact URL.

### Frontend variables to copy and paste

Before pasting, replace:

1. `https://PASTE_BACKEND_DOMAIN_HERE` with your generated backend URL.
2. `https://PASTE_FRONTEND_DOMAIN_HERE` with your generated frontend URL.

Paste this into the `rentease-frontend` service `Variables` tab:

```env
VITE_API_BASE_URL=https://PASTE_BACKEND_DOMAIN_HERE
VITE_APP_ENV=production
VITE_APP_NAME=RentEase
VITE_ENABLE_GOOGLE_AUTH=false
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

Optional Google OAuth frontend variables for later.

Do not paste this until Google OAuth is fully configured in Google Cloud:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

Step 6 is done when:

1. The frontend service is named `rentease-frontend`.
2. The frontend service uses repo branch `main`.
3. The frontend root directory is `/frontend`.
4. The frontend uses `frontend/Dockerfile`.
5. The frontend does not use `docker/backend/Dockerfile`.
6. The frontend has a generated public Railway URL.
7. The frontend variables are pasted.

## Step 7: Configure public domains

After both services have public Railway domains, update the variables one final time.

Fill this in first:

```text
BACKEND_URL=https://PASTE_BACKEND_DOMAIN_HERE
FRONTEND_URL=https://PASTE_FRONTEND_DOMAIN_HERE
```

Then update `rentease-backend` variables:

```env
RENTEASE_APP_URL=https://PASTE_BACKEND_DOMAIN_HERE
RENTEASE_FRONTEND_URL=https://PASTE_FRONTEND_DOMAIN_HERE
RENTEASE_ALLOWED_ORIGINS=https://PASTE_FRONTEND_DOMAIN_HERE
GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

Then update `rentease-frontend` variables:

```env
VITE_API_BASE_URL=https://PASTE_BACKEND_DOMAIN_HERE
VITE_GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

After editing variables, redeploy both services:

1. Open `rentease-backend`.
2. Click `Deployments`.
3. Redeploy the latest deployment.
4. Open `rentease-frontend`.
5. Click `Deployments`.
6. Redeploy the latest deployment.

If you use a custom domain later:

- Frontend: `https://rentease.com`
- Backend: `https://api.rentease.com`

Then update CORS and Google OAuth allowed origins.

## Step 8: Initialize the database

Recommended production-safe order:

1. Open Railway MySQL connection details.
2. Connect using a MySQL client, Railway shell, or local MySQL CLI.
3. Run the base schema:
   - `database/rentease_base_schema.sql`
4. Create or verify the admin account.
5. Avoid loading full staging/test seed data into production unless you need a demo environment.

For a demo deployment only, you may run:

1. `database/rentease_base_schema.sql`
2. `database/staging_seed.sql`

For real production, keep seeded demo users out unless you intentionally need them.

## Step 9: Google OAuth setup

This step enables the `Continue with Google` button.

You can skip Step 9 for now if you want email/password login only. Keep these variables as `false`:

```env
GOOGLE_OAUTH_ENABLED=false
VITE_ENABLE_GOOGLE_AUTH=false
```

Use `renteasesupport@gmail.com` as the Google Cloud project owner/support email.

RentEase Google login flow:

1. The frontend shows the Google button.
2. Google returns an ID token to the frontend.
3. The frontend sends that ID token to `google-auth.php?action=google-auth`.
4. The backend verifies the token audience against `GOOGLE_CLIENT_ID`.
5. RentEase creates, links, or logs in the user.

Current RentEase does not use a backend Google redirect callback. Do not add `https://PASTE_BACKEND_DOMAIN_HERE/auth/google/callback` unless you later implement a backend OAuth callback route.

### Step 9A: Prepare your Railway URLs

Before opening Google Cloud, fill these in from Railway Step 7:

```text
BACKEND_URL=https://PASTE_BACKEND_DOMAIN_HERE
FRONTEND_URL=https://PASTE_FRONTEND_DOMAIN_HERE
```

Use the exact Railway domains, including `https://`.

Example format only:

```text
BACKEND_URL=https://rentease-backend-production.up.railway.app
FRONTEND_URL=https://rentease-production.up.railway.app
```

Do not use the example values unless Railway gave you those exact URLs.

### Step 9B: Create or open the Google Cloud project

1. Go to `https://console.cloud.google.com`.
2. Sign in using `renteasesupport@gmail.com` or the Google account that will own production OAuth.
3. Open the project selector at the top of the page.
4. Click `New Project` if RentEase does not have a Google Cloud project yet.
5. Use this project name:

```text
RentEase Production
```

6. Click `Create`.
7. Make sure `RentEase Production` is selected before continuing.

### Step 9C: Configure OAuth consent / branding

Google's current Google Identity Services setup requires an OAuth client ID and OAuth branding/consent details.

1. In Google Cloud Console, go to `APIs & Services`.
2. Open `OAuth consent screen` or `Google Auth Platform`.
3. Open `Branding`.
4. Set the app name:

```text
RentEase
```

5. Set user support email:

```text
renteasesupport@gmail.com
```

6. Set audience / user type:
   - Choose `External` if real users with any Google account will log in.
   - Choose `Internal` only if this is under a Google Workspace organization and only organization users will log in.
7. Add developer contact email:

```text
renteasesupport@gmail.com
```

8. For scopes, keep only the basic identity scopes:

```text
openid
email
profile
```

9. Do not request Gmail, Drive, Calendar, or other sensitive scopes for RentEase login.
10. Save the consent screen.

If Google keeps the app in Testing mode, add test users before testing:

```text
renteasesupport@gmail.com
your-personal-google-email@example.com
```

For a class/demo deployment, Testing mode is acceptable. For real public production, publish the app when the domain and policy pages are ready.

### Step 9D: Create the OAuth client ID

1. In Google Cloud Console, go to `APIs & Services`.
2. Open `Credentials`.
3. Click `Create Credentials`.
4. Choose `OAuth client ID`.
5. For application type, choose:

```text
Web application
```

6. Set the name:

```text
RentEase Railway Web
```

7. Under `Authorized JavaScript origins`, add your frontend origin only.

Paste this, replacing the placeholder:

```text
https://PASTE_FRONTEND_DOMAIN_HERE
```

Important: the JavaScript origin must contain only the scheme and host. Do not include `/login`, `/register`, or `/auth/google/callback`.

Correct:

```text
https://rentease-production.up.railway.app
```

Wrong:

```text
https://rentease-production.up.railway.app/login
https://rentease-production.up.railway.app/auth/google/callback
```

8. Under `Authorized redirect URIs`, add this frontend callback for compatibility:

```text
https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

RentEase currently uses frontend callback mode, so the JavaScript origin is the critical setting. The redirect URI is included because the app has a matching `VITE_GOOGLE_REDIRECT_URI` setting and it keeps the configuration ready if a redirect mode is added later.

9. Click `Create`.
10. Copy the generated Client ID.
11. Copy the generated Client Secret if Google shows one.

The Client ID looks like:

```text
1234567890-example.apps.googleusercontent.com
```

Never paste the Client Secret into frontend variables or GitHub. Keep it backend-only in Railway if you decide to store it.

### Step 9E: Update Railway backend variables

Open Railway:

1. Go to `RentEase Production`.
2. Click `rentease-backend`.
3. Open `Variables`.
4. Add or update these variables.

Paste this into the backend variables editor and replace the placeholders:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=PASTE_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

For the current RentEase code, `GOOGLE_CLIENT_SECRET` can stay blank because the backend verifies the Google ID token using `GOOGLE_CLIENT_ID`.

If you want to store the secret anyway, use backend only:

```env
GOOGLE_CLIENT_SECRET=PASTE_GOOGLE_CLIENT_SECRET_HERE
```

Do not add `GOOGLE_CLIENT_SECRET` to `rentease-frontend`.

### Step 9F: Update Railway frontend variables

Open Railway:

1. Go to `RentEase Production`.
2. Click `rentease-frontend`.
3. Open `Variables`.
4. Add or update these variables.

Paste this into the frontend variables editor and replace the placeholders:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=PASTE_GOOGLE_CLIENT_ID_HERE
VITE_GOOGLE_REDIRECT_URI=https://PASTE_FRONTEND_DOMAIN_HERE/auth/google/callback
```

The frontend needs the Google Client ID because the Google button runs in the browser. This is normal. The frontend must not receive the Google Client Secret.

### Step 9G: Redeploy both Railway services

Railway variables are applied through a new deployment.

1. Open `rentease-backend`.
2. Go to `Deployments`.
3. Redeploy the latest deployment.
4. Wait until the backend is `Active`.
5. Open `rentease-frontend`.
6. Go to `Deployments`.
7. Redeploy the latest deployment.
8. Wait until the frontend is `Active`.

If Railway shows staged changes after editing variables, review and apply/deploy those changes.

### Step 9H: Test Google login

1. Open your frontend Railway URL:

```text
https://PASTE_FRONTEND_DOMAIN_HERE
```

2. Go to `Login` or `Register`.
3. Confirm the `Continue with Google` button appears.
4. Click `Continue with Google`.
5. Choose a Google account.
6. If this is a new user, RentEase should send you to `Complete Profile`.
7. Fill in the required role, contact number, and password.
8. Submit the profile.
9. Confirm the user lands on the correct dashboard.

Expected behavior:

1. The Google popup opens.
2. Google returns a credential.
3. The frontend calls the Railway backend.
4. The backend accepts the token.
5. RentEase logs in or asks for profile completion.

### Step 9I: Fix common Google OAuth errors

Problem: `The given origin is not allowed for the given client ID`.

Fix:

1. Go to Google Cloud Console.
2. Open `APIs & Services`.
3. Open `Credentials`.
4. Click the `RentEase Railway Web` OAuth client.
5. Under `Authorized JavaScript origins`, add the exact frontend domain:

```text
https://PASTE_FRONTEND_DOMAIN_HERE
```

6. Save.
7. Wait a few minutes.
8. Hard refresh the frontend page.

Problem: The Google button does not appear.

Fix:

1. Check `rentease-frontend` variables:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=PASTE_GOOGLE_CLIENT_ID_HERE
```

2. Redeploy `rentease-frontend`.
3. Confirm the Client ID is not empty.

Problem: Google popup works, but RentEase says Google OAuth is disabled.

Fix:

1. Check `rentease-backend` variables:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=PASTE_GOOGLE_CLIENT_ID_HERE
```

2. Redeploy `rentease-backend`.

Problem: Google popup works, but backend rejects the token.

Fix:

1. Confirm frontend and backend use the same Google Client ID.
2. Confirm there are no extra spaces around the Client ID.
3. Confirm the frontend domain is listed in Authorized JavaScript origins.
4. Redeploy both services after variable changes.

Problem: Google says app is unverified.

Fix:

1. For demo/testing, keep the app in Testing mode and add your Google account as a test user.
2. For public production, complete the OAuth consent screen and publish the app.
3. Avoid sensitive scopes. RentEase only needs `openid`, `email`, and `profile`.

Step 9 is done when:

1. Google Cloud has a web OAuth client for RentEase.
2. The frontend Railway domain is listed in Authorized JavaScript origins.
3. The frontend callback URI is listed in Authorized redirect URIs.
4. `rentease-backend` has `GOOGLE_OAUTH_ENABLED=true`.
5. `rentease-backend` has the same `GOOGLE_CLIENT_ID`.
6. `rentease-frontend` has `VITE_ENABLE_GOOGLE_AUTH=true`.
7. `rentease-frontend` has the same `VITE_GOOGLE_CLIENT_ID`.
8. Both services were redeployed.
9. The `Continue with Google` button works from the Railway frontend domain.

## Step 10: Final deployment checks

Check backend:

- Open `https://YOUR_BACKEND_DOMAIN`.
- Confirm it returns an expected API response, not an Apache file listing.
- Check Railway deployment logs for PHP errors.
- Confirm the backend connects to MySQL.

Check frontend:

- Open `https://YOUR_FRONTEND_DOMAIN`.
- Login page loads.
- Login request goes to the Railway backend URL.
- Admin login redirects to `/admin/dashboard`.
- Owner and seeker dashboards still route correctly.
- CORS does not block API calls.

Check database:

- Admin account exists.
- No unwanted fake users exist in production.
- New registration writes to the Railway MySQL database.

Check security:

- No `.env` files were committed.
- Railway variables contain secrets.
- Admin password is changed from any default or demo password.
- Google client secret is backend-only.
- Gmail app password is not placed in frontend variables.

## Troubleshooting

Problem: backend deploys but API files are missing.

Fix: the Dockerfile probably did not copy `backend/` into the image. Update the production backend Dockerfile or Railway source settings.

Problem: frontend works locally but not on Railway.

Fix: make sure the frontend start command binds to `0.0.0.0` and uses `$PORT`.

Problem: frontend build fails with `EBUSY: resource busy or locked, rmdir '/app/node_modules/.vite'`.

Fix:

1. Make sure the latest repo commit is deployed.
2. Make sure `frontend/Dockerfile` exists in GitHub.
3. Open `rentease-frontend`.
4. Set Root Directory to `/frontend`.
5. Delete `RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile` from frontend variables if it exists.
6. Let Railway use `/frontend/Dockerfile`, or set `RAILWAY_DOCKERFILE_PATH=Dockerfile`.
7. Redeploy with cleared build cache if Railway offers that option.

This avoids the cached Nixpacks build path that can lock `node_modules/.vite`.

Problem: backend crashes with `AH00534: apache2: Configuration error: More than one MPM loaded`.

Fix:

1. Make sure the latest repo commit is deployed.
2. Open `rentease-backend`.
3. Keep Root Directory as `/`.
4. Keep `RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile`.
5. Redeploy with cleared build cache if Railway offers that option.

The backend Dockerfile disables conflicting Apache MPM modules and enables `mpm_prefork` before Apache starts.

Problem: API calls fail with CORS errors.

Fix: add the exact frontend domain to `RENTEASE_ALLOWED_ORIGINS`, then redeploy the backend.

Problem: database connection fails.

Fix: use Railway MySQL variables, not Docker Compose local values. The backend config already supports `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, and `MYSQLPASSWORD`.

Problem: Google sign-in says origin not allowed.

Fix: add the exact Railway frontend domain in Google Cloud Console under Authorized JavaScript origins.

Problem: admin login works locally but not in Railway.

Fix: verify the production database has the admin row, the password hash is correct, and the frontend is calling the Railway backend URL.

## Enhanced deployment prompt for AI coding session

Paste this into an AI coding session when you are ready to make code changes for Railway deployment:

```text
Act as a Senior Full Stack Developer, Deployment Specialist, Docker Engineer, and Troubleshooting Expert for my RentEase system.

Goal:
Prepare this existing RentEase monorepo for Railway-only production deployment using:
- React + Vite frontend
- Plain PHP backend
- MySQL database
- Railway services for frontend, backend, and MySQL

Deployment account:
Use renteasesupport@gmail.com as the deployment owner/support email reference.

Do not rewrite the app. Make only deployment-safe changes.

Required work:
1. Inspect the current Docker Compose setup and backend Dockerfile.
2. Fix the Railway production issue where Docker Compose local bind mounts are not available.
3. Ensure the backend Docker image includes the backend source files.
4. Ensure Apache/PHP can run correctly on Railway public networking.
5. Ensure the frontend can build and run on Railway using $PORT.
6. Add Railway config files only if they improve reliability.
7. Document the exact Railway service settings, variables, build commands, start commands, and deployment order.
8. Keep local Docker workflow working.
9. Do not commit secrets.

Expected output:
- Production-ready Railway deployment changes
- Clear list of changed files
- Railway variables for frontend and backend
- Database initialization steps
- Verification checklist for admin, owner, seeker, CORS, Google OAuth, and MySQL
```

## Official references

- Services: `https://docs.railway.com/develop/services`
- Monorepo deployments: `https://docs.railway.com/guides/monorepo`
- Railway variables: `https://docs.railway.com/variables`
- Railway best practices: `https://docs.railway.com/overview/best-practices`
- MySQL: `https://docs.railway.com/guides/mysql`
- Public networking and `$PORT`: `https://docs.railway.com/public-networking`
- Dockerfile path: `https://docs.railway.com/reference/dockerfiles`
- Accounts and 2FA: `https://docs.railway.com/access/accounts`
- Google Identity Services setup: `https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid`
- Google OAuth verification and consent screen: `https://support.google.com/cloud/answer/13461325`
