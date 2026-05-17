# 05 - Production Checklist

Use this before saying: "The system is ready for real users."

## A. Source control

- [ ] `.env` files are not committed.
- [ ] `backend/storage/` is not committed.
- [ ] No real Gmail app password is in the repo.
- [ ] No Google client secret is in frontend code.
- [ ] No database password is in code.
- [ ] GitHub secret scanning is enabled if available.
- [ ] Any previously leaked secret has been rotated.

## B. Production variables

- [ ] Backend production variables are set in Railway.
- [ ] Frontend production variables are set in Railway.
- [ ] `RENTEASE_APP_ENV=production`.
- [ ] `RENTEASE_ALLOWED_ORIGINS` contains only real frontend domains.
- [ ] `VITE_API_BASE_URL` points to production backend.
- [ ] Mail sender uses `renteasesupport@gmail.com` or approved sender.
- [ ] Google OAuth variables are complete if Google login is enabled.

## C. Authentication

- [ ] Admin is not selectable from login/register UI.
- [ ] Admin account exists in production database.
- [ ] Admin password is changed from demo/default.
- [ ] Owner registration cannot create admin.
- [ ] Seeker registration cannot create admin.
- [ ] Google OAuth does not create admin users.
- [ ] Inactive users cannot login.
- [ ] Logout clears session/cookie state.

## D. Uploads and storage

- [ ] Uploads are stored in persistent storage.
- [ ] Railway Volume or object storage is configured.
- [ ] Public images and private documents are separated.
- [ ] Private documents require backend authorization.
- [ ] File size limits are enforced.
- [ ] MIME type validation is enforced.
- [ ] Filenames are generated server-side.
- [ ] Old/replaced files have cleanup policy.
- [ ] Storage capacity is monitored.

## E. Database

- [ ] Production database is separate from local/staging.
- [ ] Production database has no fake/test users except intentional demo data.
- [ ] Admin account remains after cleanup.
- [ ] Indexes exist for common filters and joins.
- [ ] List APIs are paginated.
- [ ] Reports do not scan huge tables without date limits.
- [ ] Backups are enabled.
- [ ] Restore has been tested.
- [ ] Migration rollback plan exists.

## F. Frontend

- [ ] Frontend production build succeeds.
- [ ] No debug-only UI is visible.
- [ ] Login works on production domain.
- [ ] Admin dashboard layout is responsive.
- [ ] Owner dashboard layout is responsive.
- [ ] Seeker dashboard layout is responsive.
- [ ] Long names/emails do not break tables.
- [ ] API errors show user-safe messages.

## G. Backend

- [ ] Backend starts without local bind mounts.
- [ ] Healthcheck endpoint works.
- [ ] PHP errors are not displayed to users.
- [ ] CORS works only for allowed domains.
- [ ] Private endpoints require auth.
- [ ] Role checks are enforced server-side.
- [ ] Upload endpoints require auth and ownership checks.
- [ ] Error responses do not expose stack traces or secrets.

## H. Payments and reservations

- [ ] Seeker can create reservation.
- [ ] Owner can approve/reject where intended.
- [ ] Payment proof upload works.
- [ ] Payment proof access is restricted.
- [ ] Billing statuses update correctly.
- [ ] Admin can audit payment records.

## I. Monitoring and recovery

- [ ] Railway logs are reviewed after deploy.
- [ ] Error logs are visible to admin/developer only.
- [ ] Storage usage can be checked.
- [ ] Database usage can be checked.
- [ ] Backup location is documented.
- [ ] Restore procedure is documented.
- [ ] Incident contact email is `renteasesupport@gmail.com`.

## J. Launch decision

Do not launch until all critical items are done:

- [ ] no secret leaks
- [ ] persistent storage
- [ ] database backup
- [ ] admin login verified
- [ ] owner/seeker flows verified
- [ ] upload privacy verified
- [ ] rollback plan ready

Launch status:

```text
READY / NOT READY:
Date:
Checked by:
Remaining risks:
Decision:
```
