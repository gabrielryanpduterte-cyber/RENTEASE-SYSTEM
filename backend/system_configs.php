<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET', 'PUT', 'PATCH', 'POST']);
ensure_admin_schema();
$method = request_method();

try {
    $actor = require_roles(['admin']);

    if ($method === 'GET') {
        handle_system_configs_get();
    }

    handle_system_configs_update($actor, request_payload());
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'System config request failed', $user ? (int)$user['user_id'] : null);
}

function handle_system_configs_get(): void
{
    $query = db()->query(
        'SELECT c.*,
                u.full_name AS updated_by_name,
                u.email AS updated_by_email
         FROM system_configs c
         LEFT JOIN users u ON u.user_id = c.updated_by
         ORDER BY c.config_group ASC, c.id ASC'
    );

    $groups = [];
    $lastChange = null;
    foreach ($query->fetchAll() as $row) {
        $group = (string)$row['config_group'];
        if (!array_key_exists($group, $groups)) {
            $groups[$group] = [];
        }

        $item = [
            'id' => (int)$row['id'],
            'config_key' => $row['config_key'],
            'config_value' => $row['config_value'],
            'config_group' => $group,
            'label' => $row['label'],
            'description' => $row['description'],
            'is_readonly' => (bool)$row['is_readonly'],
            'updated_by' => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
            'updated_by_name' => $row['updated_by_name'],
            'updated_at' => $row['updated_at'],
        ];
        $groups[$group][] = $item;

        if ($row['updated_at'] !== null && ($lastChange === null || strtotime((string)$row['updated_at']) > strtotime((string)$lastChange['updated_at']))) {
            $lastChange = [
                'updated_at' => $row['updated_at'],
                'updated_by_name' => $row['updated_by_name'],
            ];
        }
    }

    json_response(true, 'System configs fetched successfully.', [
        'groups' => $groups,
        'last_change' => $lastChange,
    ], []);
}

function handle_system_configs_update(array $actor, array $payload): void
{
    $key = trim((string)($_GET['key'] ?? ($payload['config_key'] ?? '')));
    if ($key === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['config key is required.'], 400);
    }

    if (!array_key_exists('config_value', $payload) && !array_key_exists('value', $payload)) {
        json_response(false, 'Validation failed.', new stdClass(), ['config_value is required.'], 400);
    }

    $value = trim((string)($payload['config_value'] ?? $payload['value']));
    $query = db()->prepare('SELECT * FROM system_configs WHERE config_key = :config_key LIMIT 1');
    $query->execute([':config_key' => $key]);
    $config = $query->fetch();
    if (!$config) {
        json_response(false, 'System config not found.', new stdClass(), [], 404);
    }
    if ((int)$config['is_readonly'] === 1) {
        json_response(false, 'Forbidden.', new stdClass(), ['This config is read-only.'], 403);
    }

    $validatedValue = validate_system_config_value($key, $value);
    $oldValue = (string)$config['config_value'];

    $update = db()->prepare(
        'UPDATE system_configs
         SET config_value = :config_value,
             updated_by = :updated_by,
             updated_at = NOW()
         WHERE config_key = :config_key'
    );
    $update->execute([
        ':config_value' => $validatedValue,
        ':updated_by' => (int)$actor['user_id'],
        ':config_key' => $key,
    ]);

    log_activity((int)$actor['user_id'], "Config changed: {$key} from '{$oldValue}' to '{$validatedValue}'", 'system', 'critical');

    $fetch = db()->prepare(
        'SELECT c.*, u.full_name AS updated_by_name
         FROM system_configs c
         LEFT JOIN users u ON u.user_id = c.updated_by
         WHERE c.config_key = :config_key
         LIMIT 1'
    );
    $fetch->execute([':config_key' => $key]);
    json_response(true, 'System config updated successfully.', $fetch->fetch(), []);
}

function validate_system_config_value(string $key, string $value): string
{
    if ($key === 'maintenance_mode') {
        $normalized = strtolower($value);
        if (!in_array($normalized, ['true', 'false'], true)) {
            json_response(false, 'Validation failed.', new stdClass(), ['maintenance_mode must be true or false.'], 400);
        }
        return $normalized;
    }

    if ($key === 'max_guardian_links') {
        return validate_int_config($value, 1, 20, $key);
    }
    if ($key === 'max_room_photos') {
        return validate_int_config($value, 1, 10, $key);
    }
    if ($key === 'cancellation_window_hours') {
        return validate_int_config($value, 0, 168, $key);
    }
    if ($key === 'app_name') {
        if (strlen($value) < 3 || strlen($value) > 50) {
            json_response(false, 'Validation failed.', new stdClass(), ['app_name must be 3 to 50 characters.'], 400);
        }
        return $value;
    }

    return $value;
}

function validate_int_config(string $value, int $min, int $max, string $key): string
{
    if (!preg_match('/^-?\d+$/', $value)) {
        json_response(false, 'Validation failed.', new stdClass(), ["{$key} must be an integer."], 400);
    }

    $parsed = (int)$value;
    if ($parsed < $min || $parsed > $max) {
        json_response(false, 'Validation failed.', new stdClass(), ["{$key} must be between {$min} and {$max}."], 400);
    }

    return (string)$parsed;
}
