# 04 - Deployment and Operations

Goal: make RentEase stable after deployment, not only working on a local machine.

## Recommended production deployment

Use Railway-only first:

1. `rentease-frontend`
   - React + Vite.
   - Public web app.

2. `rentease-backend`
   - PHP backend.
   - API, auth, uploads, private file access.

3. `rentease-mysql`
   - MySQL database.

4. Storage
   - Best: Railway Bucket or S3-compatible storage.
   - First production: Railway Volume mounted to backend storage path.

## Docker production warning

The local Docker Compose workflow mounts backend and frontend folders from your machine.

Production containers must not depend on local bind mounts.

Before Railway production:

- Backend image must include backend source files.
- Frontend must run a production build.
- Storage must be persistent.
- Database must be Railway MySQL, not local Docker MySQL.

## Required Railway variables

Backend:

```env
RENTEASE_APP_NAME=RentEase
RENTEASE_APP_ENV=production
RENTEASE_APP_URL=https://YOUR_BACKEND_DOMAIN
RENTEASE_FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN
RENTEASE_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN

RENTEASE_DB_HOST=${{rentease-mysql.MYSQLHOST}}
RENTEASE_DB_PORT=${{rentease-mysql.MYSQLPORT}}
RENTEASE_DB_NAME=${{rentease-mysql.MYSQLDATABASE}}
RENTEASE_DB_USER=${{rentease-mysql.MYSQLUSER}}
RENTEASE_DB_PASS=${{rentease-mysql.MYSQLPASSWORD}}

RENTEASE_COOKIE_SAMESITE=Lax
RENTEASE_COOKIE_DOMAIN=

GOOGLE_OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

Frontend:

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_DOMAIN
VITE_APP_ENV=production
VITE_APP_NAME=RentEase
VITE_ENABLE_GOOGLE_AUTH=false
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_REDIRECT_URI=https://YOUR_FRONTEND_DOMAIN/auth/google/callback
```

Mail:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=renteasesupport@gmail.com
MAIL_PASSWORD=YOUR_GMAIL_APP_PASSWORD
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=renteasesupport@gmail.com
```

## Health checks

Backend has `ping.php`, which is a good healthcheck target.

Production health checks should confirm:

- backend process is alive
- database connection is available, if using a deeper healthcheck
- response time is acceptable
- no PHP fatal errors on boot

Keep healthcheck response small and do not expose secret configuration.

## Monitoring

Minimum production monitoring:

- Railway deployment logs
- Backend error logs
- MySQL storage growth
- Backend CPU/memory
- Frontend build/deploy status
- Storage usage
- Failed login/error rate
- Upload failures

Add alerts for:

- backend crash loop
- database connection failure
- storage near capacity
- many 500 errors
- unusually high upload failures

## Backups

Required:

- MySQL daily backups
- Storage backup strategy
- Manual backup before migrations
- Restore test before launch

If using Railway Volume:

- enable/schedule volume backups if available in your plan
- monitor volume capacity
- document how to restore files

If using object storage:

- document bucket credentials location
- document backup/export process
- use separate production and staging buckets

## Deployment flow

1. Build locally using Docker.
2. Run frontend build.
3. Run backend smoke test.
4. Deploy to staging.
5. Run database migration on staging.
6. Test admin, owner, seeker, public user flows.
7. Backup production.
8. Deploy backend.
9. Deploy frontend.
10. Run production smoke tests.
11. Watch logs for at least 15 to 30 minutes.

## Rollback plan

Every production deployment needs rollback steps:

- previous Railway deployment to redeploy
- database backup before migration
- migration rollback SQL when possible
- storage backup if file structure changed
- admin user that can verify recovery

If a migration deletes data, rollback may not be possible without restoring backup.

## Production smoke tests

After deploy:

- Open frontend home/login page.
- Login as admin.
- Open admin dashboard.
- Open admin users table.
- Login as owner.
- Create/update boarding house.
- Upload room image.
- Login as seeker.
- Browse rooms.
- Create reservation if test flow allows.
- Upload payment proof in a test record.
- Confirm private proof/ID URLs are not public.
- Confirm logout works.

## Operations implementation prompt

```text
Act as a Full Stack Deployment Specialist and DevOps Engineer for RentEase.

Make the project production-ready for Railway deployment without breaking Docker local development.

Requirements:
- Backend must run without local bind mounts.
- Frontend must run as production build.
- Backend must use Railway-provided PORT or documented service port.
- MySQL must use Railway variables.
- Upload storage must be persistent.
- Add healthcheck and deployment notes.
- Do not commit secrets.
- Keep local docker-compose workflow working.

Output:
- Changed files
- Railway service settings
- Required variables
- Storage setup
- Database initialization
- Rollback plan
- Production smoke test checklist
```
