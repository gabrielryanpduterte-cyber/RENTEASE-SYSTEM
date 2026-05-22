<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
ensure_owner_feature_schema();
ensure_announcement_schema();

$method = request_method();
$payload = in_array($method, ['POST', 'PUT', 'PATCH'], true) ? request_payload() : [];
$action = request_action($payload);

try {
    $actor = require_auth();

    if ($method === 'GET') {
        handle_announcements_get($actor);
    }

    if ($method === 'POST') {
        if ($action === 'mark_read') {
            handle_announcement_mark_read($actor, $payload);
        }
        if ($action === 'mark_all_read') {
            handle_announcement_mark_all_read($actor);
        }
        if ($action === 'toggle_visibility') {
            handle_announcement_toggle_visibility($actor, $payload);
        }
        if ($action === 'update') {
            handle_announcement_update($actor, $payload);
        }

        handle_announcement_create($actor, $payload);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        handle_announcement_update($actor, $payload);
    }

    if ($method === 'DELETE') {
        handle_announcement_delete($actor);
    }
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Announcement request failed', $user ? (int)$user['user_id'] : null);
}

function handle_announcements_get(array $actor): void
{
    if ($actor['role'] === 'seeker') {
        $announcements = fetch_seeker_announcements((int)$actor['user_id'], parse_limit_param($_GET['limit'] ?? 20, 20, 50));

        if (normalize_payload_bool($_GET['include_count'] ?? false)) {
            json_response(
                true,
                'Announcements fetched successfully.',
                [
                    'items' => $announcements,
                    'unread_announcements_count' => count_seeker_unread_announcements((int)$actor['user_id']),
                ],
                []
            );
        }

        json_response(
            true,
            'Announcements fetched successfully.',
            $announcements,
            []
        );
    }

    if (!in_array($actor['role'], ['owner', 'admin'], true)) {
        json_response(false, 'Forbidden.', new stdClass(), ['Only tenants, owners, or admins can view announcements.'], 403);
    }

    $announcementId = parse_positive_int($_GET['announcement_id'] ?? null);
    if ($announcementId !== null) {
        $announcement = find_announcement_for_actor($actor, $announcementId);
        if (!$announcement) {
            json_response(false, 'Announcement not found.', new stdClass(), [], 404);
        }
        json_response(true, 'Announcement fetched successfully.', normalize_announcement_row($announcement), []);
    }

    $conditions = [];
    $params = [];

    if ($actor['role'] === 'owner') {
        $conditions[] = 'b.owner_id = :owner_id';
        $params[':owner_id'] = (int)$actor['user_id'];
    }

    $boardingHouseId = parse_positive_int($_GET['boarding_house_id'] ?? null);
    if ($boardingHouseId !== null) {
        if ($actor['role'] === 'owner' && !owner_owns_boarding_house((int)$actor['user_id'], $boardingHouseId)) {
            json_response(false, 'Forbidden.', new stdClass(), ['You can only view announcements for your own boarding house.'], 403);
        }
        $conditions[] = 'a.boarding_house_id = :boarding_house_id';
        $params[':boarding_house_id'] = $boardingHouseId;
    }

    $visibility = strtolower(trim((string)($_GET['visibility'] ?? '')));
    if ($visibility === 'visible') {
        $conditions[] = 'a.is_visible = 1';
    } elseif ($visibility === 'hidden') {
        $conditions[] = 'a.is_visible = 0';
    }

    $sql = 'SELECT a.*, b.house_name, NULL AS read_at
            FROM announcements a
            INNER JOIN boarding_house b ON b.boarding_house_id = a.boarding_house_id';
    if (!empty($conditions)) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }
    $sql .= ' ORDER BY a.created_at DESC, a.announcement_id DESC';

    $query = db()->prepare($sql);
    $query->execute($params);

    json_response(
        true,
        'Announcements fetched successfully.',
        array_map('normalize_announcement_row', $query->fetchAll()),
        []
    );
}

