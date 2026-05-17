<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
ensure_admin_schema();
$method = request_method();

try {
    $actor = require_auth();
    $payload = in_array($method, ['POST', 'PUT', 'PATCH'], true) ? request_payload() : [];
    $action = request_action($payload);

    if ($method === 'GET') {
        handle_users_get($actor);
    }

    if ($method === 'POST') {
        if ($action === 'deactivate') {
            handle_users_deactivate($actor, $payload);
        }
        if ($action === 'reactivate') {
            handle_users_reactivate($actor, $payload);
        }
        if ($action === 'change_role' || $action === 'change-role') {
            handle_users_change_role($actor, $payload);
        }
        if ($action === 'reset_password' || $action === 'reset-password') {
            handle_users_reset_password($actor);
        }

        handle_users_create($actor, $payload);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        handle_users_update($actor, $payload);
    }

    if ($method === 'DELETE') {
        handle_users_delete($actor);
    }
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Users request failed', $user ? (int)$user['user_id'] : null);
}

function handle_users_get(array $actor): void
{
    $targetUserId = parse_positive_int($_GET['user_id'] ?? null);

    if ($actor['role'] !== 'admin') {
        $selfId = (int)$actor['user_id'];
        if ($targetUserId !== null && $targetUserId !== $selfId) {
            json_response(false, 'Forbidden.', new stdClass(), ['You can only access your own user profile.'], 403);
        }

        $user = find_user_by_id($selfId);
        if (!$user) {
            json_response(false, 'User not found.', new stdClass(), [], 404);
        }

        json_response(true, 'User profile fetched successfully.', sanitize_user($user), []);
    }

    if ($targetUserId !== null) {
        $user = find_user_by_id($targetUserId);
        if (!$user) {
            json_response(false, 'User not found.', new stdClass(), [], 404);
        }

        $profile = sanitize_user($user);
        $profile['activity_logs'] = admin_user_activity($targetUserId);
        $profile['boarding_house'] = $user['role'] === 'owner' ? admin_user_boarding_house($targetUserId) : null;
        $profile['active_reservation'] = $user['role'] === 'seeker' ? admin_user_active_reservation($targetUserId) : null;

        if ((int)$actor['user_id'] !== $targetUserId) {
            log_activity((int)$actor['user_id'], "Viewed user profile #{$targetUserId}", 'users', 'warning');
        }

        json_response(true, 'User fetched successfully.', $profile, []);
    }

    $conditions = [];
    $params = [];

    $role = strtolower(trim((string)($_GET['role'] ?? '')));
    if ($role !== '') {
        $conditions[] = 'role = :role';
        $params[':role'] = $role;
    }

    $accountStatus = strtolower(trim((string)($_GET['account_status'] ?? '')));
    if ($accountStatus !== '') {
        $conditions[] = 'account_status = :account_status';
        $params[':account_status'] = $accountStatus;
    }

    $statusAlias = strtolower(trim((string)($_GET['status'] ?? '')));
    if ($accountStatus === '' && $statusAlias !== '') {
        if (!in_array($statusAlias, ['active', 'inactive'], true)) {
            json_response(false, 'Validation failed.', new stdClass(), ['status must be active or inactive.'], 400);
        }
        $conditions[] = 'account_status = :status_alias';
        $params[':status_alias'] = $statusAlias;
    }

    $search = trim((string)($_GET['search'] ?? ''));
    if ($search !== '') {
        $conditions[] = '(full_name LIKE :search OR email LIKE :search OR contact_number LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    $limit = parse_limit_param($_GET['limit'] ?? null, 20, 100);
    $page = parse_page_param($_GET['page'] ?? null);
    $offset = ($page - 1) * $limit;

    $countSql = 'SELECT COUNT(*) FROM users';
    if (!empty($conditions)) {
        $countSql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $countQuery = db()->prepare($countSql);
    $countQuery->execute($params);
    $total = (int)$countQuery->fetchColumn();
    $totalPages = $total > 0 ? (int)ceil($total / $limit) : 0;

    $sql = 'SELECT * FROM users';
    if (!empty($conditions)) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY user_id DESC LIMIT :limit OFFSET :offset';

    $query = db()->prepare($sql);
    foreach ($params as $key => $value) {
        $query->bindValue($key, $value);
    }
    $query->bindValue(':limit', $limit, PDO::PARAM_INT);
    $query->bindValue(':offset', $offset, PDO::PARAM_INT);
    $query->execute();
    $rows = $query->fetchAll();

    $sanitized = array_map('sanitize_user', $rows);
    json_response(
        true,
        'Users fetched successfully.',
        [
            'items' => $sanitized,
            'meta' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => $totalPages,
            ],
        ],
        []
    );
}

function handle_users_create(array $actor, array $payload): void
{
    if ($actor['role'] !== 'admin') {
        json_response(false, 'Forbidden.', new stdClass(), ['Only admin can create user accounts from this endpoint.'], 403);
    }

    require_fields($payload, ['full_name', 'email', 'password', 'role', 'contact_number']);

    $fullName = trim((string)$payload['full_name']);
    $email = strtolower(trim((string)$payload['email']));
    $password = (string)$payload['password'];
    $role = strtolower(trim((string)$payload['role']));
    $contactNumber = trim((string)$payload['contact_number']);
    $accountStatus = strtolower(trim((string)($payload['account_status'] ?? 'active')));

    $errors = [];
    if ($fullName === '') {
        $errors[] = 'full_name is required.';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'email must be a valid email address.';
    }
    if (strlen($password) < 8) {
        $errors[] = 'password must be at least 8 characters.';
    }
    if (!in_array($role, ALL_ROLES, true)) {
        $errors[] = 'role must be seeker, parent, owner, or admin.';
    }
    if ($contactNumber === '') {
        $errors[] = 'contact_number is required.';
    }
    if (!in_array($accountStatus, ['active', 'inactive'], true)) {
        $errors[] = 'account_status must be active or inactive.';
    }
    if (!empty($errors)) {
        json_response(false, 'Validation failed.', new stdClass(), $errors, 400);
    }

    $existing = db()->prepare('SELECT user_id FROM users WHERE email = :email LIMIT 1');
    $existing->execute([':email' => $email]);
    if ($existing->fetch()) {
        json_response(false, 'Validation failed.', new stdClass(), ['email is already registered.'], 400);
    }

    $insert = db()->prepare(
        'INSERT INTO users (full_name, email, password_hash, role, contact_number, account_status, created_at)
         VALUES (:full_name, :email, :password_hash, :role, :contact_number, :account_status, NOW())'
    );
    $insert->execute([
        ':full_name' => $fullName,
        ':email' => $email,
        ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ':role' => $role,
        ':contact_number' => $contactNumber,
        ':account_status' => $accountStatus,
    ]);

    $newId = (int)db()->lastInsertId();
    log_activity((int)$actor['user_id'], "Created user #{$newId}", 'users');

    $user = find_user_by_id($newId);
    json_response(true, 'User created successfully.', sanitize_user($user ?? ['user_id' => $newId]), [], 201);
}

function handle_users_update(array $actor, array $payload): void
{
    $targetUserId = parse_positive_int($_GET['user_id'] ?? ($payload['user_id'] ?? null));
    if ($targetUserId === null) {
        $targetUserId = (int)$actor['user_id'];
    }

    $isAdmin = $actor['role'] === 'admin';
    if (!$isAdmin && $targetUserId !== (int)$actor['user_id']) {
        json_response(false, 'Forbidden.', new stdClass(), ['You can only update your own account.'], 403);
    }

    $existing = find_user_by_id($targetUserId);
    if (!$existing) {
        json_response(false, 'User not found.', new stdClass(), [], 404);
    }

    $updates = [];
    $params = [':user_id' => $targetUserId];

    if (array_key_exists('full_name', $payload)) {
        $updates[] = 'full_name = :full_name';
        $params[':full_name'] = trim((string)$payload['full_name']);
    }
    if (array_key_exists('email', $payload)) {
        $email = strtolower(trim((string)$payload['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_response(false, 'Validation failed.', new stdClass(), ['email must be a valid email address.'], 400);
        }

        $duplicateQuery = db()->prepare('SELECT user_id FROM users WHERE email = :email AND user_id <> :user_id LIMIT 1');
        $duplicateQuery->execute([':email' => $email, ':user_id' => $targetUserId]);
        if ($duplicateQuery->fetch()) {
            json_response(false, 'Validation failed.', new stdClass(), ['email is already in use by another account.'], 400);
        }

        $updates[] = 'email = :email';
        $params[':email'] = $email;
    }
    if (array_key_exists('password', $payload)) {
        $password = (string)$payload['password'];
        if (strlen($password) < 8) {
            json_response(false, 'Validation failed.', new stdClass(), ['password must be at least 8 characters.'], 400);
        }

        $updates[] = 'password_hash = :password_hash';
        $params[':password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }
    if (array_key_exists('contact_number', $payload)) {
        $updates[] = 'contact_number = :contact_number';
        $params[':contact_number'] = trim((string)$payload['contact_number']);
    }

    if ($isAdmin && array_key_exists('role', $payload)) {
        if ($targetUserId === (int)$actor['user_id']) {
            json_response(false, 'Forbidden.', new stdClass(), ['Admin cannot change their own role.'], 403);
        }
        $role = strtolower(trim((string)$payload['role']));
        if (!in_array($role, ALL_ROLES, true)) {
            json_response(false, 'Validation failed.', new stdClass(), ['role must be seeker, parent, owner, or admin.'], 400);
        }
        if ($role === 'admin' && trim((string)($payload['confirmation_code'] ?? '')) !== 'CONFIRM') {
            json_response(false, 'Validation failed.', new stdClass(), ['confirmation_code must be CONFIRM when granting admin access.'], 400);
        }
        $updates[] = 'role = :role';
        $params[':role'] = $role;
    } elseif (!$isAdmin && array_key_exists('role', $payload)) {
        json_response(false, 'Forbidden.', new stdClass(), ['Only admin can update user roles.'], 403);
    }

    if ($isAdmin && array_key_exists('account_status', $payload)) {
        if ($targetUserId === (int)$actor['user_id'] && strtolower(trim((string)$payload['account_status'])) === 'inactive') {
            json_response(false, 'Forbidden.', new stdClass(), ['Admin cannot deactivate their own account.'], 403);
        }
        $accountStatus = strtolower(trim((string)$payload['account_status']));
        if (!in_array($accountStatus, ['active', 'inactive'], true)) {
            json_response(false, 'Validation failed.', new stdClass(), ['account_status must be active or inactive.'], 400);
        }
        $updates[] = 'account_status = :account_status';
        $params[':account_status'] = $accountStatus;
    } elseif (!$isAdmin && array_key_exists('account_status', $payload)) {
        json_response(false, 'Forbidden.', new stdClass(), ['Only admin can update account_status.'], 403);
    }

    if (empty($updates)) {
        json_response(false, 'Validation failed.', new stdClass(), ['No updatable fields provided.'], 400);
    }

    $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE user_id = :user_id';
    $update = db()->prepare($sql);
    $update->execute($params);

    log_activity((int)$actor['user_id'], "Updated user #{$targetUserId}", 'users');

    $user = find_user_by_id($targetUserId);
    if (!$user) {
        json_response(false, 'User not found after update.', new stdClass(), [], 404);
    }

    if ($targetUserId === (int)$actor['user_id']) {
        current_user(true);
    }

    json_response(true, 'User updated successfully.', sanitize_user($user), []);
}

function handle_users_delete(array $actor): void
{
    if ($actor['role'] !== 'admin') {
        json_response(false, 'Forbidden.', new stdClass(), ['Only admin can deactivate users.'], 403);
    }

    $targetUserId = parse_positive_int($_GET['user_id'] ?? null);
    if ($targetUserId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['user_id is required.'], 400);
    }

    if ($targetUserId === (int)$actor['user_id']) {
        json_response(false, 'Validation failed.', new stdClass(), ['Admin cannot deactivate their own account from this endpoint.'], 400);
    }

    $existing = find_user_by_id($targetUserId);
    if (!$existing) {
        json_response(false, 'User not found.', new stdClass(), [], 404);
    }

    if (($existing['role'] ?? '') === 'admin') {
        json_response(false, 'Forbidden.', new stdClass(), ['Admin accounts cannot be deactivated by another admin.'], 403);
    }

    $update = db()->prepare(
        'UPDATE users
         SET account_status = :account_status,
             deactivation_reason = :deactivation_reason,
             deactivated_by = :deactivated_by,
             deactivated_at = NOW()
         WHERE user_id = :user_id'
    );
    $update->execute([
        ':account_status' => 'inactive',
        ':deactivation_reason' => 'Administrative deactivation.',
        ':deactivated_by' => (int)$actor['user_id'],
        ':user_id' => $targetUserId,
    ]);

    log_activity((int)$actor['user_id'], "Deactivated user #{$targetUserId}", 'users', 'critical');
    json_response(true, 'User deactivated successfully.', new stdClass(), []);
}

function admin_require_target_user(array $actor, ?int $targetUserId = null): array
{
    if ($actor['role'] !== 'admin') {
        json_response(false, 'Forbidden.', new stdClass(), ['Only admin can perform this action.'], 403);
    }

    $targetUserId = $targetUserId ?? parse_positive_int($_GET['user_id'] ?? null);
    if ($targetUserId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['user_id is required.'], 400);
    }

    $user = find_user_by_id($targetUserId);
    if (!$user) {
        json_response(false, 'User not found.', new stdClass(), [], 404);
    }

    return $user;
}

function handle_users_deactivate(array $actor, array $payload): void
{
    $targetUserId = parse_positive_int($_GET['user_id'] ?? ($payload['user_id'] ?? null));
    $user = admin_require_target_user($actor, $targetUserId);
    $targetUserId = (int)$user['user_id'];

    if ($targetUserId === (int)$actor['user_id']) {
        json_response(false, 'Forbidden.', new stdClass(), ['Admin cannot deactivate their own account.'], 403);
    }
    if (($user['role'] ?? '') === 'admin') {
        json_response(false, 'Forbidden.', new stdClass(), ['Admin accounts cannot be deactivated by another admin.'], 403);
    }

    $reason = trim((string)($payload['deactivation_reason'] ?? $payload['reason'] ?? ''));
    if (strlen($reason) < 10 || strlen($reason) > 500) {
        json_response(false, 'Validation failed.', new stdClass(), ['deactivation_reason must be 10 to 500 characters.'], 400);
    }

    $update = db()->prepare(
        'UPDATE users
         SET account_status = :status,
             deactivation_reason = :reason,
             deactivated_by = :deactivated_by,
             deactivated_at = NOW()
         WHERE user_id = :user_id'
    );
    $update->execute([
        ':status' => 'inactive',
        ':reason' => $reason,
        ':deactivated_by' => (int)$actor['user_id'],
        ':user_id' => $targetUserId,
    ]);

    log_activity((int)$actor['user_id'], "Deactivated account of {$user['full_name']} - {$reason}", 'users', 'critical');
    json_response(true, 'User deactivated successfully.', sanitize_user(find_user_by_id($targetUserId) ?: $user), []);
}

function handle_users_reactivate(array $actor, array $payload): void
{
    $targetUserId = parse_positive_int($_GET['user_id'] ?? ($payload['user_id'] ?? null));
    $user = admin_require_target_user($actor, $targetUserId);
    $note = trim((string)($payload['reactivation_note'] ?? ''));
    if (strlen($note) > 300) {
        json_response(false, 'Validation failed.', new stdClass(), ['reactivation_note cannot exceed 300 characters.'], 400);
    }

    $update = db()->prepare(
        'UPDATE users
         SET account_status = :status,
             deactivation_reason = NULL,
             deactivated_by = NULL,
             deactivated_at = NULL
         WHERE user_id = :user_id'
    );
    $update->execute([
        ':status' => 'active',
        ':user_id' => (int)$user['user_id'],
    ]);

    log_activity((int)$actor['user_id'], "Reactivated account of {$user['full_name']}", 'users', 'warning');
    json_response(true, 'User reactivated successfully.', sanitize_user(find_user_by_id((int)$user['user_id']) ?: $user), []);
}

function handle_users_change_role(array $actor, array $payload): void
{
    $targetUserId = parse_positive_int($_GET['user_id'] ?? ($payload['user_id'] ?? null));
    $user = admin_require_target_user($actor, $targetUserId);
    $targetUserId = (int)$user['user_id'];

    if ($targetUserId === (int)$actor['user_id']) {
        json_response(false, 'Forbidden.', new stdClass(), ['Admin cannot change their own role.'], 403);
    }

    $newRole = strtolower(trim((string)($payload['role'] ?? '')));
    if (!in_array($newRole, ALL_ROLES, true)) {
        json_response(false, 'Validation failed.', new stdClass(), ['role must be seeker, parent, owner, or admin.'], 400);
    }
    if ($newRole === 'admin' && trim((string)($payload['confirmation_code'] ?? '')) !== 'CONFIRM') {
        json_response(false, 'Validation failed.', new stdClass(), ['confirmation_code must be CONFIRM when granting admin access.'], 400);
    }

    $oldRole = (string)$user['role'];
    $update = db()->prepare('UPDATE users SET role = :role WHERE user_id = :user_id');
    $update->execute([
        ':role' => $newRole,
        ':user_id' => $targetUserId,
    ]);

    log_activity((int)$actor['user_id'], "Changed role of {$user['full_name']} from {$oldRole} to {$newRole}", 'users', 'critical');
    json_response(true, 'User role changed successfully.', sanitize_user(find_user_by_id($targetUserId) ?: $user), []);
}

function handle_users_reset_password(array $actor): void
{
    $user = admin_require_target_user($actor);
    $targetUserId = (int)$user['user_id'];
    if ($targetUserId === (int)$actor['user_id']) {
        json_response(false, 'Forbidden.', new stdClass(), ['Use account settings to change your own password.'], 403);
    }

    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    $tempPassword = '';
    for ($index = 0; $index < 12; $index++) {
        $tempPassword .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }

    $update = db()->prepare('UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id');
    $update->execute([
        ':password_hash' => password_hash($tempPassword, PASSWORD_DEFAULT),
        ':user_id' => $targetUserId,
    ]);

    log_activity((int)$actor['user_id'], "Reset password for {$user['full_name']}", 'users', 'critical');
    json_response(true, 'Temporary password generated successfully.', ['temp_password' => $tempPassword], []);
}

function admin_user_activity(int $userId): array
{
    $query = db()->prepare(
        'SELECT log_id, action_performed, affected_module, severity, ip_address, `timestamp`
         FROM activity_logs
         WHERE user_id = :user_id
         ORDER BY `timestamp` DESC, log_id DESC
         LIMIT 10'
    );
    $query->execute([':user_id' => $userId]);
    return $query->fetchAll();
}

function admin_user_boarding_house(int $userId): ?array
{
    $query = db()->prepare(
        'SELECT boarding_house_id, house_name, address, contact_number, cover_photo
         FROM boarding_house
         WHERE owner_id = :owner_id
         LIMIT 1'
    );
    $query->execute([':owner_id' => $userId]);
    $row = $query->fetch();
    return $row ?: null;
}

function admin_user_active_reservation(int $userId): ?array
{
    $query = db()->prepare(
        'SELECT rv.reservation_id, rv.status, rv.move_in_date, r.room_number, r.room_type, b.house_name
         FROM reservations rv
         INNER JOIN rooms r ON r.room_id = rv.room_id
         INNER JOIN boarding_house b ON b.boarding_house_id = r.boarding_house_id
         WHERE rv.user_id = :user_id
           AND rv.status = :status
         ORDER BY rv.date_submitted DESC
         LIMIT 1'
    );
    $query->execute([
        ':user_id' => $userId,
        ':status' => 'approved',
    ]);
    $row = $query->fetch();
    return $row ?: null;
}
