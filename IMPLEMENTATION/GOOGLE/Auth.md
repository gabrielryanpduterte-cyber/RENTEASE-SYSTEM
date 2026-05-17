Google OAuth flow
User clicks "Sign in with Google"
→
Google popup (GSI library)
→
User selects account
Google returns ID token (JWT)
→
React sends token to POST /api/auth/google
PHP verifies token with Google
→
Extracts: email, name, google_id, picture
User exists? → login
or
New user? → auto-register as seeker
Session started + JWT issued to React
→
Redirect to /dashboard by role

Forgot password flow (email+password users only)
User clicks "Forgot password?"
→
Enter registered email
→
POST /api/auth/forgot-password
PHP generates secure token (bin2hex 32 bytes)
→
Saves to password_reset_tokens (expires 60min)
PHPMailer sends reset link to real email
→
Link: /reset-password?token=xxx
User opens link → enters new password
→
POST /api/auth/reset-password
PHP validates token (not expired, exists)
→
Password updated → token deleted → login
If Google OAuth user tries forgot password:
Show "You signed in with Google. Use Google to access your account."

Remember me flow
User checks "Remember me" on login
→
PHP generates remember token (bin2hex 64 bytes)
Saved to remember_tokens table
→
HTTP-only cookie set (30 days expiry)
User returns after session expires
→
PHP reads cookie → validates remember token
Auto-login → new session started
→
Old remember token rotated (new one issued)
