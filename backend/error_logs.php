<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET', 'POST', 'DELETE']);
ensure_admin_schema();
$method = request_method();

try {
    $actor = require_roles(['admin']);
    $payload = $method === 'POST' ? request_payload() : [];
    $action = request_action($payload);

    if ($method === 'GET') {
        handle_error_logs_get();
    }

    if ($method === 'POST') {
        if ($action === 'resolve') {
            handle_error_logs_resolve($actor, $payload);
        }
        if ($action === 'bulk_resolve' || $action === 'bulk-resolve') {
            handle_error_logs_bulk_resolve($actor, $payload);
        }
        handle_error_logs_create($actor, $payload);
    }

    if ($method === 'DELETE') {
        handle_error_logs_delete($actor);
    }
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Error logs request failed', $user ? (int)$user['user_id'] : null);
}

function handle_error_logs_get(): void
{
    $errorId = parse_positive_int($_GET['error_id'] ?? null);
    if ($errorId !== null) {
        $query = db()->prepare(
            'SELECT e.*,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    r.full_name AS resolver_name,
                    r.email AS resolver_email
             FROM error_logs e
             LEFT JOIN users u ON u.user_id = e.affected_user_id
             LEFT JOIN users r ON r.user_id = e.resolved_by
             WHERE e.error_id = :error_id
             LIMIT 1'
        );
        $query->execute([':error_id' => $errorId]);
        $row = $query->fetch();
        if (!$row) {
            json_response(false, 'Error log not found.', new stdClass(), [], 404);
        }

        json_response(true, 'Error log fetched successfully.', $row, []);
    }

    [$whereClause, $params] = error_log_filter_sql();
    $limit = parse_limit_param($_GET['limit'] ?? null, 20, 100);
    $page = parse_page_param($_GET['page'] ?? null);
    $offset = ($page - 1) * $limit;

    $countSql = 'SELECT COUNT(*) AS total
                 FROM error_logs e
                 LEFT JOIN users u ON u.user_id = e.affected_user_id
                 LEFT JOIN users r ON r.user_id = e.resolved_by'
        . $whereClause;
    $countQuery = db()->prepare($countSql);
    $countQuery->execute($params);
    $total = (int)$countQuery->fetchColumn();
    $totalPages = $total > 0 ? (int)ceil($total / $limit) : 0;

    $sql = 'SELECT e.*,
                   u.full_name AS user_name,
                   u.email AS user_email,
                   r.full_name AS resolver_name,
                   r.email AS resolver_email
            FROM error_logs e
            LEFT JOIN users u ON u.user_id = e.affected_user_id
            LEFT JOIN users r ON r.user_id = e.resolved_by'
        . $whereClause
        . ' ORDER BY e.`timestamp` DESC, e.error_id DESC
            LIMIT :limit OFFSET :offset';

    $query = db()->prepare($sql);
    foreach ($params as $key => $value) {
        $query->bindValue($key, $value);
    }
    $query->bindValue(':limit', $limit, PDO::PARAM_INT);
    $query->bindValue(':offset', $offset, PDO::PARAM_INT);
    $query->execute();

    json_response(
        true,
        'Error logs fetched successfully.',
        [
            'items' => $query->fetchAll(),
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

function error_log_filter_sql(): array
{
    $conditions = [];
    $params = [];

    $resolvedRaw = $_GET['resolved'] ?? null;
    if ($resolvedRaw !== null && $resolvedRaw !== '') {
        if (!in_array((string)$resolvedRaw, ['0', '1'], true)) {
            json_response(false, 'Validation failed.', new stdClass(), ['resolved must be 0 or 1.'], 400);
        }
        $conditions[] = 'e.is_resolved = :is_resolved';
        $params[':is_resolved'] = (int)$resolvedRaw;
    }

    $errorCode = trim((string)($_GET['error_code'] ?? ''));
    if ($errorCode !== '') {
        $conditions[] = 'e.error_code = :error_code';
        $params[':error_code'] = $errorCode;
    }

    $affectedUserId = parse_positive_int($_GET['affected_user_id'] ?? null);
    if ($affectedUserId !== null) {
        $conditions[] = 'e.affected_user_id = :affected_user_id';
        $params[':affected_user_id'] = $affectedUserId;
    }

    $module = trim((string)($_GET['module'] ?? ''));
    if ($module !== '') {
        $conditions[] = '(e.error_code LIKE :module OR e.error_message LIKE :module OR e.request_url LIKE :module)';
        $params[':module'] = '%' . $module . '%';
    }

    $dateFromRaw = $_GET['date_from'] ?? ($_GET['from'] ?? null);
    $dateToRaw = $_GET['date_to'] ?? ($_GET['to'] ?? null);
    $dateFrom = parse_datetime_filter($dateFromRaw);
    $dateTo = parse_datetime_filter($dateToRaw, true);
    if ($dateFrom !== null) {
        $conditions[] = 'e.`timestamp` >= :date_from';
        $params[':date_from'] = $dateFrom;
    }
    if ($dateTo !== null) {
        $conditions[] = 'e.`timestamp` <= :date_to';
        $params[':date_to'] = $dateTo;
    }

    $search = trim((string)($_GET['search'] ?? ''));
    if ($search !== '') {
        $conditions[] = '(e.error_code LIKE :search OR e.error_message LIKE :search OR e.request_url LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    return [
        !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '',
        $params,
    ];
}

function handle_error_logs_create(array $actor, array $payload): void
{
    require_fields($payload, ['error_code', 'error_message']);

    $errorCode = trim((string)$payload['error_code']);
    $errorMessage = trim((string)$payload['error_message']);
    $affectedUserId = parse_positive_int($payload['affected_user_id'] ?? null);

    if ($errorCode === '' || $errorMessage === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['error_code and error_message are required.'], 400);
    }

    if ($affectedUserId !== null) {
        $userCheck = db()->prepare('SELECT user_id FROM users WHERE user_id = :user_id LIMIT 1');
        $userCheck->execute([':user_id' => $affectedUserId]);
        if (!$userCheck->fetch()) {
            json_response(false, 'Validation failed.', new stdClass(), ['affected_user_id does not exist.'], 400);
        }
    }

    $insert = db()->prepare(
        'INSERT INTO error_logs (
            error_code, error_message, affected_user_id, stack_trace,
            request_url, request_method, is_resolved, `timestamp`
         ) VALUES (
            :error_code, :error_message, :affected_user_id, :stack_trace,
            :request_url, :request_method, 0, NOW()
         )'
    );
    $insert->execute([
        ':error_code' => substr($errorCode, 0, 50),
        ':error_message' => substr($errorMessage, 0, 1000),
        ':affected_user_id' => $affectedUserId,
        ':stack_trace' => $payload['stack_trace'] ?? null,
        ':request_url' => isset($payload['request_url']) ? substr((string)$payload['request_url'], 0, 500) : current_request_url(),
        ':request_method' => isset($payload['request_method']) ? substr((string)$payload['request_method'], 0, 10) : request_method(),
    ]);

    $errorId = (int)db()->lastInsertId();
    log_activity((int)$actor['user_id'], "Created error log #{$errorId}", 'error_logs', 'warning');

    $fetch = db()->prepare('SELECT * FROM error_logs WHERE error_id = :error_id LIMIT 1');
    $fetch->execute([':error_id' => $errorId]);
    json_response(true, 'Error log created successfully.', $fetch->fetch() ?: ['error_id' => $errorId], [], 201);
}

function handle_error_logs_resolve(array $actor, array $payload): void
{
    $errorId = parse_positive_int($_GET['error_id'] ?? ($payload['error_id'] ?? null));
    if ($errorId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['error_id is required.'], 400);
    }

    $notes = trim((string)($payload['resolution_notes'] ?? ''));
    if (strlen($notes) < 20 || strlen($notes) > 1000) {
        json_response(false, 'Validation failed.', new stdClass(), ['resolution_notes must be 20 to 1000 characters.'], 400);
    }

    $query = db()->prepare('SELECT error_id, error_code FROM error_logs WHERE error_id = :error_id LIMIT 1');
    $query->execute([':error_id' => $errorId]);
    $error = $query->fetch();
    if (!$error) {
        json_response(false, 'Error log not found.', new stdClass(), [], 404);
    }

    $update = db()->prepare(
        'UPDATE error_logs
         SET is_resolved = 1,
             resolved_by = :resolved_by,
             resolved_at = NOW(),
             resolution_notes = :resolution_notes
         WHERE error_id = :error_id'
    );
    $update->execute([
        ':resolved_by' => (int)$actor['user_id'],
        ':resolution_notes' => $notes,
        ':error_id' => $errorId,
    ]);

    log_activity((int)$actor['user_id'], "Resolved error log #{$errorId}: {$error['error_code']}", 'error_logs', 'info');

    $fetch = db()->prepare('SELECT * FROM error_logs WHERE error_id = :error_id LIMIT 1');
    $fetch->execute([':error_id' => $errorId]);
    json_response(true, 'Error log resolved successfully.', $fetch->fetch(), []);
}

