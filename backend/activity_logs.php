<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET', 'POST', 'DELETE']);
ensure_admin_schema();
$method = request_method();

try {
    $actor = require_roles(['admin']);

    if ($method === 'GET') {
        handle_activity_logs_get($actor);
    }

    if ($method === 'POST') {
        handle_activity_logs_create($actor, request_payload());
    }

    if ($method === 'DELETE') {
        handle_activity_logs_delete($actor);
    }
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Activity logs request failed', $user ? (int)$user['user_id'] : null);
}

function handle_activity_logs_get(array $actor): void
{
    if (request_action() === 'export') {
        handle_activity_logs_export($actor);
    }

    $logId = parse_positive_int($_GET['log_id'] ?? null);
    if ($logId !== null) {
        $query = db()->prepare(
            'SELECT a.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role
             FROM activity_logs a
             LEFT JOIN users u ON u.user_id = a.user_id
             WHERE a.log_id = :log_id
             LIMIT 1'
        );
        $query->execute([':log_id' => $logId]);
        $row = $query->fetch();
        if (!$row) {
            json_response(false, 'Activity log not found.', new stdClass(), [], 404);
        }

        json_response(true, 'Activity log fetched successfully.', $row, []);
    }

    [$whereClause, $params] = activity_log_filter_sql();
    $limit = parse_limit_param($_GET['limit'] ?? null, 25, 200);
    $page = parse_page_param($_GET['page'] ?? null);
    $offset = ($page - 1) * $limit;

    $countSql = 'SELECT COUNT(*) AS total
                 FROM activity_logs a
                 LEFT JOIN users u ON u.user_id = a.user_id'
        . $whereClause;
    $countQuery = db()->prepare($countSql);
    $countQuery->execute($params);
    $total = (int)$countQuery->fetchColumn();
    $totalPages = $total > 0 ? (int)ceil($total / $limit) : 0;

    $sql = 'SELECT a.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role
            FROM activity_logs a
            LEFT JOIN users u ON u.user_id = a.user_id'
        . $whereClause
        . ' ORDER BY a.`timestamp` DESC, a.log_id DESC
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
        'Activity logs fetched successfully.',
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

function activity_log_filter_sql(): array
{
    $conditions = [];
    $params = [];

    $userId = parse_positive_int($_GET['user_id'] ?? null);
    if ($userId !== null) {
        $conditions[] = 'a.user_id = :user_id';
        $params[':user_id'] = $userId;
    }

    $module = trim((string)($_GET['module'] ?? ($_GET['affected_module'] ?? '')));
    if ($module !== '') {
        $modules = array_values(array_filter(array_map('trim', explode(',', $module)), static fn($item) => $item !== ''));
        $placeholders = [];
        foreach ($modules as $index => $moduleName) {
            $key = ':module_' . $index;
            $placeholders[] = $key;
            $params[$key] = $moduleName;
        }
        if (!empty($placeholders)) {
            $conditions[] = 'a.affected_module IN (' . implode(', ', $placeholders) . ')';
        }
    }

    $severity = trim((string)($_GET['severity'] ?? ''));
    if ($severity !== '') {
        $severities = array_values(array_filter(array_map('trim', explode(',', strtolower($severity))), static fn($item) => $item !== ''));
        $validSeverities = ['info', 'warning', 'critical'];
        $placeholders = [];
        foreach ($severities as $index => $item) {
            if (!in_array($item, $validSeverities, true)) {
                json_response(false, 'Validation failed.', new stdClass(), ['severity must be info, warning, or critical.'], 400);
            }
            $key = ':severity_' . $index;
            $placeholders[] = $key;
            $params[$key] = $item;
        }
        if (!empty($placeholders)) {
            $conditions[] = 'a.severity IN (' . implode(', ', $placeholders) . ')';
        }
    }

    $dateFromRaw = $_GET['date_from'] ?? ($_GET['from'] ?? null);
    $dateToRaw = $_GET['date_to'] ?? ($_GET['to'] ?? null);
    $dateFrom = parse_datetime_filter($dateFromRaw);
    $dateTo = parse_datetime_filter($dateToRaw, true);
    if ($dateFromRaw !== null && trim((string)$dateFromRaw) !== '' && $dateFrom === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['date_from must be a valid date or datetime.'], 400);
    }
    if ($dateToRaw !== null && trim((string)$dateToRaw) !== '' && $dateTo === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['date_to must be a valid date or datetime.'], 400);
    }
    if ($dateFrom !== null && $dateTo !== null && strtotime($dateFrom) > strtotime($dateTo)) {
        json_response(false, 'Validation failed.', new stdClass(), ['date_from cannot be later than date_to.'], 400);
    }
    if ($dateFrom !== null) {
        $conditions[] = 'a.`timestamp` >= :date_from';
        $params[':date_from'] = $dateFrom;
    }
    if ($dateTo !== null) {
        $conditions[] = 'a.`timestamp` <= :date_to';
        $params[':date_to'] = $dateTo;
    }

    $sinceRaw = $_GET['since'] ?? null;
    $since = parse_datetime_filter($sinceRaw);
    if ($sinceRaw !== null && trim((string)$sinceRaw) !== '' && $since === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['since must be a valid date or datetime.'], 400);
    }
    if ($since !== null) {
        $conditions[] = 'a.`timestamp` > :since';
        $params[':since'] = $since;
    }

    $search = trim((string)($_GET['search'] ?? ''));
    if ($search !== '') {
        $conditions[] = '(a.action_performed LIKE :search OR a.affected_module LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    return [
        !empty($conditions) ? ' WHERE ' . implode(' AND ', $conditions) : '',
        $params,
    ];
}

