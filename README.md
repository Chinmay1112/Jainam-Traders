# Jainam Traders — Production E-Commerce & Store Pickup Application

> **A Real, Production-Ready Web, PWA, Android & iOS Application for Jainam Traders**
> **Business Model:** Discover Online → Reserve Items → Inspect at Counter → Pay at Shop (Cash or UPI).

---

## 🌟 Key Features

### 🛍️ Customer Storefront Experience
- **Modern Bespoke Aesthetic**: Tailored Indian retail & gift store visual identity (Warm Terracotta `#B84A1C`, Saffron Amber `#D97706`, Soft Pearl `#FAF8F5`).
- **Catalog & Fuzzy Search**: 30 realistic retail products (Photo frames, wall clocks, wristwatches, brass mementos, leather belts & purses, executive pens, toys). Typo-tolerant search (`photoframe` finds `Photo Frame`).
- **Stock Privacy (Rule 10)**: Raw numbers are strictly hidden from customers; display shows *Available for pickup* or *Currently unavailable*.
- **Pickup Cart & Revalidation**: Zero advance fees. All prices, stock, and coupon discounts are evaluated strictly server-side.
- **Flexible Pickup Modes**:
  - **Mode A (Flexible)**: 3-day hold window for immediate preparation.
  - **Mode B (Scheduled)**: Customer selects pickup date and time window.
- **Counter Digital Pass**: Dynamic QR code generated for every order (`JT-2026-XXXXXX`) for presentation at the physical store counter.
- **Verified Purchase Reviews**: Only customers who collected and paid for the item at the counter can submit reviews.
- **In-App AI Concierge & Support**: Tool-calling assistant retrieving real-time stock, pricing, and shop hours without hallucination, with WhatsApp escalation.

### 🏢 Store Operations & Admin Console (`/admin`)
- **Order State Machine**: Strict transitions (`PENDING` → `CONFIRMED` → `PREPARING` → `READY_FOR_PICKUP` → `PICKED_UP`; `CANCELLED`; `RETURN_REQUESTED` → `RETURN_APPROVED` → `RETURNED` → `REFUND_RECORDED`).
- **Inventory Reservation Engine**: Prevents double-booking during checkout. Automatically releases reserved units on cancellation and finalizes deduction on pickup.
- **Physical Counter Verification**: Scan QR pass or search Order ID to retrieve order, inspect items with customer, and record Cash/UPI payment.
- **Physical Refund Ledger**: Records Cash and UPI refunds with receipt number and staff signature.
- **Printable Receipts**: Clean, print-friendly layout formatted for thermal counter and A4 printers.
- **Role-Based Access Control**: Store Owner, Store Manager, and Counter Staff permissions.
- **Shop Settings Management**: Edit address, Google Maps link, phone, WhatsApp number, opening hours, closed days, and pickup instructions.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin](http://localhost:3000/admin) for the management console.

### 3. Run Automated Tests
```bash
npm test
```
Runs 14 automated tests covering server-side pricing, coupons, the order state machine, security validation, and the mandatory **concurrency reservation test** (verifying that two simultaneous orders cannot reserve the final remaining unit).

### 4. Build for Production
```bash
npm run build
```

---

## 📱 Mobile Packaging (PWA, Android & iOS)
- **Installable PWA**: Configured with `public/manifest.json`, app icons, and `public/sw.js` for offline app shell caching.
- **Capacitor Android**: Native Android project in `android/`. Run `npx cap open android`.
- **Capacitor iOS**: Native Xcode project in `ios/`. Run `npx cap open ios`.

---

## 🗄️ Database & Schema
- Full PostgreSQL / Supabase migration in `supabase/migrations/20260929_init_schema.sql`
- Row Level Security policies in `supabase/migrations/20260929_rls_policies.sql`
- Complete seed data with 30 realistic products in `supabase/seed.sql`

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full architecture and production deployment documentation.
