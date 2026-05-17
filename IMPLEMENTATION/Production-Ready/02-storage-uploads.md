# 02 - Storage and Uploads

Goal: prevent storage from becoming too big or unsafe when thousands of users upload images and documents.

## Current RentEase storage usage

The backend currently stores uploaded files under `backend/storage`.

Known folders:

- `storage/public/rooms`
  - Room photos.

- `storage/public/boarding_houses`
  - Boarding house cover photos.

- `storage/profiles`
  - User profile photos.

- `storage/private/ids`
  - Valid ID uploads.

- `storage/private/proofs`
  - Payment proof uploads.

- `storage/uploads`
  - General user/reservation uploads.

This folder is important. It contains user-generated files, not disposable cache.

## Should images go in the database?

Recommendation: no.

Do not store many images and documents directly in MySQL as BLOBs.

Better pattern:

- Store files in object storage or a persistent volume.
- Store only metadata in MySQL:
  - file ID
  - owner user ID
  - related room/reservation/payment ID
  - storage key/path
  - MIME type
  - file size
  - visibility
  - created date
  - checksum/hash

Why this is better:

- Database backups stay smaller.
- Image delivery is faster.
- Database queries stay focused on relational data.
- File storage can scale separately.
- Private files can still be protected through backend authorization.

## Best production storage plan

Use S3-compatible object storage:

- Railway Buckets
- Cloudflare R2
- AWS S3
- DigitalOcean Spaces

Recommended object key layout:

```text
public/rooms/{room_id}/{file_id}.webp
public/boarding-houses/{owner_id}/{file_id}.webp
profiles/{user_id}/{file_id}.webp
private/ids/{user_id}/{file_id}.{ext}
private/payment-proofs/{payment_id}/{file_id}.{ext}
private/uploads/{user_id}/{file_id}.{ext}
```

Public files can be served through generated URLs or a CDN.

Private files should be served through:

- backend proxy after role/ownership check, or
- short-lived signed URLs after role/ownership check

## Acceptable first Railway deployment

If object storage is not implemented yet, use a Railway Volume mounted to the backend storage directory.

Important:

- Without a volume, container filesystem uploads can disappear after redeploys.
- A Railway Volume is persistent storage attached to a service.
- This is acceptable for the first production version, but object storage is better long-term.

Suggested mount path:

```text
/var/www/html/storage
```

Use the mount path that matches where the PHP backend reads and writes files in production.

## File size rules

Current backend limits appear conservative:

- Room photos: 2 MB per photo
- Boarding house cover photo: 3 MB
- Valid IDs/payment proofs/general uploads: 5 MB

Keep limits. Do not allow unlimited uploads.

Production target:

- Profile image: max 1 MB after compression
- Room photos: max 1 to 2 MB each after compression
- Payment proof: max 5 MB
- Valid ID: max 5 MB
- General document: max 5 MB

## Image optimization rules

Before storing public images:

1. Resize large images.
2. Convert to WebP where possible.
3. Generate thumbnails for listings.
4. Keep original only if business needs it.
5. Strip EXIF metadata to remove hidden location/device data.

Recommended sizes:

- Room card thumbnail: 640px wide
- Room detail gallery: 1200px to 1600px wide
- Boarding house cover: 1600px wide
- Profile avatar: 256px to 512px square

## Upload validation rules

Follow these checks:

1. Validate MIME type server-side.
2. Validate extension against allowed types.
3. Validate file size.
4. Generate server-side filenames.
5. Never trust original filenames.
6. Store private files outside public static folders.
7. Block executable files.
8. For images, verify actual image content.
9. For PDFs, consider virus/malware scanning before production scale.

Current backend already uses MIME validation and generated names in `store_uploaded_file`. Keep that pattern.

## Database metadata table recommendation

Use one normalized `uploads` table for all files.

Suggested fields:

```sql
id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT
user_id BIGINT UNSIGNED NOT NULL
related_type ENUM('profile','room','boarding_house','reservation','payment','valid_id','other') NOT NULL
related_id BIGINT UNSIGNED NULL
storage_provider ENUM('local','railway_volume','s3') NOT NULL
storage_key VARCHAR(700) NOT NULL
original_name VARCHAR(255) NULL
mime_type VARCHAR(120) NOT NULL
file_size BIGINT UNSIGNED NOT NULL
checksum_sha256 CHAR(64) NULL
visibility ENUM('public','private','owner','admin') NOT NULL DEFAULT 'private'
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
deleted_at TIMESTAMP NULL
```

Then feature tables can reference upload IDs instead of storing raw paths everywhere.

## Cleanup and retention

Without cleanup, storage will grow forever.

Rules:

- Delete replaced profile photos after the new one is saved.
- Delete old room photos when owner removes them.
- Soft-delete metadata first, then physically delete file after a grace period.
- Run a scheduled cleanup for orphan files.
- Keep payment proofs and valid IDs only as long as business/legal requirements need them.

Suggested retention:

- Orphan temporary uploads: delete after 24 hours.
- Replaced profile photos: delete after 7 days.
- Rejected/expired reservation documents: delete after 30 to 90 days.
- Payment proofs: keep based on accounting policy.
- Valid IDs: minimize retention. Delete when verification no longer requires them.

## Storage scaling path

Phase 1: current local Docker development

- Keep `backend/storage` for local testing.
- Keep it gitignored.

Phase 2: first Railway deployment

- Use Railway Volume mounted to backend storage.
- Keep MySQL file paths/metadata.
- Add backups.

Phase 3: real production scale

- Move uploads to Railway Buckets/S3-compatible storage.
- Store object keys in MySQL.
- Use signed URLs or backend proxy for private files.
- Add image compression and thumbnails.
- Add cleanup jobs.

Phase 4: large-scale production

- Put public images behind CDN.
- Add background workers for image processing.
- Add malware scanning for PDFs/images.
- Add object lifecycle/retention policy.

## Storage implementation prompt

```text
Act as a Senior Full Stack Developer and Cloud Storage Architect for RentEase.

Current system:
- PHP backend stores uploads in backend/storage.
- MySQL stores file paths and related records.
- Files include room photos, boarding house covers, profile photos, valid IDs, payment proofs, and general uploads.

Goal:
Make file storage production-ready for thousands of users.

Implement this safely:
1. Keep local backend/storage workflow for Docker development.
2. Add a storage abstraction that supports local storage and S3-compatible object storage.
3. Use environment variables to select STORAGE_DRIVER=local or STORAGE_DRIVER=s3.
4. Store file metadata in MySQL.
5. Do not store large images/documents as MySQL BLOBs.
6. Compress/resize public images before storing.
7. Keep private files protected by backend authorization or signed URLs.
8. Add cleanup for replaced/orphaned files.
9. Preserve existing API behavior where possible.

Output:
- Changed files
- New env variables
- Migration SQL
- Manual migration plan from local storage to object storage
- Testing checklist for admin, owner, seeker, public room browsing, payment proof, and valid ID access
```
