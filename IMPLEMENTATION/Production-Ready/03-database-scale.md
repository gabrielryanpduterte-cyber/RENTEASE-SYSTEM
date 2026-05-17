# 03 - Database and Scale

Goal: make MySQL handle real users, many rooms, many reservations, many payments, logs, and upload records.

## Database responsibility

MySQL should store structured business data:

- Users
- Roles
- Boarding houses
- Rooms
- Reservations
- Billing cycles
- Payments
- Feedback
- Guardian links
- Activity logs
- Error logs
- Upload metadata

MySQL should not store large image/document content directly for normal production use.

## Large-data risks

As RentEase grows, these tables can become large:

- `activity_logs`
- `error_logs`
- `payments`
- `billing_cycles`
- `reservations`
- `rooms`
- `uploads`
- any table that tracks user actions or files

The risk is not only storage size. The bigger risk is slow dashboards if queries are not indexed and paginated.

## Query rules

Production rules:

1. Paginate every admin list.
2. Paginate users, rooms, payments, reservations, logs, and uploads.
3. Avoid returning all rows to the frontend.
4. Use filtering by date, role, status, owner, seeker, or payment state.
5. Add indexes that match real filters.
6. Avoid `SELECT *` for large list screens.
7. Do not load long text/blob-like content unless the page needs it.

## Required indexes

Use indexes based on query patterns.

Common index targets:

```sql
users(email)
users(role)
users(account_status)
users(created_at)

boarding_house(owner_id)
boarding_house(created_at)

rooms(boarding_house_id)
rooms(is_available)
rooms(created_at)

reservations(user_id)
reservations(room_id)
reservations(status)
reservations(created_at)

payments(reservation_id)
payments(payment_status)
payments(payment_date)
payments(created_at)

billing_cycles(reservation_id)
billing_cycles(status)
billing_cycles(due_date)

uploads(user_id)
uploads(reservation_id)
uploads(visibility)
uploads(created_at)

activity_logs(user_id)
activity_logs(created_at)
activity_logs(severity)

error_logs(created_at)
error_logs(error_code)
```

Before running any optimization script, verify the exact table and column names against the current schema. Some older scripts may use older names.

## Pagination standard

API list endpoints should accept:

```text
page=1
limit=20
search=
status=
role=
date_from=
date_to=
```

Recommended limits:

- default: 20
- max for normal lists: 100
- max for exports: use background export job, not normal API response

Frontend tables should show:

- current page
- total pages
- total records
- loading state
- empty state
- filter controls

## Logs and retention

Logs grow quickly.

Recommended:

- Error logs: keep 30 to 90 days.
- Activity logs: keep 90 to 180 days.
- Login/security audit logs: keep longer if needed.
- Payment/accounting records: keep according to business policy.

Add scheduled cleanup:

```sql
DELETE FROM error_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

DELETE FROM activity_logs
WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY);
```

Use the real timestamp column name for your schema.

## Backups

Production database must have backups before launch.

Minimum:

- Daily automated backup.
- Manual backup before every migration.
- Restore test at least once before launch.
- Separate backup account/location if possible.

Backup policy:

- Daily backups retained for at least 7 days.
- Weekly backups retained for at least 1 month.
- Monthly backup before major releases.

Do not claim production readiness until restore has been tested.

## Migration rules

1. Never run destructive SQL on production without backup.
2. Run migration first on local/staging database.
3. Use additive changes when possible:
   - add column
   - backfill
   - deploy code
   - remove old column later
4. Avoid long locks on large tables.
5. Document rollback steps.

## Data archiving

When tables become large:

- Archive old logs.
- Archive old completed reservations.
- Archive old payment verification artifacts.
- Keep active data fast and small.

Do not delete business-critical records without a documented policy.

## Reporting strategy

Admin reports should not run huge calculations on every dashboard load.

Better:

- Use indexed date ranges.
- Cache report summaries.
- Generate monthly aggregates.
- Use background jobs for large exports.
- Avoid computing lifetime totals from raw rows on every request.

## Database readiness checklist

- All list endpoints are paginated.
- Admin users list does not load every user at once.
- Payments and reservations have status/date indexes.
- Logs have retention cleanup.
- Backups are enabled.
- Restore has been tested.
- Production seed data does not contain fake users.
- Admin account exists and has a changed password.
- Database credentials are only in Railway variables.

## Database implementation prompt

```text
Act as a Senior Backend Engineer and MySQL Performance Specialist for RentEase.

Audit the PHP backend and MySQL schema for production readiness.

Goals:
- Handle thousands of users.
- Keep admin dashboards fast.
- Prevent unbounded API responses.
- Add correct indexes.
- Add safe backup and migration guidance.

Tasks:
1. Identify all list endpoints.
2. Ensure list endpoints support pagination and filtering.
3. Add or update indexes based on real WHERE, JOIN, ORDER BY clauses.
4. Review reports/dashboard queries for heavy scans.
5. Add retention cleanup SQL for activity_logs and error_logs.
6. Do not store uploaded file binary data in MySQL.
7. Provide migration SQL and rollback notes.

Output:
- Files changed
- SQL migrations
- Query risks found
- Before/after performance reasoning
- Test checklist
```
