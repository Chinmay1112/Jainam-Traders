---
milestone: Milestone 1: Production Core & Mobile Apps
version: 1.0.0
updated: 2026-10-01T08:50:00Z
---

# Roadmap

> **Current Phase:** 5 - Production Hardening & Native Builds
> **Status:** complete

## Must-Haves (from SPEC)

- [x] Store Catalog & Semantic Stock Availability
- [x] Counter Pickup & QR Verification System
- [x] Concurrency & Atomic Inventory Reservation Engine
- [x] Bilingual Voice Search & Simple Assisted Mode
- [x] Cross-Platform Capacitor Mobile Sync & Android Build

---

## Phases

### Phase 1: Core E-Commerce & Inventory Foundation
**Status:** ✅ Complete
**Objective:** Establish Next.js App Router foundation, Supabase PostgreSQL schemas, and product catalog with semantic availability.
**Requirements:** REQ-01, REQ-02

**Plans:**
- [x] Plan 1.1: Database schema, RLS policies, and product catalog models
- [x] Plan 1.2: Store catalog UI, search, category filtering, and responsive layout

---

### Phase 2: Order State Machine & In-Store Counter Pickup
**Status:** ✅ Complete
**Objective:** Implement deterministic order state transitions, QR code verification, staff management, and printable receipts.
**Requirements:** REQ-03, REQ-04

**Plans:**
- [x] Plan 2.1: Order lifecycle state machine and checkout reservation flow
- [x] Plan 2.2: Staff pickup portal, QR scanner integration, and thermal receipt formatting

---

### Phase 3: High-Concurrency Reservation Engine & Audit Safety
**Status:** ✅ Complete
**Objective:** Eliminate stock overselling via PostgreSQL atomic row locks and validate concurrency safety under burst traffic.
**Requirements:** REQ-05

**Plans:**
- [x] Plan 3.1: Atomic inventory reservation RPC with `SELECT FOR UPDATE` locks
- [x] Plan 3.2: Concurrency test suite simulating simultaneous checkouts

---

### Phase 4: Inclusive Accessibility & Spoken Voice UX
**Status:** ✅ Complete
**Objective:** Deliver assisted Simple Mode for village/elderly shoppers and bilingual Hindi/English voice search.
**Requirements:** REQ-06

**Plans:**
- [x] Plan 4.1: Simple Mode context with high-contrast UI, enlarged touch targets, and speech synthesis
- [x] Plan 4.2: Web Speech API integration, natural conversational query parser, and voice search modal

---

### Phase 5: Production Hardening, Security & Mobile Apps
**Status:** ✅ Complete
**Objective:** Hardened AI assistant defenses, complete test suite, Capacitor plugins sync, and native Android APK release build.
**Requirements:** REQ-07, REQ-08

**Plans:**
- [x] Plan 5.1: AI concierge prompt injection guards and credential shielding
- [x] Plan 5.2: Capacitor native mobile packaging, Android SDK 35 build, and 44 unit/integration tests

---

## Progress Summary

| Phase | Status | Plans | Complete |
|-------|--------|-------|----------|
| 1 | ✅ | 2/2 | 100% |
| 2 | ✅ | 2/2 | 100% |
| 3 | ✅ | 2/2 | 100% |
| 4 | ✅ | 2/2 | 100% |
| 5 | ✅ | 2/2 | 100% |

---

## Timeline

| Phase | Started | Completed | Duration |
|-------|---------|-----------|----------|
| 1 | 2026-09-01 | 2026-09-08 | 7 days |
| 2 | 2026-09-09 | 2026-09-15 | 6 days |
| 3 | 2026-09-16 | 2026-09-20 | 4 days |
| 4 | 2026-09-21 | 2026-09-25 | 4 days |
| 5 | 2026-09-26 | 2026-09-29 | 3 days |
