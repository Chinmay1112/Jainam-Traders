# Jainam Traders — Customer Authentication & Production SMTP Guide

This document specifies the architecture, setup requirements, and production configuration for Customer Authentication at Jainam Traders.

---

## 1. Customer Authentication Architecture

Customer authentication is completely passwordless and relies exclusively on **verified Supabase Auth sessions**:

1. **PRIMARY: Continue with Google (OAuth 2.0)**
   - Single-click authentication.
   - Redirects to Supabase OAuth -> Google Account Selection -> Redirects back to `/auth/callback` -> Authenticated customer session.
2. **SECONDARY: Get OTP on Email**
   - Customer submits email address.
   - Supabase generates a secure 6-digit one-time password (OTP) and delivers it via the configured production SMTP provider.
   - Customer enters the 6-digit OTP within the expiration window.
   - Supabase verifies the OTP and creates/refreshes the customer session cookie.
3. **FALLBACK: Store Direct Contact**
   - **Call Jainam Traders**: Direct telephone dialer via canonical shop phone
   - **WhatsApp Jainam Traders**: Direct WhatsApp chat link for assisted counter reservations.
4. **Staff / Admin Portal Independence**:
   - `/admin` staff login, roles (Owner, Store Manager, Counter Staff), and session tokens remain separate and untouched.

---

## 2. Google OAuth Configuration

### Step A: Google Cloud Console Setup
1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your project (e.g., `Jainam Traders Production`).
3. Navigate to **APIs & Services > Credentials**.
4. Create an **OAuth 2.0 Client ID**:
   - Application type: **Web Application**.
   - Name: `Jainam Traders Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3002` (Development)
     - `http://localhost:3000` (Local preview)
     - `https://your-production-domain.com` (Production)
   - **Authorized redirect URIs**:
     - `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**.

### Step B: Supabase Dashboard
1. Go to **Supabase Dashboard > Authentication > Providers > Google**.
2. Toggle **Enable Google provider** to ON.
3. Paste the **Client ID** and **Client Secret**.
4. Save changes.

### Step C: Redirect URL Configuration in Supabase
In **Authentication > URL Configuration**:
- **Site URL**: `http://localhost:3002` (or your production URL)
- **Redirect URLs**:
  - `http://localhost:3002/**`
  - `http://localhost:3000/**`
  - `https://your-production-domain.com/**`

---

## 3. Production SMTP & Email OTP Setup

Supabase production email authentication requires a custom SMTP provider. Free/default Supabase mail has strict rate limits (3 emails/hour).

### Supported Production SMTP Providers:
- **Resend** (Recommended for simplicity: `smtp.resend.com`, Port 587)
- **SendGrid** (`smtp.sendgrid.net`, Port 587)
- **Amazon SES** (`email-smtp.<region>.amazonaws.com`, Port 587)
- **Mailgun** (`smtp.mailgun.org`, Port 587)
- **Google Workspace SMTP Relay** (with app passwords or workspace relay)

### Store Sender Identity
- **Sender Email**: `jainamtraders82@gmail.com`
- **Sender Name**: `Jainam Traders`

> ⚠️ **SECURITY WARNING:**
> NEVER put raw Gmail passwords or SMTP credentials into Git, client-side code, or `NEXT_PUBLIC_*` variables.
> All SMTP credentials must be entered securely in the **Supabase Dashboard > Project Settings > Authentication > SMTP Settings**.

### Supabase SMTP Settings:
- **Enable Custom SMTP**: `ON`
- **Sender Email**: `jainamtraders82@gmail.com`
- **Sender Name**: `Jainam Traders`
- **Host**: Your provider SMTP host (e.g. `smtp.resend.com`)
- **Port**: `587`
- **Minimum Transfer Security**: `STARTTLS`
- **User**: Your provider username/API key
- **Pass**: Your provider password/API secret

---

## 4. Email OTP Template

Paste the contents of `supabase/templates/email-otp.html` into:
**Supabase Dashboard > Authentication > Email Templates > Magic Link / Confirmation**.

**Subject:**
`Your Jainam Traders Login Code`

**Key Body Elements:**
- Jainam Traders branding & logo
- One-time code: `{{ .Token }}`
- "Use this code to sign in to Jainam Traders."
- "Do not share this code with anyone."
- "Your code expires according to the configured authentication policy."

---

## 5. Security & Isolation Summary

1. **Passwordless Security**: Customer accounts have no passwords to leak.
2. **Customer Isolation**: Customer order queries strictly verify the authenticated Supabase session. Customers can never access other customers' orders.
3. **Resend Cooldown**: A 60-second cooldown is enforced on OTP requests to protect against email flooding.
4. **No Customer Token Confusion**: Sessions rely entirely on official Supabase Auth cookies and tokens (`@supabase/ssr`).