function handle_announcement_create(array $actor, array $payload): void
{
    require_owner_or_admin($actor);
    require_fields($payload, ['body']);

    $house = resolve_announcement_house($actor, $payload);
    $title = normalize_announcement_title(
        $payload['title'] ?? '',
        next_default_announcement_title((int)$house['boarding_house_id'])
    );
    $body = normalize_announcement_body($payload['body'] ?? '');
    $category = normalize_announcement_category($payload['category'] ?? 'general');
    $expiresAt = normalize_announcement_expiry($payload['expires_at'] ?? null);
    $isVisible = normalize_payload_bool($payload['is_visible'] ?? true) ? 1 : 0;
    $imagePath = store_announcement_image((int)$house['owner_id']);

    $insert = db()->prepare(
        'INSERT INTO announcements (
            owner_id, boarding_house_id, title, body, category, image_path, is_visible, expires_at
         ) VALUES (
            :owner_id, :boarding_house_id, :title, :body, :category, :image_path, :is_visible, :expires_at
         )'
    );
    $insert->execute([
        ':owner_id' => (int)$house['owner_id'],
        ':boarding_house_id' => (int)$house['boarding_house_id'],
        ':title' => $title,
        ':body' => $body,
        ':category' => $category,
        ':image_path' => $imagePath,
        ':is_visible' => $isVisible,
        ':expires_at' => $expiresAt,
    ]);

    $newId = (int)db()->lastInsertId();
    log_activity((int)$actor['user_id'], "Created announcement #{$newId}", 'announcements');

    $created = find_announcement_for_actor($actor, $newId);
    json_response(true, 'Announcement created successfully.', $created ? normalize_announcement_row($created) : ['announcement_id' => $newId], [], 201);
}

function handle_announcement_update(array $actor, array $payload): void
{
    require_owner_or_admin($actor);

    $announcementId = parse_positive_int($_GET['announcement_id'] ?? ($payload['announcement_id'] ?? null));
    if ($announcementId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['announcement_id is required.'], 400);
    }

    $existing = find_announcement_for_actor($actor, $announcementId);
    if (!$existing) {
        json_response(false, 'Announcement not found.', new stdClass(), [], 404);
    }

    $updates = [];
    $params = [':announcement_id' => $announcementId];

    if (array_key_exists('title', $payload)) {
        $updates[] = 'title = :title';
        $params[':title'] = normalize_announcement_title($payload['title'], (string)$existing['title']);
    }
    if (array_key_exists('body', $payload)) {
        $updates[] = 'body = :body';
        $params[':body'] = normalize_announcement_body($payload['body']);
    }
    if (array_key_exists('category', $payload)) {
        $updates[] = 'category = :category';
        $params[':category'] = normalize_announcement_category($payload['category']);
    }
    if (array_key_exists('expires_at', $payload)) {
        $updates[] = 'expires_at = :expires_at';
        $params[':expires_at'] = normalize_announcement_expiry($payload['expires_at']);
    }
    if (array_key_exists('is_visible', $payload)) {
        $updates[] = 'is_visible = :is_visible';
        $params[':is_visible'] = normalize_payload_bool($payload['is_visible']) ? 1 : 0;
    }
    if (isset($_FILES['image']) && is_array($_FILES['image'])) {
        $updates[] = 'image_path = :image_path';
        $params[':image_path'] = store_announcement_image((int)$existing['owner_id']);
    }
    if (normalize_payload_bool($payload['remove_image'] ?? false)) {
        $updates[] = 'image_path = :removed_image_path';
        $params[':removed_image_path'] = null;
    }

    if (empty($updates)) {
        json_response(false, 'Validation failed.', new stdClass(), ['No updatable fields provided.'], 400);
    }

    $updates[] = 'updated_at = NOW()';
    $update = db()->prepare('UPDATE announcements SET ' . implode(', ', $updates) . ' WHERE announcement_id = :announcement_id');
    $update->execute($params);

    log_activity((int)$actor['user_id'], "Updated announcement #{$announcementId}", 'announcements');

    $updated = find_announcement_for_actor($actor, $announcementId);
    json_response(true, 'Announcement updated successfully.', $updated ? normalize_announcement_row($updated) : new stdClass(), []);
}

function handle_announcement_toggle_visibility(array $actor, array $payload): void
{
    require_owner_or_admin($actor);

    $announcementId = parse_positive_int($_GET['announcement_id'] ?? ($payload['announcement_id'] ?? null));
    if ($announcementId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['announcement_id is required.'], 400);
    }

    $existing = find_announcement_for_actor($actor, $announcementId);
    if (!$existing) {
        json_response(false, 'Announcement not found.', new stdClass(), [], 404);
    }

    $nextVisible = array_key_exists('is_visible', $payload)
        ? normalize_payload_bool($payload['is_visible'])
        : !((int)($existing['is_visible'] ?? 0) === 1);

    $update = db()->prepare(
        'UPDATE announcements
         SET is_visible = :is_visible, updated_at = NOW()
         WHERE announcement_id = :announcement_id'
    );
    $update->execute([
        ':is_visible' => $nextVisible ? 1 : 0,
        ':announcement_id' => $announcementId,
    ]);

    log_activity((int)$actor['user_id'], ($nextVisible ? 'Published' : 'Hid') . " announcement #{$announcementId}", 'announcements');

    $updated = find_announcement_for_actor($actor, $announcementId);
    json_response(true, 'Announcement visibility updated.', $updated ? normalize_announcement_row($updated) : new stdClass(), []);
}

