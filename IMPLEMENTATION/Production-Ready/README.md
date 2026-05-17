# RentEase Production-Ready Guide

Purpose: make RentEase ready for real users, real uploads, real payments, and real production deployment.

This folder is a production playbook for the current system:

- Frontend: React + Vite
- Backend: Plain PHP
- Database: MySQL
- Runtime: Docker locally, Railway-ready deployment
- File uploads: `backend/storage`
- Account reference: `renteasesupport@gmail.com`

## What "production ready" means for RentEase

RentEase is production ready only when these are true:

1. Real secrets are not committed to Git.
2. Production secrets live only in Railway/service variables.
3. User-uploaded files are stored in persistent storage, not temporary container storage.
4. Large file growth is handled by object storage or a mounted production volume.
5. MySQL stores records and file metadata, not large image/document blobs.
6. Admin access is protected and not selectable from public login/register UI.
7. All public endpoints validate role, ownership, and file access.
8. Dashboards use pagination, filtering, and indexed queries.
9. Backups, restore steps, logs, monitoring, and incident response are documented.
10. The system has been tested with admin, owner, seeker, and guest flows before launch.

## Files in this guide

- `01-security-secrets.md`
  - Preventing leaks of `.env`, database passwords, Google secrets, mail secrets, IDs, and payment proofs.

- `02-storage-uploads.md`
  - Best storage plan for thousands of users and many images/documents.

- `03-database-scale.md`
  - Database indexing, pagination, backups, retention, and large-data handling.

- `04-deployment-ops.md`
  - Railway/Docker production setup, environment variables, backups, monitoring, and domains.

- `05-production-checklist.md`
  - Final go-live checklist before real users use the system.

- `06-ai-production-prompt.md`
  - Enhanced prompt for an AI coding session to implement production hardening safely.

## Recommended production architecture

Use this structure first:

1. Railway service: `rentease-frontend`
   - React + Vite build.
   - Public user-facing app.

2. Railway service: `rentease-backend`
   - PHP API.
   - Owns auth, role checks, uploads, private file access, and database access.

3. Railway service: `rentease-mysql`
   - MySQL production database.
   - Stores users, rooms, reservations, payments, activity logs, file metadata, and object keys.

4. Storage:
   - Best long-term: Railway Buckets, Cloudflare R2, AWS S3, or another S3-compatible object storage.
   - Acceptable first deployment: Railway Volume mounted to backend storage.
   - Avoid: storing room photos, valid IDs, payment proofs, and profile photos directly as MySQL BLOBs.

## Production priority order

1. Secrets safety
2. Persistent storage
3. Database backups
4. Upload security
5. Role and ownership checks
6. Query performance
7. Monitoring and logs
8. Load testing
9. User acceptance testing
10. Launch

## Official references

- Railway Storage Buckets: https://docs.railway.com/guides/storage-buckets
- Railway Volumes: https://docs.railway.com/volumes
- Railway Public Networking: https://docs.railway.com/public-networking
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
