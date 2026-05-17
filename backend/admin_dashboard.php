<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET']);
ensure_admin_schema();
ensure_owner_feature_schema();

try {
    $actor = require_roles(['admin']);

    $usersCount = admin_dashboard_user_counts();
    $boardingHousesCount = (int)db()->query('SELECT COUNT(*) FROM boarding_house')->fetchColumn();
    $unresolvedErrorsCount = (int)db()->query('SELECT COUNT(*) FROM error_logs WHERE is_resolved = 0')->fetchColumn();
    $platformIncome = admin_dashboard_platform_income_this_month();
    $userGrowth = admin_dashboard_user_growth();
    $recentCriticalLogs = admin_dashboard_recent_critical_logs();

    log_activity((int)$actor['user_id'], 'Viewed admin dashboard', 'admin_dashboard', 'info');

    json_response(
        true,
        'Admin dashboard fetched successfully.',
        [
            'users_count' => [
                'total' => $usersCount['total'],
                'by_role' => $usersCount['by_role'],
            ],
            'active_users_count' => $usersCount['active'],
            'inactive_users_count' => $usersCount['inactive'],
            'active_landlords_count' => $usersCount['active_owner'],
            'active_seekers_count' => $usersCount['active_seeker'],
            'boarding_houses_count' => $boardingHousesCount,
            'unresolved_errors_count' => $unresolvedErrorsCount,
            'platform_income_this_month' => $platformIncome,
            'user_growth' => $userGrowth,
            'recent_critical_logs' => $recentCriticalLogs,
            'role_breakdown' => $usersCount['by_role'],
        ],
        []
    );
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Admin dashboard request failed', $user ? (int)$user['user_id'] : null);
}

function admin_dashboard_user_counts(): array
{
    $counts = [
        'total' => 0,
        'active' => 0,
        'inactive' => 0,
        'active_owner' => 0,
        'active_seeker' => 0,
        'by_role' => [
            'admin' => 0,
            'owner' => 0,
            'seeker' => 0,
            'parent' => 0,
        ],
    ];

    $query = db()->query(
        'SELECT role,
                account_status,
                COUNT(*) AS total
         FROM users
         GROUP BY role, account_status'
    );

    foreach ($query->fetchAll() as $row) {
        $role = (string)$row['role'];
        $status = (string)$row['account_status'];
        $total = (int)$row['total'];

        $counts['total'] += $total;
        if (array_key_exists($role, $counts['by_role'])) {
            $counts['by_role'][$role] += $total;
        }
        if ($status === 'active') {
            $counts['active'] += $total;
            if ($role === 'owner') {
                $counts['active_owner'] += $total;
            }
            if ($role === 'seeker') {
                $counts['active_seeker'] += $total;
            }
        } elseif ($status === 'inactive') {
            $counts['inactive'] += $total;
        }
    }

    return $counts;
}

function admin_dashboard_platform_income_this_month(): float
{
    $query = db()->prepare(
        'SELECT COALESCE(SUM(amount_paid), 0)
         FROM payments
         WHERE payment_status = :status
           AND payment_date >= DATE_FORMAT(CURDATE(), "%Y-%m-01")
           AND payment_date < DATE_ADD(DATE_FORMAT(CURDATE(), "%Y-%m-01"), INTERVAL 1 MONTH)'
    );
    $query->execute([':status' => 'paid']);
    return (float)$query->fetchColumn();
}

function admin_dashboard_user_growth(): array
{
    $query = db()->query(
        'SELECT DATE(created_at) AS registration_date, COUNT(*) AS total
         FROM users
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY DATE(created_at)
         ORDER BY registration_date ASC'
    );

    $rowsByDate = [];
    foreach ($query->fetchAll() as $row) {
        $rowsByDate[(string)$row['registration_date']] = (int)$row['total'];
    }

    $items = [];
    for ($index = 29; $index >= 0; $index--) {
        $date = date('Y-m-d', strtotime("-{$index} days"));
        $items[] = [
            'date' => $date,
            'total' => $rowsByDate[$date] ?? 0,
        ];
    }

    return $items;
}

function admin_dashboard_recent_critical_logs(): array
{
    $query = db()->query(
        'SELECT a.*, u.full_name AS user_name, u.email AS user_email, u.role AS user_role
         FROM activity_logs a
         LEFT JOIN users u ON u.user_id = a.user_id
         WHERE a.severity IN (\'warning\', \'critical\')
         ORDER BY a.`timestamp` DESC, a.log_id DESC
         LIMIT 10'
    );

    return $query->fetchAll();
}
