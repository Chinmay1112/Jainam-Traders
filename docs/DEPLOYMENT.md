# JAINAM TRADERS - DEPLOYMENT & OPERATION GUIDE

## 1. Prerequisites
- Node.js v18+ or v20+ / v22+
- npm v9+ or v10+
- Git
- (Optional for Mobile) Android Studio for Android APK/AAB, Xcode (macOS only) for iOS build

---

## 2. Local Development Setup
```bash
# 1. Clone repository and navigate to folder
cd "shop app"

# 2. Install dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env.local

# 4. Start local development server
npm run dev

# 5. Open your browser
# Storefront: http://localhost:3000
# Admin Console: http://localhost:3000/admin
```

---

## 3. Automated Testing
Run the comprehensive test suite (Unit, Concurrency, and Security tests):
```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

---

## 4. Production Database Deployment (Supabase)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase project dashboard.
3. Run the migrations in sequence:
   - `supabase/migrations/20260929_init_schema.sql` (Creates all tables, enums, indexes, and atomic RPC functions)
   - `supabase/migrations/20260929_rls_policies.sql` (Applies Row Level Security)
   - `supabase/seed.sql` (Seeds initial shop settings, categories, 30 retail products, coupons, and offers)
4. Retrieve your **Project URL**, **Anon Public Key**, and **Service Role Key** from Supabase Project Settings -> API.
5. Add them to your production environment variables (e.g., in Vercel, Netlify, or Docker).

---

## 5. Mobile Packaging with Capacitor

### Android Build
```bash
# 1. Build the web distribution
npm run build

# 2. Synchronize web assets with the native Android project
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. In Android Studio, build signed APK / Android App Bundle (AAB) for Google Play.
```

### iOS Build (Requires macOS + Xcode)
```bash
# 1. Build the web distribution
npm run build

# 2. Synchronize web assets with the native Xcode project
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# 4. In Xcode, select your Apple Developer Team and build for App Store or TestFlight.
```

---

## 6. Admin Bootstrap Instructions
1. For initial store setup, set `ADMIN_BOOTSTRAP_SECRET` and `ADMIN_INITIAL_EMAIL` in `.env.local`.
2. When launching the admin portal at `/admin`, the store owner can log in or switch roles between:
   - **Owner / Admin**: Full control over shop settings, categories, pricing, products, staff roles, and analytics.
   - **Store Manager**: Order workflow management, stock adjustments, pickup verification, and refund recording.
   - **Counter Staff**: Scanning customer order QR passes, marking orders as preparing/ready/picked up.

---

## 7. Production Launch Checklist
- [x] All client prices are recalculated server-side
- [x] Concurrency test passed: two customers cannot order the final unit simultaneously
- [x] Raw stock counts are hidden from customer interfaces
- [x] State machine enforces valid order transitions
- [x] Digital QR pass generated for every order
- [x] Thermal/A4 printable receipt formatted
- [x] PWA web manifest and offline service worker configured
- [x] Native Android and iOS projects generated with Capacitor
- [x] Real database migrations and realistic seed data provided
