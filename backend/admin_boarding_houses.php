<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

require_methods(['GET']);
ensure_admin_schema();
ensure_owner_feature_schema();

try {
    $actor = require_roles(['admin']);
    $boardingHouseId = parse_positive_int($_GET['boarding_house_id'] ?? null);

    if ($boardingHouseId !== null) {
        handle_admin_boarding_house_detail($actor, $boardingHouseId);
    }

    handle_admin_boarding_house_list($actor);
} catch (Throwable $exception) {
    $user = current_user();
    handle_exception($exception, 'Admin boarding house request failed', $user ? (int)$user['user_id'] : null);
}

function handle_admin_boarding_house_list(array $actor): void
{
    $query = db()->query(
        'SELECT b.boarding_house_id,
                b.house_name,
                b.address,
                b.cover_photo,
                b.contact_number,
                b.owner_id,
                u.full_name AS owner_name,
                u.email AS owner_email,
                u.contact_number AS owner_contact,
                COUNT(r.room_id) AS total_rooms,
                SUM(CASE WHEN r.availability_status = \'occupied\' AND COALESCE(r.is_archived, 0) = 0 THEN 1 ELSE 0 END) AS occupied_rooms,
                SUM(CASE WHEN r.availability_status = \'available\' AND COALESCE(r.is_archived, 0) = 0 THEN 1 ELSE 0 END) AS available_rooms,
                COALESCE(SUM(CASE
                    WHEN p.payment_status = \'paid\'
                     AND p.payment_date >= DATE_FORMAT(CURDATE(), "%Y-%m-01")
                     AND p.payment_date < DATE_ADD(DATE_FORMAT(CURDATE(), "%Y-%m-01"), INTERVAL 1 MONTH)
                    THEN p.amount_paid ELSE 0 END), 0) AS this_month_income
         FROM boarding_house b
         INNER JOIN users u ON u.user_id = b.owner_id
         LEFT JOIN rooms r ON r.boarding_house_id = b.boarding_house_id
         LEFT JOIN payments p ON p.room_id = r.room_id
         GROUP BY b.boarding_house_id, b.house_name, b.address, b.cover_photo, b.contact_number,
                  b.owner_id, u.full_name, u.email, u.contact_number
         ORDER BY b.boarding_house_id DESC'
    );

    $items = [];
    foreach ($query->fetchAll() as $row) {
        $totalRooms = (int)$row['total_rooms'];
        $occupiedRooms = (int)$row['occupied_rooms'];
        $collectionRate = $totalRooms > 0 ? round(($occupiedRooms / max($totalRooms, 1)) * 100, 2) : 0.0;
        $coverPhoto = trim((string)($row['cover_photo'] ?? ''));
        $items[] = [
            'boarding_house_id' => (int)$row['boarding_house_id'],
            'house_name' => $row['house_name'],
            'address' => $row['address'],
            'cover_photo' => $row['cover_photo'],
            'cover_photo_url' => $coverPhoto !== '' ? backend_asset_url($coverPhoto) : null,
            'contact_number' => $row['contact_number'],
            'owner_id' => (int)$row['owner_id'],
            'owner_name' => $row['owner_name'],
            'owner_email' => $row['owner_email'],
            'owner_contact' => $row['owner_contact'],
            'total_rooms' => $totalRooms,
            'occupied_rooms' => $occupiedRooms,
            'available_rooms' => (int)$row['available_rooms'],
            'this_month_income' => (float)$row['this_month_income'],
            'collection_rate' => $collectionRate,
        ];
    }

    log_activity((int)$actor['user_id'], 'Viewed boarding house oversight', 'boarding_house', 'warning');
    json_response(true, 'Boarding house oversight fetched successfully.', ['items' => $items], []);
}

function handle_admin_boarding_house_detail(array $actor, int $boardingHouseId): void
{
    $houseQuery = db()->prepare(
        'SELECT b.*, u.full_name AS owner_name, u.email AS owner_email, u.contact_number AS owner_contact
         FROM boarding_house b
         INNER JOIN users u ON u.user_id = b.owner_id
         WHERE b.boarding_house_id = :boarding_house_id
         LIMIT 1'
    );
    $houseQuery->execute([':boarding_house_id' => $boardingHouseId]);
    $house = $houseQuery->fetch();
    if (!$house) {
        json_response(false, 'Boarding house not found.', new stdClass(), [], 404);
    }

    $roomsQuery = db()->prepare(
        'SELECT r.room_id,
                r.room_number,
                r.room_type,
                r.capacity,
                r.monthly_rate,
                r.availability_status,
                r.is_archived,
                u.full_name AS tenant_name
         FROM rooms r
         LEFT JOIN reservations rv ON rv.room_id = r.room_id AND rv.status = \'approved\'
         LEFT JOIN users u ON u.user_id = rv.user_id
         WHERE r.boarding_house_id = :boarding_house_id
         ORDER BY r.room_number ASC'
    );
    $roomsQuery->execute([':boarding_house_id' => $boardingHouseId]);

    $tenantsQuery = db()->prepare(
        'SELECT u.user_id,
                u.full_name,
                u.email,
                u.contact_number,
                r.room_id,
                r.room_number,
                rv.move_in_date,
                COALESCE(p.payment_status, \'no_record\') AS this_month_rent_status
         FROM reservations rv
         INNER JOIN users u ON u.user_id = rv.user_id
         INNER JOIN rooms r ON r.room_id = rv.room_id
         LEFT JOIN payments p ON p.reservation_id = rv.reservation_id
            AND p.billing_period = DATE_FORMAT(CURDATE(), "%Y-%m")
         WHERE rv.status = \'approved\'
           AND r.boarding_house_id = :boarding_house_id
         ORDER BY u.full_name ASC'
    );
    $tenantsQuery->execute([':boarding_house_id' => $boardingHouseId]);

    $financialsQuery = db()->prepare(
        'SELECT bc.billing_month AS month,
                COUNT(*) AS bills,
                COALESCE(SUM(bc.amount_due), 0) AS billed,
                COALESCE(SUM(CASE WHEN p.payment_status = \'paid\' THEN p.amount_paid ELSE 0 END), 0) AS collected
         FROM billing_cycles bc
         INNER JOIN rooms r ON r.room_id = bc.room_id
         LEFT JOIN payments p ON p.billing_cycle_id = bc.billing_cycle_id
         WHERE r.boarding_house_id = :boarding_house_id
           AND bc.billing_month >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), "%Y-%m")
         GROUP BY bc.billing_month
         ORDER BY bc.billing_month DESC'
    );
    $financialsQuery->execute([':boarding_house_id' => $boardingHouseId]);

    $financials = [];
    foreach ($financialsQuery->fetchAll() as $row) {
        $billed = (float)$row['billed'];
        $collected = (float)$row['collected'];
        $financials[] = [
            'month' => $row['month'],
            'bills' => (int)$row['bills'],
            'billed' => $billed,
            'collected' => $collected,
            'outstanding' => max($billed - $collected, 0.0),
            'rate' => $billed > 0 ? round(($collected / $billed) * 100, 2) : 0.0,
        ];
    }

    $coverPhoto = trim((string)($house['cover_photo'] ?? ''));
    $house['cover_photo_url'] = $coverPhoto !== '' ? backend_asset_url($coverPhoto) : null;

    log_activity((int)$actor['user_id'], "Viewed boarding house #{$boardingHouseId}", 'boarding_house', 'warning');
    json_response(true, 'Boarding house detail fetched successfully.', [
        'boarding_house' => $house,
        'rooms' => $roomsQuery->fetchAll(),
        'tenants' => $tenantsQuery->fetchAll(),
        'financials' => $financials,
    ], []);
}
