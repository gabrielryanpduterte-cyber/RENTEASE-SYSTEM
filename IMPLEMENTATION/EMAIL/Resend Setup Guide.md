# Resend Setup Guide for RentEase

This guide explains how to create a Resend account, verify a sending domain, create an API key, and connect it to RentEase.

Use this support email for the RentEase sender identity:

```text
renteasesupport@gmail.com
```

Important: Resend API keys must stay in the backend environment only. Never put a Resend key in `frontend/.env`, Vite variables, React code, or browser-visible files.

## Step 1 - Create a Resend Account

1. Go to:

```text
https://resend.com
```

2. Click `Get started` or `Sign up`.
3. Register using your preferred email account.
4. Open your email inbox and verify your Resend account if prompted.
5. After login, you should land in the Resend dashboard.

## Step 2 - Add a Sending Domain

For this RentEase project, the verified Resend sending domain is:

```text
rmail.rentease.shop
```

Use this exact domain in the Resend API key domain restriction and in the backend sender address.

For production, use your own domain, for example:

```text
rentease.com
```

or a subdomain:

```text
mail.rentease.com
```

Steps:

1. In the Resend dashboard, go to `Domains`.
2. Click `Add Domain`.
3. Enter your domain or subdomain.
4. Resend will show DNS records you must add to your domain provider.
5. Copy each DNS record exactly.
6. Open your domain/DNS provider.
7. Add the DNS records.
8. Return to Resend and click `Verify DNS Records` or wait for Resend to detect them.

Common DNS records include:

- DKIM records
- SPF or sending permission records
- Return-path / bounce handling records

Exact records depend on what Resend shows in your dashboard.

## Step 3 - Wait for Domain Verification

DNS changes can take time.

Expected time:

```text
5 minutes to 24 hours
```

If verification fails:

- Check that the record `Name`, `Type`, and `Value` match Resend exactly.
- Some DNS providers automatically add your domain name, so avoid duplicating it.
- Make sure you added records to the correct domain.
- Click verify again after DNS propagation.

## Step 4 - Choose Your From Address

After the domain is verified, you can send from any address on that domain.

Recommended production sender:

```text
RentEase <support@your-domain.com>
```

Example:

```text
RentEase <support@rentease.com>
```

If you do not own a domain yet, use Resend's testing sender only for development. Production should use a verified domain to improve deliverability.

## Step 5 - Create a Resend API Key

1. In Resend dashboard, go to `API Keys`.
2. Click `Create API Key`.
3. Name it:

```text
RentEase Production
```

4. Choose permission for sending emails.
5. For `Domain`, choose:

```text
rmail.rentease.shop
```

Do not choose `All domains` unless RentEase will send emails from multiple verified domains. A domain-restricted key is safer because the key can only send from the selected domain.

6. Copy the API key immediately.
7. Store it in your backend `.env`.

Never commit this key to GitHub.

## Step 6 - Add Backend Environment Variables

For local Docker/backend:

```env
MAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=support@rmail.rentease.shop
MAIL_REPLY_TO=renteasesupport@gmail.com
FRONTEND_URL=http://localhost:5173
```

For Railway production variables:

```env
MAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
MAIL_FROM_NAME=RentEase
MAIL_FROM_ADDRESS=support@rmail.rentease.shop
MAIL_REPLY_TO=renteasesupport@gmail.com
FRONTEND_URL=https://your-frontend-domain.com
```

Do not use `VITE_` for these values. `VITE_` variables are exposed to the browser.

## Step 7 - Recommended RentEase Email Events

Connect Resend to these backend events:

1. Password reset
2. Reservation submitted
3. Reservation approved
4. Reservation rejected
5. Rent payment reminder

The first required email to test is password reset because it already exists in the current auth flow.

## Step 8 - Test Password Reset

1. Start Docker:

```powershell
docker compose up -d
```

2. Open:

```text
http://localhost:5173/forgot-password
```

3. Enter an email that exists in the `users` table.
4. Submit the form.
5. Check the inbox.
6. Click the reset link.
7. Set a new password.
8. Confirm that login works with the new password.

## Step 9 - Production Safety Checklist

Before real users use email:

- `RESEND_API_KEY` is only in backend/Railway environment variables.
- Domain is verified in Resend.
- `MAIL_FROM_ADDRESS` uses the verified domain.
- `FRONTEND_URL` points to the real frontend domain.
- Password reset emails use HTTPS links in production.
- Password reset tokens expire after 60 minutes.
- Password reset tokens are deleted after use.
- Remember-me tokens are revoked after password reset.
- Email sending failures are logged but do not expose API keys.

## Step 10 - Best Practice for RentEase

Use one reusable backend email service/helper:

```text
send_email($to, $subject, $html, $text)
```

Then create one template function per email type:

```text
password_reset_email($resetLink)
reservation_submitted_email($reservation)
reservation_approved_email($reservation)
reservation_rejected_email($reservation)
rent_payment_reminder_email($billing)
```

This keeps the system production-ready and prevents duplicated email styling across different backend files.
