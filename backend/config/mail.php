<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config.php';

function mail_config_value(string $name, string $defaultValue = '', array $aliases = []): string
{
    if (function_exists('config_value')) {
        return config_value($name, $defaultValue, $aliases);
    }

    foreach (array_merge([$name], $aliases) as $candidate) {
        $value = getenv($candidate);
        if ($value !== false && $value !== '') {
            return $value;
        }
    }

    return $defaultValue;
}

function mail_from_address(): string
{
    return mail_config_value('MAIL_FROM_ADDRESS', 'support@rmail.rentease.shop');
}

function mail_from_name(): string
{
    return mail_config_value('MAIL_FROM_NAME', 'RentEase');
}

function mail_reply_to(): string
{
    return mail_config_value('MAIL_REPLY_TO', 'renteasesupport@gmail.com');
}

function mail_from_header(): string
{
    return mail_from_name() . ' <' . mail_from_address() . '>';
}

function app_frontend_url(): string
{
    return rtrim(mail_config_value('RENTEASE_FRONTEND_URL', 'http://localhost:5173', ['FRONTEND_URL']), '/');
}

function dashboard_url(string $path): string
{
    return app_frontend_url() . '/' . ltrim($path, '/');
}

function safe_html(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function format_money_email(float $amount): string
{
    return 'PHP ' . number_format($amount, 2);
}

function format_date_email(?string $date): string
{
    if ($date === null || trim($date) === '') {
        return 'Not set';
    }

    $timestamp = strtotime($date);
    return $timestamp ? date('F j, Y', $timestamp) : $date;
}

function format_billing_month_email(?string $month): string
{
    if ($month === null || trim($month) === '') {
        return date('F Y');
    }

    $timestamp = strtotime($month . '-01');
    return $timestamp ? date('F Y', $timestamp) : $month;
}

function mail_detail_rows(array $details): string
{
    $html = '';
    foreach ($details as $label => $value) {
        $html .= '
            <tr>
                <td style="padding: 10px 0; color: #6B6760; font-size: 13px; width: 42%;">' . safe_html((string)$label) . '</td>
                <td style="padding: 10px 0; color: #1C1C1A; font-size: 14px; font-weight: 700;">' . safe_html((string)$value) . '</td>
            </tr>';
    }

    return $html;
}

function rent_email_template(
    string $title,
    string $intro,
    array $details,
    string $buttonText,
    string $buttonUrl,
    string $footerNote = ''
): string {
    $safeTitle = safe_html($title);
    $safeIntro = nl2br(safe_html($intro));
    $safeButtonText = safe_html($buttonText);
    $safeButtonUrl = safe_html($buttonUrl);
    $safeFooter = $footerNote !== '' ? safe_html($footerNote) : 'Need help? Contact renteasesupport@gmail.com.';

    return '<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>' . $safeTitle . '</title>
</head>
<body style="margin: 0; padding: 0; background: #F7F5F0; color: #1C1C1A;">
  <div style="display: none; max-height: 0; overflow: hidden;">' . $safeIntro . '</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F7F5F0; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #FFFDF8; border: 1px solid rgba(28,28,26,0.12); border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px 28px 12px; border-bottom: 1px solid rgba(28,28,26,0.10);">
              <div style="font-family: Arial, sans-serif; color: #C9A96E; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700;">RentEase</div>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 12px; color: #1C1C1A; font-family: Georgia, serif; font-size: 30px; line-height: 1.18;">' . $safeTitle . '</h1>
              <p style="margin: 0 0 22px; color: #3C3933; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65;">' . $safeIntro . '</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F7F5F0; border: 1px solid rgba(28,28,26,0.10); border-radius: 8px; padding: 8px 18px; margin-bottom: 24px;">
                ' . mail_detail_rows($details) . '
              </table>
              <a href="' . $safeButtonUrl . '" style="display: inline-block; background: #1C1C1A; color: #F7F5F0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; padding: 12px 18px;">' . $safeButtonText . '</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 18px 28px 24px; color: #6B6760; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6; border-top: 1px solid rgba(28,28,26,0.10);">
              ' . $safeFooter . '
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>';
}

function send_email(string $toEmail, string $subject, string $html, string $text = '', array $tags = []): void
{
    if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Recipient email address is invalid.');
    }

    $provider = strtolower(mail_config_value('MAIL_PROVIDER', 'smtp'));
    if ($provider === 'resend') {
        send_email_via_resend($toEmail, $subject, $html, $text, $tags);
        return;
    }

    send_email_via_smtp($toEmail, $subject, $html, $text);
}