function handle_announcement_delete(array $actor): void
{
    require_owner_or_admin($actor);

    $announcementId = parse_positive_int($_GET['announcement_id'] ?? null);
    if ($announcementId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['announcement_id is required.'], 400);
    }

    if (!find_announcement_for_actor($actor, $announcementId)) {
        json_response(false, 'Announcement not found.', new stdClass(), [], 404);
    }

    $delete = db()->prepare('DELETE FROM announcements WHERE announcement_id = :announcement_id');
    $delete->execute([':announcement_id' => $announcementId]);

    log_activity((int)$actor['user_id'], "Deleted announcement #{$announcementId}", 'announcements');
    json_response(true, 'Announcement deleted successfully.', new stdClass(), []);
}

function handle_announcement_mark_read(array $actor, array $payload): void
{
    if ($actor['role'] !== 'seeker') {
        json_response(false, 'Forbidden.', new stdClass(), ['Only tenants can mark announcements as read.'], 403);
    }

    $announcementId = parse_positive_int($_GET['announcement_id'] ?? ($payload['announcement_id'] ?? null));
    if ($announcementId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['announcement_id is required.'], 400);
    }

    if (!seeker_can_access_announcement((int)$actor['user_id'], $announcementId)) {
        json_response(false, 'Announcement not found.', new stdClass(), [], 404);
    }

    $insert = db()->prepare(
        'INSERT INTO announcement_reads (announcement_id, user_id, read_at)
         VALUES (:announcement_id, :user_id, NOW())
         ON DUPLICATE KEY UPDATE read_at = NOW()'
    );
    $insert->execute([
        ':announcement_id' => $announcementId,
        ':user_id' => (int)$actor['user_id'],
    ]);

    json_response(true, 'Announcement marked as read.', [
        'unread_announcements_count' => count_seeker_unread_announcements((int)$actor['user_id']),
    ], []);
}

function handle_announcement_mark_all_read(array $actor): void
{
    if ($actor['role'] !== 'seeker') {
        json_response(false, 'Forbidden.', new stdClass(), ['Only tenants can mark announcements as read.'], 403);
    }

    $query = db()->prepare(
        'INSERT INTO announcement_reads (announcement_id, user_id, read_at)
         SELECT DISTINCT a.announcement_id, :insert_user_id, NOW()
         FROM announcements a
         INNER JOIN boarding_house b ON b.boarding_house_id = a.boarding_house_id
         INNER JOIN rooms r ON r.boarding_house_id = b.boarding_house_id
         INNER JOIN reservations rv ON rv.room_id = r.room_id
         WHERE rv.user_id = :reservation_user_id
           AND rv.status = \'approved\'
           AND a.is_visible = 1
           AND (a.expires_at IS NULL OR a.expires_at >= CURDATE())
         ON DUPLICATE KEY UPDATE read_at = NOW()'
    );
    $query->execute([
        ':insert_user_id' => (int)$actor['user_id'],
        ':reservation_user_id' => (int)$actor['user_id'],
    ]);

    json_response(true, 'Announcements marked as read.', [
        'unread_announcements_count' => count_seeker_unread_announcements((int)$actor['user_id']),
    ], []);
}

function require_owner_or_admin(array $actor): void
{
    if (!in_array($actor['role'], ['owner', 'admin'], true)) {
        json_response(false, 'Forbidden.', new stdClass(), ['Only owner or admin can manage announcements.'], 403);
    }
}

