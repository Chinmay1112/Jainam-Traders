# Jainam Traders — Mobile App Architecture & Production Deployment Guide
**Platforms:** Android, iOS, PWA, Web  
**Identifier:** `com.jainamtraders.app`  
**Core Framework:** Next.js (App Router) + Capacitor 7 + PostgreSQL (Supabase)  
**Business Model:** Local Retail Pickup Only &bull; Pay at Shop (Cash/UPI)

---

## 1. Unified Mobile Architecture

Jainam Traders mobile applications for Android and iOS are powered directly by the single-source-of-truth Next.js codebase via **Capacitor 7**. No separate backend, duplicate database, or Kotlin/Swift business logic rewrite is used.

```
                           ┌────────────────────────────────────────┐
                           │         JAINAM TRADERS STORE           │
                           │   Single Source of Truth (Next.js)     │
                           └──────────────────┬─────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       ┌────────────────────────┐                          ┌────────────────────────┐
       │     Customer Web       │                          │      Capacitor 7       │
       │     PWA (Desktop)      │                          │  Native Mobile Bridge  │
       └────────────────────────┘                          └───────────┬────────────┘
                                                                       │
                                              ┌────────────────────────┴────────────────────────┐
                                              ▼                                                 ▼
                                 ┌────────────────────────┐                        ┌────────────────────────┐
                                 │     Android App        │                        │        iOS App         │
                                 │   (Android Studio)     │                        │        (Xcode)         │
                                 └────────────────────────┘                        └────────────────────────┘
                                              │                                                 │
                                              └────────────────────────┬────────────────────────┘
                                                                       │
                                                                       ▼
                                                    ┌─────────────────────────────────────┐
                                                    │          Supabase Backend           │
                                                    │  PostgreSQL 15 + RLS + Storage Auth │
                                                    └─────────────────────────────────────┘
```

---

## 2. Configured Native Projects

### 2.1 Android Configuration
- **Project Location:** `android/`
- **Application ID:** `com.jainamtraders.app` (configurable in `android/app/build.gradle`)
- **Version Code:** `1`
- **Version Name:** `1.0.0`
- **Minimum SDK:** `22` (Android 5.1 Lollipop)
- **Target / Compile SDK:** `34` (Android 14)
- **Manifest (`android/app/src/main/AndroidManifest.xml`):**
  - **Permissions (Strictly Necessary Only):**
    - `android.permission.INTERNET`
    - `android.permission.CAMERA`
    - `android.permission.POST_NOTIFICATIONS`
    - *Explicitly Excluded:* Background Location, Contacts, Microphone, SMS, Call Logs.
  - **Deep Link Intent Filters:**
    - Scheme: `jainamtraders://`
    - App Links: `https://jainamtraders.com` and `https://www.jainamtraders.com` (with `autoVerify="true"`)
  - **Signing:** Configured to read secure environment variables (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) without hardcoded secrets in version control.

### 2.2 iOS Configuration
- **Project Location:** `ios/`
- **Bundle Identifier:** `com.jainamtraders.app`
- **Info.plist (`ios/App/App/Info.plist`):**
  - `NSCameraUsageDescription`: *"Jainam Traders uses camera access to allow you to take and attach photos of purchased items for customer reviews."*
  - `NSPhotoLibraryUsageDescription`: *"Jainam Traders accesses your photo library so you can select and upload photos for customer reviews."*
  - Custom URL Scheme: `jainamtraders://`
  - Safe-area inset compatibility: Enabled via `viewport-fit=cover` and CSS `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`.

---

## 3. Mobile Navigation & Touch Ergonomics

The application implements a dedicated mobile layout tailored for one-handed thumb interaction:
1. **Persistent Mobile Bottom Bar:**
   - **Home (`/`):** Featured products, store highlights, physical address
   - **Categories (`/categories`):** Gift items, photo frames, clocks, watches, purses, toys, stationery
   - **Search (`/search`):** Instant search with category filters and stock availability indicators
   - **Wishlist (`/wishlist`):** Quick-access saved items with badges
   - **Cart (`/cart`):** Active cart drawer / screen with real-time total calculation
   - **Account (`/account`):** Orders, profile, notification toggles, store directions
