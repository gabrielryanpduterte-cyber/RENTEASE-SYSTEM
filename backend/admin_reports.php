<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET']);
ensure_admin_schema();
ensure_owner_feature_schema();

try {
    $actor = require_roles(['admin']);
    $action = request_action();

    if ($action === 'user_growth' || $action === 'user-growth') {
        handle_admin_report_user_growth($actor);
    }
    if ($action === 'occupancy') {
        handle_admin_report_occupancy($actor);
    }

    handle_admin_report_income($actor);
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Admin report request failed', $user ? (int)$user['user_id'] : null);
}

function admin_report_month_filters(): array
{
    $from = parse_billing_month($_GET['from'] ?? null) ?? date('Y-m', strtotime('-5 months'));
    $to = parse_billing_month($_GET['to'] ?? null) ?? date('Y-m');

    if ($from > $to) {
        json_response(false, 'Validation failed.', new stdClass(), ['from cannot be later than to.'], 400);
    }

    $months = [];
    $cursor = DateTime::createFromFormat('Y-m-d', $from . '-01');
    $end = DateTime::createFromFormat('Y-m-d', $to . '-01');
    while ($cursor instanceof DateTime && $end instanceof DateTime && $cursor <= $end) {
        $months[] = $cursor->format('Y-m');
        $cursor->modify('+1 month');
        if (count($months) > 12) {
            json_response(false, 'Validation failed.', new stdClass(), ['Month range cannot exceed 12 months.'], 400);
        }
    }

    return [$from, $to, $months];
}

