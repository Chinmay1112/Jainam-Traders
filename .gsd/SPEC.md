# SPEC.md — Project Specification

> **Status**: `FINALIZED`
>
> ⚠️ **Planning Lock**: Specification baseline is locked for Jainam Traders.

## Vision
Jainam Traders is a high-reliability local retail and gift commerce web and mobile application built on a store-pickup model (Discover & Reserve Online → Inspect in Person at Counter → Pay at Shop via Cash or UPI). It provides seamless digital discovery and reservation guarantees without requiring third-party payment gateways or delivery couriers.

## Goals
1. **Digital Discovery & Reservation** — Enable customers to browse inventory with real-time stock availability indicators and reserve products for store pickup.
2. **Deterministic Order Lifecycle** — Enforce a strict state machine across order placement, confirmation, preparation, pickup, and returns with full auditability.
3. **Multi-Platform Access** — Provide an accessible web experience, PWA capabilities, and native Android & iOS mobile applications via Capacitor.
4. **Inclusive Customer Usability** — Provide bilingual voice search (Hindi & English) and an assisted Simple Mode with enlarged tap targets and voice guidance for village and low-literacy shoppers.
5. **AI Store Concierge** — Integrate a secure AI assistant capable of catalog queries, store hours, and order tracking with strict prompt-injection defenses.

## Non-Goals (Out of Scope)
- No online payment gateway processing (Razorpay, Stripe, etc.) — all transactions settle in person via Cash or UPI.
- No third-party courier or shipping logistics — all orders are fulfilled via physical counter collection.
- No public exposure of raw backroom inventory levels — stock availability is communicated via semantic availability states.

## Constraints
- **Platform Stack**: Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS.
- **Database**: PostgreSQL on Supabase with Row Level Security (RLS) policies.
- **Mobile Bridge**: Capacitor 7/8 with Android SDK 35 (minSdkVersion 24) and iOS targets.
- **Security & Quality**: Zero type assertions or `@ts-ignore`, full Vitest test suite coverage, and strict prompt injection guards.

## Success Criteria
- [x] Full end-to-end checkout and reservation flow with QR code pickup verification.
- [x] Deterministic order state machine with atomic row-lock concurrency control.
- [x] Zero-leak AI concierge with jailbreak detection.
- [x] Production web build pre-rendered and verified.
- [x] Native Android APK compiled and tested.
- [x] 44/44 unit and integration test suite passing.

## Technical Requirements

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Store Catalog & Semantic Availability | Must-have | Real-time Supabase sync with privacy protection |
| Physical Counter Pickup & QR Verification | Must-have | Unique order codes `JT-YYYY-XXXXXX` with printable receipt generation |
| Concurrency Control on Reservation | Must-have | PostgreSQL row locking preventing stock overselling |
| Voice Search & Low-Literacy Mode | Must-have | Bilingual Web Speech API with audio feedback |
| Cross-Platform Capacitor Support | Must-have | Mobile wrapper for camera, haptics, share, and push notifications |

---

*Last updated: 2026-10-01*