function resolve_announcement_house(array $actor, array $payload): array
{
    if ($actor['role'] === 'owner') {
        $query = db()->prepare(
            'SELECT boarding_house_id, owner_id
             FROM boarding_house
             WHERE owner_id = :owner_id
             ORDER BY boarding_house_id ASC
             LIMIT 1'
        );
        $query->execute([':owner_id' => (int)$actor['user_id']]);
        $house = $query->fetch();
        if (!$house) {
            json_response(false, 'Validation failed.', new stdClass(), ['Create your boarding house profile before posting announcements.'], 400);
        }
        return $house;
    }

    $boardingHouseId = parse_positive_int($payload['boarding_house_id'] ?? null);
    if ($boardingHouseId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['boarding_house_id is required for admin announcements.'], 400);
    }

    $query = db()->prepare(
        'SELECT boarding_house_id, owner_id
         FROM boarding_house
         WHERE boarding_house_id = :boarding_house_id
         LIMIT 1'
    );
    $query->execute([':boarding_house_id' => $boardingHouseId]);
    $house = $query->fetch();
    if (!$house) {
        json_response(false, 'Validation failed.', new stdClass(), ['boarding_house_id does not exist.'], 400);
    }

    return $house;
}

function find_announcement_for_actor(array $actor, int $announcementId): ?array
{
    $conditions = ['a.announcement_id = :announcement_id'];
    $params = [':announcement_id' => $announcementId];

    if ($actor['role'] === 'owner') {
        $conditions[] = 'b.owner_id = :owner_id';
        $params[':owner_id'] = (int)$actor['user_id'];
    }

    $query = db()->prepare(
        'SELECT a.*, b.house_name, NULL AS read_at
         FROM announcements a
         INNER JOIN boarding_house b ON b.boarding_house_id = a.boarding_house_id
         WHERE ' . implode(' AND ', $conditions) . '
         LIMIT 1'
    );
    $query->execute($params);
    $row = $query->fetch();

    return $row ?: null;
}

function seeker_can_access_announcement(int $userId, int $announcementId): bool
{
    $query = db()->prepare(
        'SELECT a.announcement_id
         FROM announcements a
         INNER JOIN boarding_house b ON b.boarding_house_id = a.boarding_house_id
         INNER JOIN rooms r ON r.boarding_house_id = b.boarding_house_id
         INNER JOIN reservations rv ON rv.room_id = r.room_id
         WHERE a.announcement_id = :announcement_id
           AND rv.user_id = :user_id
           AND rv.status = \'approved\'
           AND a.is_visible = 1
           AND (a.expires_at IS NULL OR a.expires_at >= CURDATE())
         LIMIT 1'
    );
    $query->execute([
        ':announcement_id' => $announcementId,
        ':user_id' => $userId,
    ]);

    return (bool)$query->fetchColumn();
}

function normalize_announcement_title($value, ?string $fallbackTitle = null): string
{
    $title = trim((string)$value);
    if ($title === '') {
        $title = trim((string)$fallbackTitle);
    }
    if ($title === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['title could not be generated.'], 400);
    }

    return substr($title, 0, 160);
}

function next_default_announcement_title(int $boardingHouseId): string
{
    $query = db()->prepare(
        'SELECT COUNT(*)
         FROM announcements
         WHERE boarding_house_id = :boarding_house_id'
    );
    $query->execute([':boarding_house_id' => $boardingHouseId]);

    return 'ANNOUNCEMENT ' . ((int)$query->fetchColumn() + 1);
}

function store_announcement_image(int $ownerId): ?string
{
    if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
        return null;
    }

    if ((int)($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    return store_uploaded_file(
        $_FILES['image'],
        'storage/public/announcements/' . $ownerId,
        [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
        ],
        3 * 1024 * 1024,
        'announcement image'
    );
}

function normalize_announcement_body($value): string
{
    $body = trim((string)$value);
    if ($body === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['body is required.'], 400);
    }

    return substr($body, 0, 3000);
}

function normalize_announcement_category($value): string
{
    $category = strtolower(trim((string)$value));
    $category = str_replace([' ', '-'], '_', $category);
    if ($category === '') {
        return 'general';
    }

    if (!in_array($category, ['general', 'maintenance', 'payment', 'policy', 'event', 'urgent'], true)) {
        json_response(false, 'Validation failed.', new stdClass(), ['category is invalid.'], 400);
    }

    return $category;
}

function normalize_announcement_expiry($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    $date = parse_ymd_date($value);
    if ($date === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['expires_at must be a valid YYYY-MM-DD date.'], 400);
    }

    return $date;
}

function normalize_payload_bool($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int)$value === 1;
    }

    $normalized = strtolower(trim((string)$value));
    return in_array($normalized, ['1', 'true', 'yes', 'on', 'visible', 'published'], true);
}
