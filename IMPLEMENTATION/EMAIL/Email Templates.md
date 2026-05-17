# RentEase Email Templates

RentEase needs 5 email types. Each email is triggered by a specific system event. All templates should use one shared HTML structure so every email looks consistent with Palette 01.

## Shared Email Design

Use these design tokens:

- Background: Ivory `#F7F5F0`
- Text: Slate `#1C1C1A`
- Accent: Gold `#C9A96E`
- Font heading: Playfair Display
- Font body: DM Sans
- Card radius: 8px
- CTA button: Slate background, Ivory text

Common structure:

1. Header: RentEase name/logo
2. Main title
3. Short message
4. Detail block
5. CTA button
6. Footer: support email and security note

Use this support email in footer:

```text
renteasesupport@gmail.com
```

## 1. Password Reset

Trigger:

```text
POST /api/auth/forgot-password
```

To:

```text
The email address entered by the user
```

Subject:

```text
Reset your RentEase password
```

Content:

- User requested a password reset.
- CTA button links to:

```text
/reset-password?token=xxx
```

Expiry:

```text
60 minutes
```

Security note:

```text
If you did not request this password reset, you can ignore this email.
```

## 2. Reservation Submitted

Trigger:

```text
Seeker submits a reservation
```

To:

```text
The landlord's email
```

Subject:

```text
New reservation request - Room [X]
```

Content:

- Applicant name
- Applicant contact number
- Room name or room number
- Boarding house name
- Requested move-in date
- CTA button linking to landlord dashboard

CTA:

```text
Review reservation
```

## 3. Reservation Approved

Trigger:

```text
Landlord approves a reservation
```

To:

```text
The seeker's email
```

Subject:

```text
Your reservation is approved - Room [X]
```

Content:

- Room details
- Boarding house name
- Move-in date
- Landlord contact information
- CTA button linking to seeker dashboard

CTA:

```text
View reservation
```

## 4. Reservation Rejected

Trigger:

```text
Landlord rejects a reservation
```

To:

```text
The seeker's email
```

Subject:

```text
Update on your reservation - Room [X]
```

Content:

- Room name or room number
- Boarding house name
- Rejection reason
- Link to browse other rooms

CTA:

```text
Browse other rooms
```

## 5. Rent Payment Reminder

Trigger:

```text
Manually by landlord or automatically on billing generation
```

To:

```text
The tenant's email
```

Subject:

```text
Rent due - [Month] [Year]
```

Content:

- Tenant name
- Amount due
- Billing period
- Due date
- Payment instructions
- CTA button linking to tenant dashboard

CTA:

```text
View payment details
```

## Implementation Notes

- Do not put raw tokens in logs.
- Password reset tokens must be single-use and expire after 60 minutes.
- Reservation emails should include enough detail to be useful, but payment proofs and sensitive files should stay inside the dashboard.
- Rent payment reminders should not include private payment proof images.
- Use Resend only from the backend. Never expose `RESEND_API_KEY` to React/Vite.