function handle_activity_logs_create(array $actor, array $payload): void
{
    require_fields($payload, ['action_performed', 'affected_module']);

    $userId = parse_positive_int($payload['user_id'] ?? null);
    $actionPerformed = trim((string)$payload['action_performed']);
    $affectedModule = trim((string)$payload['affected_module']);
    $severity = normalize_severity((string)($payload['severity'] ?? 'info'));

    if ($actionPerformed === '' || $affectedModule === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['action_performed and affected_module are required.'], 400);
    }

    if ($userId !== null) {
        $userCheck = db()->prepare('SELECT user_id FROM users WHERE user_id = :user_id LIMIT 1');
        $userCheck->execute([':user_id' => $userId]);
        if (!$userCheck->fetch()) {
            json_response(false, 'Validation failed.', new stdClass(), ['user_id does not exist.'], 400);
        }
    }

    $insert = db()->prepare(
        'INSERT INTO activity_logs (user_id, action_performed, affected_module, severity, ip_address, user_agent, `timestamp`)
         VALUES (:user_id, :action_performed, :affected_module, :severity, :ip_address, :user_agent, NOW())'
    );
    $insert->execute([
        ':user_id' => $userId,
        ':action_performed' => $actionPerformed,
        ':affected_module' => $affectedModule,
        ':severity' => $severity,
        ':ip_address' => request_ip_address(),
        ':user_agent' => request_user_agent(),
    ]);

    $logId = (int)db()->lastInsertId();
    log_activity((int)$actor['user_id'], "Created activity log #{$logId}", 'activity_logs', 'info');

    $fetch = db()->prepare('SELECT * FROM activity_logs WHERE log_id = :log_id LIMIT 1');
    $fetch->execute([':log_id' => $logId]);
    json_response(true, 'Activity log created successfully.', $fetch->fetch() ?: ['log_id' => $logId], [], 201);
}

function handle_activity_logs_delete(array $actor): void
{
    $logId = parse_positive_int($_GET['log_id'] ?? null);
    if ($logId === null) {
        json_response(false, 'Validation failed.', new stdClass(), ['log_id is required.'], 400);
    }

    $query = db()->prepare('SELECT log_id FROM activity_logs WHERE log_id = :log_id LIMIT 1');
    $query->execute([':log_id' => $logId]);
    if (!$query->fetch()) {
        json_response(false, 'Activity log not found.', new stdClass(), [], 404);
    }

    $delete = db()->prepare('DELETE FROM activity_logs WHERE log_id = :log_id');
    $delete->execute([':log_id' => $logId]);

    log_activity((int)$actor['user_id'], "Deleted activity log #{$logId}", 'activity_logs', 'critical');
    json_response(true, 'Activity log deleted successfully.', new stdClass(), []);
}

function handle_activity_logs_export(array $actor): void
{
    $now = time();
    $window = array_values(array_filter($_SESSION['activity_export_hits'] ?? [], static fn($hit) => (int)$hit > $now - 60));
    if (count($window) >= 5) {
        $retryAfter = max(1, 60 - ($now - (int)$window[0]));
        header("Retry-After: {$retryAfter}");
        json_response(false, 'Too many exports. Try again later.', new stdClass(), ["Retry after {$retryAfter} seconds."], 429);
    }
    $window[] = $now;
    $_SESSION['activity_export_hits'] = $window;

    [$whereClause, $params] = activity_log_filter_sql();
    $query = db()->prepare(
        'SELECT a.log_id, a.`timestamp`, a.user_id, u.full_name AS user_name, u.role AS user_role,
                a.action_performed, a.affected_module, a.severity, a.ip_address
         FROM activity_logs a
         LEFT JOIN users u ON u.user_id = a.user_id'
        . $whereClause .
        ' ORDER BY a.`timestamp` DESC, a.log_id DESC'
    );
    $query->execute($params);

    log_activity((int)$actor['user_id'], 'Exported activity log CSV', 'activity_logs', 'info');

    header('Content-Type: text/csv; charset=utf-8', true);
    header('Content-Disposition: attachment; filename="activity_log_' . date('Ymd_His') . '.csv"');
    $output = fopen('php://output', 'wb');
    fputcsv($output, ['ID', 'Timestamp', 'User ID', 'User Name', 'User Role', 'Action', 'Module', 'Severity', 'IP Address']);
    while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($output, [
            $row['log_id'],
            $row['timestamp'],
            $row['user_id'],
            $row['user_name'],
            $row['user_role'],
            $row['action_performed'],
            $row['affected_module'],
            $row['severity'],
            $row['ip_address'],
        ]);
    }
    fclose($output);
    exit;
}