2. **Android Hardware Back Button:**
   - Handled via `@capacitor/app` `backButton` listener in [capacitor-bridge.ts](file:///d:/shop%20app/src/lib/native/capacitor-bridge.ts).
   - Dismisses open modals/sheets first.
   - Navigates backward through browsing history (`window.history.back()`).
   - If on the root screen (`/`), safely prompts or exits without trapping the user.

---

## 4. Deep Linking Specifications

The application handles both custom schemes and verified HTTPS universal/app links:

| Link Format | Target Screen | Authentication Required |
|---|---|---|
| `https://jainamtraders.com/products/[slug]` | Product Detail View | No (Public) |
| `jainamtraders://products/[slug]` | Product Detail View | No (Public) |
| `https://jainamtraders.com/categories/[slug]` | Category Catalogue | No (Public) |
| `https://jainamtraders.com/orders/[orderNumber]` | Secure Order QR Pass & Status | Yes (Owner/Phone match) |
| `https://jainamtraders.com/pickup-info` | Physical Store Directions & Timings | No (Public) |

---

## 5. Native Device Integrations

### 5.1 Camera & Review Photos
- Uses `@capacitor/camera` (`CameraSource.Prompt`).
- Customers can take a photo or select from their gallery when submitting reviews for purchased items.
- Client-side validation: Max 5MB, format JPEG/PNG/WebP.
- Automatic image compression before upload to Supabase Storage bucket `review-images`.

### 5.2 QR Code Order Pickup Pass
- Generated dynamically on the order confirmation screen (`/orders/[id]`).
- Encodes an opaque pickup token: `JT-ORDER-QR:{id}:{order_number}:{pickup_token}`.
- Contains **no plain credit card numbers, passwords, or customer PII**.
- Store staff scan the QR code via the Admin Dashboard (`/admin`) to verify order authenticity and mark "PICKED UP".

### 5.3 Fixed Store Location & Directions
- No background tracking or intrusive GPS permissions.
- "Get Directions" button triggers [openMapDirections()](file:///d:/shop%20app/src/lib/native/capacitor-bridge.ts), launching Google Maps or Apple Maps with the shop's exact destination address.

### 5.4 Phone Dialer & WhatsApp Integration
- "Call Jainam Traders": Opens native phone dialer (`tel:<canonical_shop_phone>`) with user confirmation.
- "WhatsApp Jainam Traders": Opens WhatsApp (`https://wa.me/<canonical_whatsapp_number>?text=...`) prefilled with order details (e.g. *"Hi Jainam Traders, I have an inquiry about order JT-2026-000123."*).

### 5.5 Native Sharing
- Web Share API and `@capacitor/share` invoked with canonical public URLs.

---

## 6. Offline Safeguards & Connectivity Policy

1. **Connectivity Detection:**
   - Monitored continuously via `@capacitor/network` and browser `navigator.onLine`.
   - If internet is lost, a non-intrusive offline notification banner appears.
2. **Strict Transactional Rule:**
   - Browsing cached catalogues and viewing existing pickup order details is permitted.
   - **Placing reservations, modifying cart reservations, or processing returns is strictly blocked while offline** to prevent inventory race conditions.
   - Checkout button is disabled with the warning: *"You are currently offline. Please reconnect to confirm your order."*

---

## 7. Unified Authentication & Cart Synchronization

- **Supported Auth:** Phone OTP, Email Magic Link / OTP, Google OAuth, and Guest Browsing.
- **Cart Sync:**
  - Guests can add items to local storage cart.
  - When the customer signs in on Web, PWA, or Android app, local items merge into their account cart without duplicates.
  - Cart reservations expire after 48 hours if uncollected, automatically returning reserved units to available stock.

---

## 8. Exact Android Build & Verification Commands

All commands have been verified on the project:

### 8.1 Prepare & Sync Web Assets
```bash
# 1. Prepare offline shell and copy static assets to out/
npm run cap:prepare

# 2. Sync web assets and plugins to Android & iOS native directories
npm run cap:sync
```

### 8.2 Android Studio & Gradle Build
```bash
# Open project in Android Studio
npm run cap:android

# Or run Gradle build directly from terminal (requires JDK 17+ configured):
cd android

# Build Debug APK (outputs to android/app/build/outputs/apk/debug/app-debug.apk)
.\gradlew.bat assembleDebug

# Build Production Release APK
.\gradlew.bat assembleRelease

# Build Production Android App Bundle (.aab) for Google Play Store
.\gradlew.bat bundleRelease
```

### 8.3 Release Keystore Signing Configuration
To sign the production build securely without hardcoding passwords in Git:
```bash
# Set environment variables before running bundleRelease
$env:KEYSTORE_PATH="C:\path\to\jainamtraders-release.keystore"
$env:KEYSTORE_PASSWORD="YourKeystorePassword"
$env:KEY_ALIAS="jainamtraders"
$env:KEY_PASSWORD="YourKeyPassword"

cd android
.\gradlew.bat bundleRelease
```

---

## 9. Google Play Store & Apple App Store Checklist

### 9.1 Google Play Store Requirements
- [x] **App ID:** `com.jainamtraders.app`
- [x] **Target SDK:** API 34 (Android 14)
- [x] **Signed Bundle:** Generated via `gradlew bundleRelease` (`.aab` format)
- [x] **App Icon:** Adaptive launcher icon with 512x512 high-res asset
- [x] **Feature Graphic:** 1024 x 500 px promotional banner
- [x] **Data Safety Form:**
  - *Data collected:* Name, Phone, Email (for pickup reservations & account authentication).
  - *Data shared with third parties:* None.
  - *Location tracking:* None.
  - *Financial information:* None (no online payments collected).
- [x] **Privacy Policy URL:** `https://jainamtraders.com/privacy`
- [x] **Terms of Service URL:** `https://jainamtraders.com/terms`

### 9.2 Apple App Store Requirements
- [x] **Bundle ID:** `com.jainamtraders.app`
- [x] **App Category:** Shopping / Retail
- [x] **Privacy Manifest:**
  - Camera usage: Photo attachment for customer reviews
  - Photo library usage: Review image upload
- [x] **In-App Purchases:** Not applicable (Goods are physical items collected and paid at the physical shop)

---

## 10. Automated Tests & Quality Assurance

Run the test suite to verify pricing, security, concurrency, and mobile bridge logic:
```bash
npm test
```
All 19 tests pass:
- Concurrency reservation & race-condition prevention (Row-Level Locking)
- Cart pricing & coupon discount logic
- Security validation & customer PII protection
- Mobile native intents, WhatsApp URI formatting, and deep link routing
- Offline transaction blocking rules
