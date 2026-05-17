# 06 - Enhanced AI Production Prompt

Use this prompt when you want an AI coding session to make RentEase production-ready.

## Full prompt

```text
Act as a Senior Prompt Engineer, Full Stack Developer, Deployment Specialist, Security Engineer, Database Performance Engineer, and Production Readiness Planner for my RentEase system.

System context:
- Frontend: React + Vite
- Backend: Plain PHP
- Database: MySQL
- Local runtime: Docker Compose
- Deployment target: Railway
- Current upload folder: backend/storage
- Account/support email: renteasesupport@gmail.com

Main goal:
Make the system ready for real users. Production must not leak sensitive data, must not lose uploaded files after deployment, must handle many users and large data safely, and must remain maintainable.

Do not rewrite the whole app.
Do not remove existing working features.
Do not commit or hardcode secrets.
Do not store large uploaded images/documents directly in MySQL BLOB columns unless there is a documented reason.

Required investigation:
1. Inspect backend auth, upload, storage, payment proof, valid ID, room photo, profile photo, and admin endpoints.
2. Inspect frontend login/register/admin dashboard/user table flows.
3. Inspect database schema and existing optimization scripts.
4. Inspect Docker Compose, Railway config, and backend Dockerfile.
5. Identify production blockers before editing.

Production requirements:

Security:
- .env files must stay gitignored.
- Production secrets must be Railway variables or platform secrets.
- Backend-only secrets must never appear in frontend VITE variables.
- CORS must use exact production domains.
- Cookies/session settings must be production-safe.
- Admin role must not be selectable in public login/register UI.
- Google OAuth must not create admin users.
- Error logs must not expose passwords, tokens, cookies, reset links, or private file URLs.

Storage:
- Keep local backend/storage for Docker development.
- For production, support persistent storage.
- Prefer S3-compatible object storage such as Railway Buckets, Cloudflare R2, or AWS S3.
- Railway Volume is acceptable for first deployment.
- MySQL should store upload metadata and object keys/paths, not large binary file content.
- Public images and private documents must be separated.
- Private documents such as valid IDs and payment proofs must require backend authorization or signed URLs.
- Add cleanup policy for orphaned/replaced files.
- Add image optimization plan for room photos, boarding house covers, and profile photos.

Database:
- Add pagination to large list endpoints.
- Add indexes based on real WHERE, JOIN, and ORDER BY usage.
- Keep reports efficient.
- Add backup and restore guidance.
- Add log retention cleanup.
- Verify schema names before running any optimization SQL.

Deployment:
- Backend must run in Railway without local bind mounts.
- Frontend must build and run as production service.
- Database must use Railway MySQL variables.
- Upload storage must survive redeploys.
- Add or update healthcheck configuration.
- Keep local Docker workflow working.

Deliverables:
1. Production blocker list, ordered by severity.
2. Implementation plan.
3. Code/config changes with exact file list.
4. SQL migrations if needed.
5. Railway service settings and environment variables.
6. Storage migration plan from backend/storage to production storage.
7. Security checklist.
8. Database performance checklist.
9. Production smoke test checklist.
10. Rollback plan.

Verification:
- Run available lint/build/tests.
- Run Docker-only verification if the project requires Docker.
- Verify admin, owner, seeker, and guest flows.
- Verify upload and private file access behavior.
- Verify no secrets are committed.

Final answer format:
- Summary of changes
- Files changed
- Commands run
- Any tests that could not be run
- Remaining production risks
- Next recommended step
```

## Shorter prompt

```text
Make RentEase production-ready for real users on Railway.

Focus on secrets safety, persistent upload storage, database scale, role security, Docker/Railway deployment, backups, monitoring, and final launch checklist.

Do not rewrite the app.
Do not commit secrets.
Do not store large files as MySQL BLOBs.
Keep local Docker working.

Inspect first, then implement targeted fixes, then verify with build/lint/Docker checks.
```
