<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/config/google-oauth.php';

require_methods(['POST']);
ensure_google_auth_schema();
ensure_admin_schema();

$payload = request_payload();
$action = $_GET['action'] ?? $payload['action'] ?? null;

try {
    if (in_array($action, ['google-auth', 'google', 'login'], true)) {
        handle_google_auth($payload);
    }

    json_response(
        false,
        'Invalid action.',
        new stdClass(),
        ['Use ?action=google-auth'],
        400
    );
} catch (Throwable $exception) {
    handle_exception($exception, 'Google auth request failed', null);
}

function handle_google_auth(array $payload): void
{
    if (!defined('GOOGLE_OAUTH_ENABLED') || !GOOGLE_OAUTH_ENABLED) {
        json_response(false, 'Google OAuth is disabled.', new stdClass(), [], 403);
    }

    if (!defined('GOOGLE_CLIENT_ID') || trim((string)GOOGLE_CLIENT_ID) === '') {
        json_response(false, 'Google OAuth is not configured.', new stdClass(), ['GOOGLE_CLIENT_ID is missing.'], 500);
    }

    $googleToken = trim((string)($payload['google_token'] ?? $payload['id_token'] ?? $payload['credential'] ?? ''));
    if ($googleToken === '') {
        json_response(false, 'Validation failed.', new stdClass(), ['google_token is required.'], 400);
    }

    $googleUser = verify_google_token($googleToken);
    if (!$googleUser) {
        json_response(false, 'Invalid Google token.', new stdClass(), ['Could not verify Google authentication.'], 401);
    }

    $googleId = trim((string)$googleUser['sub']);
    $email = strtolower(trim((string)$googleUser['email']));
    $fullName = trim((string)($googleUser['name'] ?? ''));
    $profilePicture = isset($googleUser['picture']) ? trim((string)$googleUser['picture']) : null;
    $isCompletingProfile = filter_var($payload['complete_profile'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if ($fullName === '') {
        $fullName = explode('@', $email)[0] ?: 'Google User';
    }

    if ($googleId === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_response(false, 'Invalid Google account.', new stdClass(), ['Google account did not provide a usable verified email.'], 401);
    }

    $existingByGoogleId = find_user_by_google_id($googleId);
    if ($existingByGoogleId) {
        if (is_incomplete_google_profile($existingByGoogleId) && !$isCompletingProfile) {
            respond_with_google_profile_required($email, $fullName, $profilePicture);
        }
        if (is_incomplete_google_profile($existingByGoogleId) && $isCompletingProfile) {
            $completedUser = complete_google_profile($existingByGoogleId, $googleId, $fullName, $profilePicture, $payload);
            respond_with_google_login($completedUser, $googleId, $profilePicture, 'Google profile completed.');
        }

        respond_with_google_login($existingByGoogleId, $googleId, $profilePicture, 'Login successful.');
    }

    $existingByEmail = find_user_by_email($email);
    if ($existingByEmail) {
        if (($existingByEmail['role'] ?? '') === 'admin') {
            json_response(
                false,
                'Admin must use email and password.',
                new stdClass(),
                ['Admin accounts cannot use Google OAuth.'],
                403
            );
        }

        if (is_incomplete_google_profile($existingByEmail) && !$isCompletingProfile) {
            respond_with_google_profile_required($email, $fullName, $profilePicture);
        }
        if (is_incomplete_google_profile($existingByEmail) && $isCompletingProfile) {
            $completedUser = complete_google_profile($existingByEmail, $googleId, $fullName, $profilePicture, $payload);
            respond_with_google_login($completedUser, $googleId, $profilePicture, 'Google profile completed.');
        }

        $provider = strtolower((string)($existingByEmail['auth_provider'] ?? 'local'));
        $passwordHash = trim((string)($existingByEmail['password_hash'] ?? ''));
        $nextProvider = ($provider === 'google' || $passwordHash === '') ? 'google' : 'local';

        $update = db()->prepare(
            'UPDATE users
             SET google_id = :google_id,
                 profile_picture = :profile_picture,
                 auth_provider = :auth_provider,
                 email_verified = 1
             WHERE user_id = :user_id'
        );
        $update->execute([
            ':google_id' => $googleId,
            ':profile_picture' => $profilePicture,
            ':auth_provider' => $nextProvider,
            ':user_id' => (int)$existingByEmail['user_id'],
        ]);

        $linkedUser = find_user_by_id((int)$existingByEmail['user_id']);
        if (!$linkedUser) {
            json_response(false, 'Google account link failed.', new stdClass(), [], 500);
        }

        respond_with_google_login($linkedUser, $googleId, $profilePicture, 'Google account linked successfully.');
    }

    if (!$isCompletingProfile) {
        respond_with_google_profile_required($email, $fullName, $profilePicture);
    }

    $newUser = create_google_user($googleId, $email, $fullName, $profilePicture, $payload);
    respond_with_google_login($newUser, $googleId, $profilePicture, 'Registration successful.', 201);
}

function find_user_by_google_id(string $googleId): ?array
{
    $query = db()->prepare('SELECT * FROM users WHERE google_id = :google_id LIMIT 1');
    $query->execute([':google_id' => $googleId]);
    $user = $query->fetch();

    return $user ?: null;
}

function find_user_by_email(string $email): ?array
{
    $query = db()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $query->execute([':email' => $email]);
    $user = $query->fetch();

    return $user ?: null;
}

function is_incomplete_google_profile(array $user): bool
{
    return strtolower((string)($user['auth_provider'] ?? 'local')) === 'google'
        && (trim((string)($user['contact_number'] ?? '')) === '' || trim((string)($user['password_hash'] ?? '')) === '');
}

function google_profile_inputs(array $payload, string $fallbackName, bool $requirePassword): array
{
    $role = strtolower(trim((string)($payload['role'] ?? '')));
    $fullName = trim((string)($payload['full_name'] ?? $fallbackName));
    $contactNumber = trim((string)($payload['contact_number'] ?? ''));
    $schoolOrWorkplace = trim((string)($payload['school_or_workplace'] ?? ''));
    $emergencyContactName = trim((string)($payload['emergency_contact_name'] ?? ''));
    $emergencyContactNumber = trim((string)($payload['emergency_contact_number'] ?? ''));
    $password = (string)($payload['password'] ?? $payload['new_password'] ?? '');
    $confirmPassword = (string)($payload['confirm_password'] ?? $password);

    $errors = [];
    if (!in_array($role, ['seeker', 'parent', 'owner'], true)) {
        $errors[] = 'role must be seeker, parent, or owner.';
    }
    if ($fullName === '') {
        $errors[] = 'full_name must not be empty.';
    }
    if ($contactNumber === '') {
        $errors[] = 'contact_number is required.';
    }
    if (strlen($contactNumber) > 20) {
        $errors[] = 'contact_number cannot exceed 20 characters.';
    }
    if ($schoolOrWorkplace !== '' && strlen($schoolOrWorkplace) > 150) {
        $errors[] = 'school_or_workplace cannot exceed 150 characters.';
    }
    if ($emergencyContactName !== '' && strlen($emergencyContactName) > 100) {
        $errors[] = 'emergency_contact_name cannot exceed 100 characters.';
    }
    if ($emergencyContactNumber !== '' && strlen($emergencyContactNumber) > 20) {
        $errors[] = 'emergency_contact_number cannot exceed 20 characters.';
    }
    if ($requirePassword && strlen($password) < 8) {
        $errors[] = 'password must be at least 8 characters.';
    }
    if ($requirePassword && $password !== $confirmPassword) {
        $errors[] = 'confirm_password must match password.';
    }

    if (!empty($errors)) {
        json_response(false, 'Validation failed.', new stdClass(), $errors, 400);
    }

    return [
        'role' => $role,
        'full_name' => $fullName,
        'contact_number' => $contactNumber,
        'school_or_workplace' => $schoolOrWorkplace,
        'emergency_contact_name' => $emergencyContactName,
        'emergency_contact_number' => $emergencyContactNumber,
        'password_hash' => $requirePassword ? password_hash($password, PASSWORD_DEFAULT) : null,
    ];
}

function create_google_user(
    string $googleId,
    string $email,
    string $fullName,
    ?string $profilePicture,
    array $payload
): array {
    $profile = google_profile_inputs($payload, $fullName, true);

    $insert = db()->prepare(
        'INSERT INTO users (
            full_name,
            email,
            password_hash,
            role,
            contact_number,
            account_status,
            profile_picture,
            google_id,
            auth_provider,
            email_verified,
            school_or_workplace,
            emergency_contact_name,
            emergency_contact_number,
            created_at
         ) VALUES (
            :full_name,
            :email,
            :password_hash,
            :role,
            :contact_number,
            :account_status,
            :profile_picture,
            :google_id,
            :auth_provider,
            1,
            :school_or_workplace,
            :emergency_contact_name,
            :emergency_contact_number,
            NOW()
         )'
    );
    $insert->execute([
        ':full_name' => $profile['full_name'],
        ':email' => $email,
        ':password_hash' => $profile['password_hash'],
        ':role' => $profile['role'],
        ':contact_number' => $profile['contact_number'],
        ':account_status' => 'active',
        ':profile_picture' => $profilePicture,
        ':google_id' => $googleId,
        ':auth_provider' => 'google',
        ':school_or_workplace' => $profile['school_or_workplace'] !== '' ? $profile['school_or_workplace'] : null,
        ':emergency_contact_name' => $profile['emergency_contact_name'] !== '' ? $profile['emergency_contact_name'] : null,
        ':emergency_contact_number' => $profile['emergency_contact_number'] !== '' ? $profile['emergency_contact_number'] : null,
    ]);

    $newUserId = (int)db()->lastInsertId();
    $newUser = find_user_by_id($newUserId);

    if (!$newUser) {
        json_response(false, 'User creation failed.', new stdClass(), [], 500);
    }

    log_activity($newUserId, 'User registered via Google OAuth', 'auth', 'info');

    return $newUser;
}

function complete_google_profile(
    array $user,
    string $googleId,
    string $fallbackName,
    ?string $profilePicture,
    array $payload
): array {
    $needsPassword = trim((string)($user['password_hash'] ?? '')) === '';
    $profile = google_profile_inputs($payload, $fallbackName, $needsPassword);

    $update = db()->prepare(
        'UPDATE users
         SET full_name = :full_name,
             role = :role,
             contact_number = :contact_number,
             password_hash = COALESCE(:password_hash, password_hash),
             school_or_workplace = :school_or_workplace,
             emergency_contact_name = :emergency_contact_name,
             emergency_contact_number = :emergency_contact_number,
             profile_picture = :profile_picture,
             google_id = :google_id,
             auth_provider = "google",
             email_verified = 1
         WHERE user_id = :user_id'
    );
    $update->execute([
        ':full_name' => $profile['full_name'],
        ':role' => $profile['role'],
        ':contact_number' => $profile['contact_number'],
        ':password_hash' => $profile['password_hash'],
        ':school_or_workplace' => $profile['school_or_workplace'] !== '' ? $profile['school_or_workplace'] : null,
        ':emergency_contact_name' => $profile['emergency_contact_name'] !== '' ? $profile['emergency_contact_name'] : null,
        ':emergency_contact_number' => $profile['emergency_contact_number'] !== '' ? $profile['emergency_contact_number'] : null,
        ':profile_picture' => $profilePicture,
        ':google_id' => $googleId,
        ':user_id' => (int)$user['user_id'],
    ]);

    $completedUser = find_user_by_id((int)$user['user_id']);
    if (!$completedUser) {
        json_response(false, 'Google profile completion failed.', new stdClass(), [], 500);
    }

    log_activity((int)$user['user_id'], 'Completed Google profile', 'auth', 'info');
    return $completedUser;
}

function respond_with_google_profile_required(string $email, string $fullName, ?string $profilePicture): void
{
    json_response(
        true,
        'Google verified. Complete your RentEase profile.',
        [
            'requires_profile_completion' => true,
            'google_profile' => [
                'full_name' => $fullName,
                'email' => $email,
                'profile_picture' => $profilePicture,
                'profile_photo_url' => $profilePicture,
            ],
        ],
        [],
        202
    );
}

function respond_with_google_login(
    array $user,
    string $googleId,
    ?string $profilePicture,
    string $message,
    int $statusCode = 200
): void {
    if (($user['role'] ?? '') === 'admin') {
        json_response(
            false,
            'Admin must use email and password.',
            new stdClass(),
            ['Admin accounts cannot use Google OAuth.'],
            403
        );
    }

    if (($user['account_status'] ?? 'inactive') !== 'active') {
        json_response(false, 'Account is inactive.', new stdClass(), ['Your account has been deactivated.'], 403);
    }

    $updates = [];
    $params = [':user_id' => (int)$user['user_id']];

    if (($user['google_id'] ?? '') !== $googleId) {
        $updates[] = 'google_id = :google_id';
        $params[':google_id'] = $googleId;
    }

    if ($profilePicture !== null && ($user['profile_picture'] ?? '') !== $profilePicture) {
        $updates[] = 'profile_picture = :profile_picture';
        $params[':profile_picture'] = $profilePicture;
    }

    if ((int)($user['email_verified'] ?? 0) !== 1) {
        $updates[] = 'email_verified = 1';
    }

    if (db_column_exists('users', 'last_login_at')) {
        $updates[] = 'last_login_at = NOW()';
    }

    if (!empty($updates)) {
        $update = db()->prepare('UPDATE users SET ' . implode(', ', $updates) . ' WHERE user_id = :user_id');
        $update->execute($params);
        $user = find_user_by_id((int)$user['user_id']) ?: $user;
    }

    login_user($user);
    log_activity((int)$user['user_id'], 'User login via Google OAuth', 'auth', 'info');

    json_response(true, $message, sanitize_user($user), [], $statusCode);
}

function verify_google_token(string $token): ?array
{
    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($token);
    $response = google_tokeninfo_request($url);

    if ($response === null) {
        return null;
    }

    $data = json_decode($response, true);
    if (!is_array($data) || !isset($data['sub'], $data['email'], $data['aud'])) {
        return null;
    }

    if ((string)$data['aud'] !== (string)GOOGLE_CLIENT_ID) {
        return null;
    }

    $emailVerified = $data['email_verified'] ?? false;
    if (!($emailVerified === true || $emailVerified === 'true' || $emailVerified === '1' || $emailVerified === 1)) {
        return null;
    }

    return $data;
}

function google_tokeninfo_request(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($httpCode === 200 && is_string($response) && $response !== '') ? $response : null;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 10,
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents($url, false, $context);

    if (!is_string($response) || $response === '') {
        return null;
    }

    $statusLine = $http_response_header[0] ?? '';
    return str_contains($statusLine, '200') ? $response : null;
}