function handle_error_logs_bulk_resolve(array $actor, array $payload): void
{
    $ids = $payload['ids'] ?? [];
    if (!is_array($ids) || empty($ids)) {
        json_response(false, 'Validation failed.', new stdClass(), ['ids must be a non-empty array.'], 400);
    }

    $notes = trim((string)($payload['resolution_notes'] ?? ''));
    if (strlen($notes) < 20 || strlen($notes) > 1000) {
        json_response(false, 'Validation failed.', new stdClass(), ['resolution_notes must be 20 to 1000 characters.'], 400);
    }

    $normalizedIds = [];
    foreach ($ids as $id) {
        $parsed = parse_positive_int($id);
        if ($parsed === null) {
            json_response(false, 'Validation failed.', new stdClass(), ['Every id must be a positive integer.'], 400);
        }
        $normalizedIds[$parsed] = $parsed;
    }

    $placeholders = [];
    $params = [
        ':resolved_by' => (int)$actor['user_id'],
        ':resolution_notes' => $notes,
    ];
    foreach (array_values($normalizedIds) as $index => $id) {
        $key = ':id_' . $index;
        $placeholders[] = $key;
        $params[$key] = $id;
    }

    $update = db()->prepare(
        'UPDATE error_logs
         SET is_resolved = 1,
             resolved_by = :resolved_by,
             resolved_at = NOW(),
             resolution_notes = :resolution_notes
         WHERE error_id IN (' . implode(', ', $placeholders) . ')'
    );
    $update->execute($params);
    $count = $update->rowCount();

    log_activity((int)$actor['user_id'], "Bulk resolved {$count} error logs", 'error_logs', 'info');
    json_response(true, 'Error logs resolved successfully.', ['count' => $count], []);
}

function handle_error_logs_delete(array $actor): void
{
    $errorId = parse_positive_int($_GET['error_id'] ?? null);
    if ($errorId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['error_id is required.'], 400);
    }

    $query = db()->prepare('SELECT error_id FROM error_logs WHERE error_id = :error_id LIMIT 1');
    $query->execute([':error_id' => $errorId]);
    if (!$query->fetch()) {
        json_response(false, 'Error log not found.', new stdClass(), [], 404);
    }

    $delete = db()->prepare('DELETE FROM error_logs WHERE error_id = :error_id');
    $delete->execute([':error_id' => $errorId]);

    log_activity((int)$actor['user_id'], "Deleted error log #{$errorId}", 'error_logs', 'critical');
    json_response(true, 'Error log deleted successfully.', new stdClass(), []);
}
