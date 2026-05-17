Run the database reset script FIRST before any migration. It clears all user data except the admin account. Back up anything important before running.
Step 0 — Database reset script (run once)
This wipes all seeded/test data and keeps only the real admin account. Run this SQL directly in phpMyAdmin or MySQL CLI before applying new migrations:

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE error_logs;
TRUNCATE TABLE guardian_links;
TRUNCATE TABLE payments;
TRUNCATE TABLE billing_cycles;
TRUNCATE TABLE reservations;
TRUNCATE TABLE room_amenities;
TRUNCATE TABLE rooms;
TRUNCATE TABLE boarding_houses;
DELETE FROM users WHERE role != 'admin';
SET FOREIGN_KEY_CHECKS = 1;
        
After this, only the admin row remains. All new users will register via Google or the real registration form.

Modify users table — 3 new columns
google_id VARCHAR(100) NULL UNIQUE avatar_url VARCHAR(500) NULL auth_provider ENUM('local','google') DEFAULT 'local'
google_id — Google's unique sub ID for the user. Unique so a Google account can only be linked once.
avatar_url — Google profile photo URL, stored and used as default avatar.
auth_provider — distinguishes Google users from local password users. Drives the "forgot password" guard

New table: password_reset_tokens
id BIGINT PK AUTO_INCREMENT email VARCHAR(150) NOT NULL token VARCHAR(64) NOT NULL UNIQUE expires_at TIMESTAMP NOT NULL created_at TIMESTAMP DEFAULT NOW()
One record per reset request. Token expires in 60 minutes. Deleted immediately after successful password reset. Only one active token per email (previous ones replaced on new request).
New table: remember_tokens
id BIGINT PK AUTO_INCREMENT user_id BIGINT FK users.id ON DELETE CASCADE token_hash VARCHAR(128) NOT NULL UNIQUE expires_at TIMESTAMP NOT NULL created_at TIMESTAMP DEFAULT NOW()
Token is stored as a SHA-256 hash (never the raw value). Cookie contains the raw token. On validation: hash the cookie value, compare to DB. Rotate on every use (delete old, issue new). Expires in 30 days.