function send_email_via_resend(string $toEmail, string $subject, string $html, string $text = '', array $tags = []): void
{
    $apiKey = mail_config_value('RESEND_API_KEY');
    if ($apiKey === '') {
        throw new RuntimeException('RESEND_API_KEY is not configured.');
    }

    $payload = [
        'from' => mail_from_header(),
        'to' => [$toEmail],
        'subject' => $subject,
        'html' => $html,
    ];

    if ($text !== '') {
        $payload['text'] = $text;
    }

    $replyTo = mail_reply_to();
    if ($replyTo !== '') {
        $payload['reply_to'] = $replyTo;
    }

    if (!empty($tags)) {
        $payload['tags'] = [];
        foreach ($tags as $name => $value) {
            $payload['tags'][] = [
                'name' => preg_replace('/[^A-Za-z0-9_-]/', '_', substr((string)$name, 0, 256)),
                'value' => preg_replace('/[^A-Za-z0-9_-]/', '_', substr((string)$value, 0, 256)),
            ];
        }
    }

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($jsonPayload === false) {
        throw new RuntimeException('Unable to encode Resend email payload.');
    }

    if (function_exists('curl_init')) {
        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $statusCode < 200 || $statusCode >= 300) {
            throw new RuntimeException('Resend email request failed with status ' . $statusCode . ($error !== '' ? ': ' . $error : ''));
        }

        return;
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'timeout' => 15,
            'ignore_errors' => true,
            'header' => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            'content' => $jsonPayload,
        ],
    ]);
    $response = @file_get_contents('https://api.resend.com/emails', false, $context);
    $statusLine = $http_response_header[0] ?? '';
    if (!is_string($response) || !preg_match('/\s2\d\d\s/', $statusLine)) {
        throw new RuntimeException('Resend email request failed.');
    }
}

function send_email_via_smtp(string $toEmail, string $subject, string $html, string $text = ''): void
{
    $username = mail_config_value('MAIL_USERNAME');
    $password = mail_config_value('MAIL_PASSWORD');
    $fromAddress = mail_from_address() ?: $username;

    if ($username === '' || $password === '' || $fromAddress === '') {
        throw new RuntimeException('SMTP mail credentials are not configured.');
    }

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = mail_config_value('MAIL_HOST', 'smtp.gmail.com');
    $mail->SMTPAuth = true;
    $mail->Username = $username;
    $mail->Password = $password;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = (int)mail_config_value('MAIL_PORT', '587');
    $mail->setFrom($fromAddress, mail_from_name());
    $mail->addAddress($toEmail);
    $mail->Subject = $subject;
    $mail->isHTML(true);
    $mail->CharSet = 'UTF-8';
    $mail->Body = $html;
    $mail->AltBody = $text !== '' ? $text : strip_tags($html);

    $replyTo = mail_reply_to();
    if ($replyTo !== '') {
        $mail->addReplyTo($replyTo);
    }

    $mail->send();
}

function send_password_reset_email(string $toEmail, string $resetLink): void
{
    $subject = 'Reset your RentEase password';
    $html = rent_email_template(
        'Reset your RentEase password',
        'We received a request to reset the password for your RentEase account.',
        [
            'Link expires' => '60 minutes',
            'Request type' => 'Password reset',
        ],
        'Reset password',
        $resetLink,
        'If you did not request this password reset, you can ignore this email.'
    );
    $text = "Reset your RentEase password: {$resetLink}\nThis link expires in 60 minutes.";

    send_email($toEmail, $subject, $html, $text, ['type' => 'password_reset']);
}

