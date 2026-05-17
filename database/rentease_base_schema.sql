-- RentEase base schema for a fresh local/staging database.
-- Import this first, then import database/staging_seed.sql.

SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS users (
    user_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NULL,
    role ENUM('seeker', 'parent', 'owner', 'admin') NOT NULL,
    contact_number VARCHAR(30) NOT NULL,
    account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    profile_photo VARCHAR(255) NULL,
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_number VARCHAR(20) NULL,
    school_or_workplace VARCHAR(150) NULL,
    deactivation_reason TEXT NULL,
    deactivated_by INT UNSIGNED NULL,
    deactivated_at DATETIME NULL,
    last_login_at DATETIME NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 1,
    google_id VARCHAR(255) NULL,
    profile_picture TEXT NULL,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role_status (role, account_status),
    UNIQUE KEY uq_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS boarding_house (
    boarding_house_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_id INT UNSIGNED NOT NULL,
    house_name VARCHAR(150) NOT NULL,
    property_type VARCHAR(30) NOT NULL DEFAULT 'boarding_house',
    address VARCHAR(255) NOT NULL,
    description TEXT NULL,
    house_rules TEXT NULL,
    cover_photo VARCHAR(255) NULL,
    contact_number VARCHAR(20) NULL,
    facebook_page VARCHAR(255) NULL,
    amenities_list JSON NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    location_label VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (boarding_house_id),
    UNIQUE KEY uq_boarding_house_owner (owner_id),
    KEY idx_boarding_house_location (latitude, longitude),
    CONSTRAINT fk_boarding_house_owner
        FOREIGN KEY (owner_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rooms (
    room_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    boarding_house_id INT UNSIGNED NOT NULL,
    room_number VARCHAR(30) NOT NULL,
    room_type VARCHAR(80) NOT NULL,
    capacity INT UNSIGNED NOT NULL,
    monthly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amenities TEXT NULL,
    availability_status ENUM('available', 'unavailable', 'occupied', 'archived') NOT NULL DEFAULT 'available',
    photos JSON NULL,
    floor_number TINYINT NULL,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    PRIMARY KEY (room_id),
    UNIQUE KEY uq_rooms_boarding_room_number (boarding_house_id, room_number),
    KEY idx_rooms_boarding_status (boarding_house_id, availability_status),
    CONSTRAINT fk_rooms_boarding_house
        FOREIGN KEY (boarding_house_id)
        REFERENCES boarding_house (boarding_house_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    room_id INT UNSIGNED NOT NULL,
    date_submitted DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    move_in_date DATE NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    remarks TEXT NULL,
    valid_id_path VARCHAR(255) NULL,
    cancellation_reason TEXT NULL,
    cancelled_at DATETIME NULL,
    rejection_remarks TEXT NULL,
    PRIMARY KEY (reservation_id),
    KEY idx_reservations_user_status (user_id, status),
    KEY idx_reservations_room_status (room_id, status),
    CONSTRAINT fk_reservations_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_reservations_room
        FOREIGN KEY (room_id)
        REFERENCES rooms (room_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NULL,
    action_performed VARCHAR(255) NOT NULL,
    affected_module VARCHAR(80) NOT NULL,
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    guardian_link_id INT(10) UNSIGNED NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
    PRIMARY KEY (log_id),
    KEY idx_activity_logs_user_ts (user_id, `timestamp`),
    KEY idx_activity_logs_module_ts (affected_module, `timestamp`),
    KEY idx_activity_logs_severity (severity),
    KEY idx_activity_logs_module (affected_module),
    CONSTRAINT fk_activity_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS error_logs (
    error_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    error_code VARCHAR(50) NOT NULL,
    error_message VARCHAR(1000) NOT NULL,
    affected_user_id INT UNSIGNED NULL,
    `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stack_trace LONGTEXT NULL,
    request_url VARCHAR(500) NULL,
    request_method VARCHAR(10) NULL,
    is_resolved TINYINT(1) NOT NULL DEFAULT 0,
    resolved_by INT UNSIGNED NULL,
    resolved_at DATETIME NULL,
    resolution_notes TEXT NULL,
    PRIMARY KEY (error_id),
    KEY idx_error_logs_code_ts (error_code, `timestamp`),
    KEY idx_error_logs_user_ts (affected_user_id, `timestamp`),
    KEY idx_error_logs_resolved (is_resolved),
    KEY idx_error_logs_timestamp (`timestamp`),
    KEY idx_error_logs_resolved_by (resolved_by),
    CONSTRAINT fk_error_logs_user
        FOREIGN KEY (affected_user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT fk_error_logs_resolved_by
        FOREIGN KEY (resolved_by)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_configs (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT NOT NULL,
    config_group VARCHAR(50) NOT NULL DEFAULT 'general',
    label VARCHAR(150) NOT NULL,
    description TEXT NULL,
    is_readonly TINYINT(1) NOT NULL DEFAULT 0,
    updated_by INT UNSIGNED NULL,
    updated_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_system_configs_key (config_key),
    KEY idx_system_configs_group (config_group),
    KEY idx_system_configs_updated_by (updated_by),
    CONSTRAINT fk_system_configs_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    reservation_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (feedback_id),
    UNIQUE KEY uq_feedback_user_reservation (user_id, reservation_id),
    KEY idx_feedback_reservation (reservation_id),
    KEY idx_feedback_status_created (status, created_at),
    CONSTRAINT fk_feedback_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_feedback_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES reservations (reservation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_feedback_rating
        CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploads (
    upload_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT(10) UNSIGNED NOT NULL,
    reservation_id INT(10) UNSIGNED NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size INT UNSIGNED NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    visibility ENUM('private', 'owner', 'admin') NOT NULL DEFAULT 'owner',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uploads_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_uploads_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES reservations (reservation_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    INDEX idx_uploads_user (user_id),
    INDEX idx_uploads_reservation (reservation_id),
    INDEX idx_uploads_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id INT(10) UNSIGNED NOT NULL,
    boarding_house_id INT(10) UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general',
    image_path VARCHAR(255) NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    expires_at DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL DEFAULT NULL,
    CONSTRAINT fk_announcements_owner
        FOREIGN KEY (owner_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_announcements_boarding_house
        FOREIGN KEY (boarding_house_id)
        REFERENCES boarding_house (boarding_house_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_announcements_owner_created (owner_id, created_at),
    INDEX idx_announcements_house_visible (boarding_house_id, is_visible, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id INT(10) UNSIGNED NOT NULL,
    user_id INT(10) UNSIGNED NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (announcement_id, user_id),
    CONSTRAINT fk_announcement_reads_announcement
        FOREIGN KEY (announcement_id)
        REFERENCES announcements (announcement_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_announcement_reads_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_announcement_reads_user (user_id, read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_password_reset_token_hash (token_hash),
    KEY idx_password_reset_email (email),
    KEY idx_password_reset_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS remember_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_remember_token_hash (token_hash),
    KEY idx_remember_user (user_id),
    KEY idx_remember_expires (expires_at),
    CONSTRAINT fk_remember_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_seeker_links (
    link_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parent_user_id INT(10) UNSIGNED NOT NULL,
    seeker_user_id INT(10) UNSIGNED NOT NULL,
    requested_by ENUM('parent', 'seeker') NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    notes VARCHAR(255) NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_psl_parent_user
        FOREIGN KEY (parent_user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_psl_seeker_user
        FOREIGN KEY (seeker_user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    UNIQUE KEY uq_psl_pair (parent_user_id, seeker_user_id),
    INDEX idx_psl_parent_status (parent_user_id, status),
    INDEX idx_psl_seeker_status (seeker_user_id, status),
    INDEX idx_psl_status_requested (status, requested_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_amenities (
    room_amenity_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id INT(10) UNSIGNED NOT NULL,
    amenity_name VARCHAR(80) NOT NULL,
    amenity_icon VARCHAR(50) NULL,
    sort_order TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_room_amenities_room
        FOREIGN KEY (room_id)
        REFERENCES rooms (room_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_room_amenities_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_cycles (
    billing_cycle_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT(10) UNSIGNED NOT NULL,
    user_id INT(10) UNSIGNED NOT NULL,
    room_id INT(10) UNSIGNED NOT NULL,
    billing_month CHAR(7) NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    due_date DATE NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT(10) UNSIGNED NOT NULL,
    CONSTRAINT fk_billing_cycles_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES reservations (reservation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_billing_cycles_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_billing_cycles_room
        FOREIGN KEY (room_id)
        REFERENCES rooms (room_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_billing_cycles_created_by
        FOREIGN KEY (created_by)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    UNIQUE KEY uq_billing_cycles_reservation_month (reservation_id, billing_month),
    INDEX idx_billing_cycles_month (billing_month),
    INDEX idx_billing_cycles_user (user_id),
    INDEX idx_billing_cycles_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    payment_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reservation_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    room_id INT UNSIGNED NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('paid', 'unpaid', 'pending_verification') NOT NULL DEFAULT 'unpaid',
    payment_date DATE NULL,
    billing_period CHAR(7) NOT NULL,
    recorded_by INT UNSIGNED NOT NULL,
    proof_of_payment_path VARCHAR(255) NULL,
    notes TEXT NULL,
    billing_cycle_id INT(10) UNSIGNED NULL,
    payment_method ENUM('cash','gcash','bank_transfer','other') NULL DEFAULT 'cash',
    received_by INT(10) UNSIGNED NULL,
    PRIMARY KEY (payment_id),
    KEY idx_payments_status_date (payment_status, payment_date),
    KEY idx_payments_user (user_id),
    KEY idx_payments_room (room_id),
    KEY idx_payments_recorded_by (recorded_by),
    KEY idx_payments_billing_cycle (billing_cycle_id),
    CONSTRAINT fk_payments_reservation
        FOREIGN KEY (reservation_id)
        REFERENCES reservations (reservation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_payments_user
        FOREIGN KEY (user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_payments_room
        FOREIGN KEY (room_id)
        REFERENCES rooms (room_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_payments_recorded_by
        FOREIGN KEY (recorded_by)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_billing_cycle
        FOREIGN KEY (billing_cycle_id)
        REFERENCES billing_cycles (billing_cycle_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guardian_links (
    guardian_link_id INT(10) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_user_id INT(10) UNSIGNED NOT NULL,
    guardian_name VARCHAR(100) NOT NULL,
    guardian_email VARCHAR(150) NOT NULL,
    access_token CHAR(36) NOT NULL,
    status ENUM('pending', 'active', 'revoked') NOT NULL DEFAULT 'active',
    last_accessed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_guardian_links_tenant
        FOREIGN KEY (tenant_user_id)
        REFERENCES users (user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    UNIQUE KEY uq_guardian_links_access_token (access_token),
    INDEX idx_guardian_links_tenant (tenant_user_id),
    INDEX idx_guardian_links_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
