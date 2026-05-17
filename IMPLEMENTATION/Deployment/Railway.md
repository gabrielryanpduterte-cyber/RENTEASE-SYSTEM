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

1. In the project canvas, click `New`.
2. Choose `Database`.
3. Select `MySQL`.
4. Rename the service to `rentease-mysql`.
5. Wait until the database deployment is active.
6. Open the MySQL service variables and note these values:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
   - `MYSQL_URL`

Use Railway's generated values. Do not use the local Docker values like `root`, `rentease`, or port `3308` in production.

## Step 5: Deploy the backend service

1. Click `New`.
2. Choose `GitHub Repo`.
3. Select the RentEase repository.
4. Rename the service to `rentease-backend`.
5. In service settings, configure the source:
   - Root directory: `/`
   - Dockerfile path variable: `RAILWAY_DOCKERFILE_PATH=docker/backend/Dockerfile`
6. Confirm the Dockerfile copies backend source files into the image before final production deploy.
7. Set public networking:
   - Generate a Railway domain.
   - Save the backend URL.

Backend service variables:

```env
RENTEASE_APP_NAME=RentEase
RENTEASE_APP_ENV=production
RENTEASE_APP_URL=https://YOUR_BACKEND_DOMAIN
RENTEASE_FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN

RENTEASE_DB_HOST=${{rentease-mysql.MYSQLHOST}}
RENTEASE_DB_PORT=${{rentease-mysql.MYSQLPORT}}
RENTEASE_DB_NAME=${{rentease-mysql.MYSQLDATABASE}}
RENTEASE_DB_USER=${{rentease-mysql.MYSQLUSER}}
RENTEASE_DB_PASS=${{rentease-mysql.MYSQLPASSWORD}}

RENTEASE_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
RENTEASE_COOKIE_SAMESITE=Lax
RENTEASE_COOKIE_DOMAIN=

GOOGLE_OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

If you enable Google later, set:

```env
GOOGLE_OAUTH_ENABLED=true
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

For email sending later:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=renteasesupport@gmail.com
MAIL_PASSWORD=your-16-character-gmail-app-password
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=renteasesupport@gmail.com
```

## Step 6: Deploy the frontend service

1. Click `New`.
2. Choose the same GitHub repository.
3. Rename the service to `rentease-frontend`.
4. In service settings:
   - Root directory: `/frontend`
   - Build command: `npm ci && npm run build`
   - Start command: `npm run preview -- --host 0.0.0.0 --port $PORT`
5. Generate a public Railway domain.
6. Copy the frontend URL and place it in the backend variable `RENTEASE_FRONTEND_URL`.

Frontend service variables:

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
VITE_APP_ENV=production
VITE_APP_NAME=RentEase
VITE_ENABLE_GOOGLE_AUTH=false
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

If you enable Google later:

```env
VITE_ENABLE_GOOGLE_AUTH=true
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

## Step 7: Configure public domains

1. Open `rentease-backend`.
2. Go to `Settings`.
3. Under networking, click `Generate Domain`.
4. Repeat for `rentease-frontend`.
5. Update variables after both domains exist:
   - Backend `RENTEASE_APP_URL`
   - Backend `RENTEASE_FRONTEND_URL`
   - Backend `RENTEASE_ALLOWED_ORIGINS`
   - Frontend `VITE_API_BASE_URL`
   - Frontend `VITE_GOOGLE_REDIRECT_URI`

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

Use `renteasesupport@gmail.com` as the Google Cloud project owner/support email.

1. Go to `https://console.cloud.google.com`.
2. Create or open the RentEase project.
3. Go to `APIs & Services`.
4. Open `OAuth consent screen`.
5. Set support email to `renteasesupport@gmail.com`.
6. Set user type to `External` if real public users need to log in.
7. Go to `Credentials`.
8. Create an OAuth 2.0 Client ID for web application.
9. Add authorized JavaScript origins:
   - `https://YOUR_FRONTEND_DOMAIN`
   - `https://YOUR_CUSTOM_FRONTEND_DOMAIN` if used
10. Add authorized redirect URIs:
   - `https://YOUR_FRONTEND_DOMAIN/auth/google/callback`
   - `https://YOUR_BACKEND_DOMAIN/auth/google/callback` if backend callback is implemented
11. Copy the client ID and secret into Railway variables.
12. Redeploy frontend and backend after changing variables.

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

## Official Railway references

- Services: `https://docs.railway.com/develop/services`
- Monorepo deployments: `https://docs.railway.com/guides/monorepo`
- MySQL: `https://docs.railway.com/guides/mysql`
- Public networking and `$PORT`: `https://docs.railway.com/public-networking`
- Dockerfile path: `https://docs.railway.com/reference/dockerfiles`
- Accounts and 2FA: `https://docs.railway.com/access/accounts`