function send_reservation_submitted_email(array $reservation): void
{
    $ownerEmail = (string)($reservation['owner_email'] ?? '');
    $subject = 'New reservation request - Room ' . (string)($reservation['room_number'] ?? '');
    $dashboard = dashboard_url('/owner/reservations');
    $html = rent_email_template(
        'New reservation request',
        'A seeker submitted a reservation request for one of your rooms.',
        [
            'Applicant' => (string)($reservation['user_name'] ?? 'Applicant'),
            'Room' => (string)($reservation['room_number'] ?? 'Room'),
            'Boarding house' => (string)($reservation['house_name'] ?? 'RentEase property'),
            'Move-in date' => format_date_email($reservation['move_in_date'] ?? null),
        ],
        'Review reservation',
        $dashboard
    );
    $text = "New reservation request\nApplicant: " . (string)($reservation['user_name'] ?? '') . "\nRoom: " . (string)($reservation['room_number'] ?? '') . "\nReview: {$dashboard}";

    send_email($ownerEmail, $subject, $html, $text, ['type' => 'reservation_submitted']);
}

function send_reservation_approved_email(array $reservation): void
{
    $seekerEmail = (string)($reservation['user_email'] ?? '');
    $subject = 'Your reservation is approved - Room ' . (string)($reservation['room_number'] ?? '');
    $dashboard = dashboard_url('/dashboard/reservations');
    $html = rent_email_template(
        'Your reservation is approved',
        'Your landlord approved your RentEase reservation.',
        [
            'Room' => (string)($reservation['room_number'] ?? 'Room'),
            'Boarding house' => (string)($reservation['house_name'] ?? 'RentEase property'),
            'Move-in date' => format_date_email($reservation['move_in_date'] ?? null),
            'Landlord contact' => (string)($reservation['owner_contact_number'] ?? 'See dashboard'),
        ],
        'View reservation',
        $dashboard
    );
    $text = "Your reservation is approved\nRoom: " . (string)($reservation['room_number'] ?? '') . "\nView: {$dashboard}";

    send_email($seekerEmail, $subject, $html, $text, ['type' => 'reservation_approved']);
}

function send_reservation_rejected_email(array $reservation): void
{
    $seekerEmail = (string)($reservation['user_email'] ?? '');
    $subject = 'Update on your reservation - Room ' . (string)($reservation['room_number'] ?? '');
    $browse = dashboard_url('/rooms');
    $html = rent_email_template(
        'Update on your reservation',
        'Your reservation request was not approved. You can review the reason and browse other rooms.',
        [
            'Room' => (string)($reservation['room_number'] ?? 'Room'),
            'Boarding house' => (string)($reservation['house_name'] ?? 'RentEase property'),
            'Reason' => (string)($reservation['rejection_remarks'] ?? 'See dashboard for details'),
        ],
        'Browse other rooms',
        $browse
    );
    $text = "Reservation update\nRoom: " . (string)($reservation['room_number'] ?? '') . "\nReason: " . (string)($reservation['rejection_remarks'] ?? '') . "\nBrowse: {$browse}";

    send_email($seekerEmail, $subject, $html, $text, ['type' => 'reservation_rejected']);
}

function send_rent_payment_reminder_email(array $billing): void
{
    $tenantEmail = (string)($billing['tenant_email'] ?? $billing['user_email'] ?? '');
    $monthLabel = format_billing_month_email($billing['billing_month'] ?? null);
    $subject = 'Rent due - ' . $monthLabel;
    $dashboard = dashboard_url('/dashboard/rent');
    $html = rent_email_template(
        'Rent due - ' . $monthLabel,
        'This is a RentEase reminder for your current rent billing.',
        [
            'Tenant' => (string)($billing['tenant_name'] ?? 'Tenant'),
            'Room' => (string)($billing['room_number'] ?? 'Room'),
            'Amount due' => format_money_email((float)($billing['amount_due'] ?? 0)),
            'Billing period' => $monthLabel,
            'Due date' => format_date_email($billing['due_date'] ?? null),
            'Payment instructions' => 'Please coordinate with your landlord or view your dashboard.',
        ],
        'View payment details',
        $dashboard
    );
    $text = "Rent due - {$monthLabel}\nAmount due: " . format_money_email((float)($billing['amount_due'] ?? 0)) . "\nView: {$dashboard}";

    send_email($tenantEmail, $subject, $html, $text, ['type' => 'rent_payment_reminder']);
}