function handle_admin_report_income(array $actor): void
{
    [$from, $to, $months] = admin_report_month_filters();

    $query = db()->prepare(
        'SELECT bc.billing_month AS month,
                b.boarding_house_id,
                b.house_name,
                COUNT(*) AS bills,
                COALESCE(SUM(bc.amount_due), 0) AS billed,
                COALESCE(SUM(CASE WHEN p.payment_status = \'paid\' THEN p.amount_paid ELSE 0 END), 0) AS collected
         FROM billing_cycles bc
         INNER JOIN rooms r ON r.room_id = bc.room_id
         INNER JOIN boarding_house b ON b.boarding_house_id = r.boarding_house_id
         LEFT JOIN payments p ON p.billing_cycle_id = bc.billing_cycle_id
         WHERE bc.billing_month BETWEEN :from_month AND :to_month
         GROUP BY bc.billing_month, b.boarding_house_id, b.house_name
         ORDER BY bc.billing_month ASC, b.house_name ASC'
    );
    $query->execute([
        ':from_month' => $from,
        ':to_month' => $to,
    ]);

    $monthly = [];
    foreach ($months as $month) {
        $monthly[$month] = [
            'month' => $month,
            'bills' => 0,
            'total_billed' => 0.0,
            'total_collected' => 0.0,
            'outstanding' => 0.0,
            'rate' => 0.0,
            'boarding_houses' => [],
        ];
    }

    foreach ($query->fetchAll() as $row) {
        $month = (string)$row['month'];
        $billed = (float)$row['billed'];
        $collected = (float)$row['collected'];
        if (!array_key_exists($month, $monthly)) {
            continue;
        }

        $monthly[$month]['bills'] += (int)$row['bills'];
        $monthly[$month]['total_billed'] += $billed;
        $monthly[$month]['total_collected'] += $collected;
        $monthly[$month]['boarding_houses'][] = [
            'boarding_house_id' => (int)$row['boarding_house_id'],
            'house_name' => $row['house_name'],
            'billed' => $billed,
            'collected' => $collected,
            'outstanding' => max($billed - $collected, 0.0),
        ];
    }

    $summary = [
        'total_billed' => 0.0,
        'total_collected' => 0.0,
        'total_outstanding' => 0.0,
        'avg_rate' => 0.0,
    ];

    foreach ($monthly as &$row) {
        $row['outstanding'] = max($row['total_billed'] - $row['total_collected'], 0.0);
        $row['rate'] = $row['total_billed'] > 0 ? round(($row['total_collected'] / $row['total_billed']) * 100, 2) : 0.0;
        $summary['total_billed'] += $row['total_billed'];
        $summary['total_collected'] += $row['total_collected'];
        $summary['total_outstanding'] += $row['outstanding'];
    }
    unset($row);

    $summary['avg_rate'] = $summary['total_billed'] > 0
        ? round(($summary['total_collected'] / $summary['total_billed']) * 100, 2)
        : 0.0;

    log_activity((int)$actor['user_id'], 'Viewed platform income report', 'reports', 'info');
    json_response(true, 'Platform income report fetched successfully.', [
        'from' => $from,
        'to' => $to,
        'summary' => $summary,
        'rows' => array_values($monthly),
    ], []);
}

function handle_admin_report_user_growth(array $actor): void
{
    [$from, $to, $months] = admin_report_month_filters();
    $query = db()->prepare(
        'SELECT DATE_FORMAT(created_at, "%Y-%m") AS month,
                role,
                COUNT(*) AS total
         FROM users
         WHERE DATE_FORMAT(created_at, "%Y-%m") BETWEEN :from_month AND :to_month
         GROUP BY DATE_FORMAT(created_at, "%Y-%m"), role
         ORDER BY month ASC'
    );
    $query->execute([
        ':from_month' => $from,
        ':to_month' => $to,
    ]);

    $rows = [];
    foreach ($months as $month) {
        $rows[$month] = [
            'month' => $month,
            'new_users' => 0,
            'admin' => 0,
            'owner' => 0,
            'seeker' => 0,
            'parent' => 0,
            'cumulative' => 0,
        ];
    }

    foreach ($query->fetchAll() as $row) {
        $month = (string)$row['month'];
        $role = (string)$row['role'];
        $total = (int)$row['total'];
        if (!array_key_exists($month, $rows)) {
            continue;
        }
        $rows[$month]['new_users'] += $total;
        if (array_key_exists($role, $rows[$month])) {
            $rows[$month][$role] += $total;
        }
    }

    $cumulative = 0;
    foreach ($rows as &$row) {
        $cumulative += $row['new_users'];
        $row['cumulative'] = $cumulative;
    }
    unset($row);

    log_activity((int)$actor['user_id'], 'Viewed user growth report', 'reports', 'info');
    json_response(true, 'User growth report fetched successfully.', ['rows' => array_values($rows)], []);
}

function handle_admin_report_occupancy(array $actor): void
{
    [, , $months] = admin_report_month_filters();

    $query = db()->query(
        "SELECT
            SUM(CASE WHEN COALESCE(is_archived, 0) = 1 OR availability_status = 'archived' THEN 1 ELSE 0 END) AS archived,
            SUM(CASE WHEN COALESCE(is_archived, 0) = 0 AND availability_status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
            SUM(CASE WHEN COALESCE(is_archived, 0) = 0 AND availability_status = 'available' THEN 1 ELSE 0 END) AS available,
            SUM(CASE WHEN COALESCE(is_archived, 0) = 0 AND availability_status = 'unavailable' THEN 1 ELSE 0 END) AS unavailable,
            COUNT(*) AS total
         FROM rooms"
    );
    $current = $query->fetch() ?: [];
    $total = (int)($current['total'] ?? 0);
    $occupied = (int)($current['occupied'] ?? 0);
    $available = (int)($current['available'] ?? 0);
    $archived = (int)($current['archived'] ?? 0);
    $activeRooms = max($total - $archived, 0);

    $rows = array_map(static function (string $month) use ($occupied, $available): array {
        return [
            'month' => $month,
            'occupied_rooms' => $occupied,
            'available_rooms' => $available,
            'rate' => ($occupied + $available) > 0 ? round(($occupied / max($occupied + $available, 1)) * 100, 2) : 0.0,
        ];
    }, $months);

    log_activity((int)$actor['user_id'], 'Viewed platform occupancy report', 'reports', 'info');
    json_response(true, 'Platform occupancy report fetched successfully.', [
        'summary' => [
            'total_rooms' => $total,
            'occupied_rooms' => $occupied,
            'available_rooms' => $available,
            'unavailable_rooms' => (int)($current['unavailable'] ?? 0),
            'archived_rooms' => $archived,
            'rate' => $activeRooms > 0 ? round(($occupied / $activeRooms) * 100, 2) : 0.0,
        ],
        'rows' => $rows,
    ], []);
}
