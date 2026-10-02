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
3. Run the migrations strictly in this sequential order:
   - `supabase/migrations/20260929_init_schema.sql` (Creates core tables, enums, indexes, and order structures)
   - `supabase/migrations/20260929_rls_policies.sql` (Applies Row Level Security isolation)
   - `supabase/migrations/20261002_crm_gift_codes_atomic.sql` (Atomic gift code redemption, customer notes, activity ledger)
   - `supabase/migrations/20261002_product_duplicate_prevention.sql` (Unique SKU & barcode constraint indexes)
   - `supabase/migrations/20261002_production_order_concurrency_idempotency.sql` (Order idempotency, EXPIRED status, atomic counter payments, cron cleanup)
4. Retrieve your **Project URL**, **Anon Public Key**, and **Service Role Key** from Supabase Project Settings -> API.
5. Create a public Supabase Storage bucket named `product-media`.
6. Add the credentials to your production environment variables (e.g. Vercel or cloud host).

---

## 5. Production Scheduled Tasks (Cron)
To automatically release abandoned pickup reservations:
1. Configure an external cron monitor or Vercel Cron to send an HTTP POST every 15-30 minutes:
   - Endpoint: `https://<your-domain>/api/orders/cleanup-expired`
   - Header: `Authorization: Bearer <CRON_SECRET>`
2. This runs `cleanupExpiredReservations`, releasing reserved stock back to the shelf for orders past their reservation deadline.

---

## 6. Backup, Disaster Recovery & Storage Recovery
1. **Automated Backups:**
   - In Supabase Dashboard -> Database -> Backups:
   - Ensure automated daily backups are active (retained for 7 to 30 days depending on plan).
   - For enterprise resilience, enable Point-In-Time-Recovery (PITR).
2. **Manual Physical Backup Command:**
   ```bash
   pg_dump -h db.<project-ref>.supabase.co -U postgres -d postgres --clean --if-exists > jainam_backup_$(date +%Y%m%d).sql
   ```
3. **Restoration Procedure:**
   - To restore a dump:
     ```bash
     psql -h db.<project-ref>.supabase.co -U postgres -d postgres < jainam_backup_YYYYMMDD.sql
     ```
   - If a migration fails mid-way, inspect error logs in Supabase SQL editor, rollback the specific statement, and re-apply cleanly.
4. **Storage Recovery:**
   - Storage files in `product-media` are linked to product rows via `images` array.
   - If storage is corrupted, restore bucket from backup snapshot or re-upload images from admin media tab.
5. **Authorized Person:** Only Store Owner / Database Administrator with Supabase root access should execute restoration.

---

## 7. Thermal Barcode Printer Calibration (TSC TTP-244 Pro)
1. **Physical Label Size:** 60 mm (width) × 24 mm (height) LANDSCAPE roll.
2. **Printer Driver Settings:**
   - Driver: Seagull Scientific or TSC Official Driver
   - Page Setup: Width: 60mm, Height: 24mm, Orientation: Landscape
   - Media Type: Die-Cut Label with Gap (Gap Height: 2mm - 3mm)
3. **Browser Print Settings:**
   - Margins: None (0 mm)
   - Scale: 100% (Do not fit to printable area)
   - Layout: Landscape
4. **Calibration Test:**
   - Open `/admin`, select any product, and click **Print Label**.
   - Print a single test label and scan with handheld barcode scanner or phone camera to verify 100% scannability.

---

## 8. Mobile Packaging with Capacitor

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

## 9. Admin Bootstrap Instructions
1. For initial store setup, set `ADMIN_BOOTSTRAP_SECRET` and `ADMIN_INITIAL_EMAIL` in `.env.local`.
2. Access `/admin` to log in using standard staff authentication with role-based access:
   - **Owner / Admin**: Full management of products, pricing, inventory, staff accounts, analytics, duplicate merges, and audit logs.
   - **Store Manager**: Order processing, inventory adjustments, pickup verification, customer CRM notes, and returns.
   - **Counter Staff**: Customer order lookup, QR verification, marking orders preparing/ready/picked up, and recording counter payments (Cash/UPI).

---

## 10. Production Launch Checklist
- [x] All client prices are recalculated server-side
- [x] Concurrency test passed: two customers cannot order the final unit simultaneously
- [x] Order idempotency key prevents duplicate orders on network retries
- [x] Raw stock counts are hidden from customer interfaces
- [x] Authoritative Google Maps URL verified: `https://maps.app.goo.gl/8ZJCWbBVtrHep7UcA` (22.2765869, 75.7979897)
- [x] Live Gmail SMTP connected and verified for `jainamtraders82@gmail.com`
- [x] Wishlist permanently visible in customer header with badge count
- [x] 265/265 automated test suite passed
- [x] Zero TypeScript or build errors (53/53 routes compiled)
