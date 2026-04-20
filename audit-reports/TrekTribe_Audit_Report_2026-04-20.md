# TrekTribe VPS + Live Site Audit Report

Date: 2026-04-20
Audited URL: https://tripe.sbpgm.com
Server: ubuntu@129.159.22.229 (read-only audit)
Scope: Security checks, runtime bugs, mobile compatibility, and feature parity vs `D:\downloads\Trekk_Tribe_Features.docx`

## 1. Executive Summary
- Live app is running and reachable over HTTPS.
- Core travel flow components exist in codebase (auth, trips, bookings, coupons, reviews, organizer/admin modules).
- Major gaps found in production UX and feature parity: broken/missing routes (`/blogs`, `/bookings`, `/wallet`, `/discover`), no blog UI, wallet/referral missing, and some feature modules exist only backend-side.
- Security posture has good baseline middleware, but important exposure exists (`/metrics`, verbose `/health`) and dependency risk is high.

## 2. Critical / High Findings

### F1 - Public metrics endpoint exposed (High)
Evidence:
- `GET https://tripe.sbpgm.com/metrics` returns full Prometheus metrics publicly.
- Response includes process/runtime internals (memory, Node version, route-level counters, auth failure counts).
Code evidence:
- `services/api/src/index.ts` mounts `app.get('/metrics', metrics.metricsEndpoint);` without auth guard.
Impact:
- Internal telemetry and route behavior become publicly enumerable.

### F2 - Sensitive runtime details exposed on health endpoint (Medium-High)
Evidence:
- `GET https://tripe.sbpgm.com/health` returns memory usage, uptime, socket status, Node version.
Code evidence:
- `services/api/src/index.ts` health handler returns `memory`, `uptime`, `version` fields.
Impact:
- Useful recon data for attackers; should be restricted or reduced for public access.

### F3 - Auth/session endpoint frequently rate-limited causing user-facing degradation (High)
Evidence:
- `GET /auth/me` currently returns `429` (`RateLimit-Limit: 20` exhausted).
- Browser logs show `Session verification failed ... 429` on page loads.
Code evidence:
- `services/api/src/index.ts` applies `authLimiter` on `/auth` routes.
- Frontend `AuthContext` uses `/auth/me` for session verification (`web/src/contexts/AuthContext.tsx`).
Impact:
- Users can hit rate-limit during normal navigation/session checks, causing false "network/timeout" behavior.

### F4 - CORS rejection path returns 500 instead of clean 403/blocked response (Medium)
Evidence:
- Requests with disallowed `Origin` return `500` on `/api/cms/public/home`.
- Server error logs show `Error: Not allowed by CORS` as unhandled.
Code evidence:
- CORS callback throws `new Error('Not allowed by CORS')` (`services/api/src/index.ts`), then global error handler emits 500.
Impact:
- Incorrect status code, noisy error logs, operational confusion.

### F5 - Password policy inconsistency on reset flow (Medium)
Evidence:
- Register requires strong password policy (10 chars + complexity).
- Reset password accepts `newPassword: z.string().min(6)`.
Code evidence:
- `services/api/src/routes/auth.ts`.
Impact:
- Users can downgrade security via reset flow.

### F6 - Hardcoded demo credentials in code (Medium)
Evidence:
- `services/api/src/routes/seed.ts` contains fixed demo emails/passwords.
Impact:
- Even with token-protected route, hardcoded credential patterns are risky and should not live in production source.

### F7 - Dependency vulnerability footprint is high (High)
API (`services/api`):
- 25 vulnerabilities (9 low, 4 moderate, 10 high, 2 critical).
- Includes critical/high advisories (`protobufjs`, `xlsx`, `express-rate-limit`, `cloudinary`, `lodash`, etc.).
Web (`web`):
- 37 vulnerabilities (9 low, 7 moderate, 20 high, 1 critical).
- Includes `react-scripts` chain advisories and critical `protobufjs`.

## 3. Functional Bugs / Product Issues

### B1 - Production route mismatches and dead paths (High)
Observed:
- `/discover`, `/blogs`, `/bookings`, `/wallet` do not deliver expected pages.
- `/discover`, `/blogs`, `/bookings` render shell/footer-like blank state in production.
- `/trip/1` often lands on "Loading... The page will refresh automatically" fallback.
Code evidence:
- `web/src/App.tsx` defines routes like `/trips`, `/my-bookings`, but not `/discover`, `/blogs`, `/bookings`, `/wallet`.

### B2 - Footer contains dead links (Medium)
Evidence:
- Footer links include `/stories`, `/join-as-organizer`, `/organizer-stories`, `/guidelines`.
- These routes are not defined in `web/src/App.tsx`.
Code evidence:
- `web/src/components/Footer.tsx`.

### B3 - Trip listing data quality bug visible in UI (Medium)
Evidence:
- Trips page cards show `INVALID DATE` and `0/ SPOTS` across multiple listings.
Impact:
- Major trust/UX issue; indicates date/participant mapping mismatch in UI data formatting.

### B4 - Google auth not configured in production UX (Medium)
Evidence:
- Browser console warning repeatedly shows: `Google Client ID not configured`.
Impact:
- Documented feature exists in code but unavailable in live environment.

### B5 - SEO domain mismatch on robots/sitemap (Low-Medium)
Evidence:
- `robots.txt` and `sitemap.xml` served with `https://trektribe.com/...` while live domain is `https://tripe.sbpgm.com`.
Impact:
- Search indexing/canonical signals inconsistent for current deployment domain.

## 4. Mobile Compatibility Assessment

Method:
- Real mobile viewport screenshots via `agent-browser`.
- Lighthouse mobile run on `/trips`.

Results:
- Lighthouse Mobile (`/trips`):
  - Performance: 68
  - Accessibility: 94
  - Best Practices: 92
  - SEO: 100
  - LCP: ~7239 ms (slow)
- Lighthouse Desktop (`/trips`):
  - Performance: 89
  - Accessibility: 90
  - Best Practices: 92
  - SEO: 100
- Mobile UI concerns:
  - Cookie modal dominates viewport and blocks immediate interaction.
  - Bottom-nav text contrast issues reported by Lighthouse.
  - Non-existent routes on mobile show blank shell, causing broken journey.

## 5. Feature Parity vs `Trekk_Tribe_Features.docx`

Status legend: `Implemented`, `Partial`, `Missing`

1. Platform overview (travel marketplace): `Implemented`
2. User roles & permissions (traveler/organizer/admin): `Implemented`
3. Trip management basics (title, desc, itinerary, pricing, capacity, categories): `Implemented`
4. Trip editing rules (locked fields with bookings, change logs, admin override): `Partial`
5. Booking system (selection, confirmation, cancellation, refunds): `Partial` (no clear waiting-list implementation found)
6. Payment system (gateway + secure checkout): `Implemented` (Razorpay-centric)
7. Coupon system (organizer + admin + advanced constraints): `Implemented`
8. Dashboards (traveler/organizer/admin): `Implemented`
9. Reviews & ratings: `Implemented`
10. Communication (chat + notifications + email/SMS alerts): `Partial` (modules exist; live readiness/config mixed)
11. Search & discovery filters/sorting: `Implemented` (via `/trips` and search modules)
12. AI features future: `Partial` (code present, feature-flag/off in production)
13. Security controls (KYC, secure flows, fraud controls): `Partial`
14. Legal pages (terms/privacy/refund/GST): `Partial` (some legal pages exist)
15. Commission tracking/configurable %: `Implemented` (config + payment modules)
16. Wallet (refund credits/cashback): `Missing` (no complete wallet product flow/UI found)
17. Analytics: `Partial` (routes/components exist; operational completeness not fully verifiable without auth)
18. Referral codes/rewards: `Missing`
19. Extra features (reminders, invoice PDF, loyalty, maps, sharing): `Partial`
20. MVP must-have set: `Partial` (core present, but live route/function gaps remain)

## 6. Source vs Runtime Notes
- Source inspected from `/home/trektribe/app/current`.
- Live runtime is served from built bundle under `/home/trektribe/app/current/web/build` and API dist under `services/api/dist`.
- PM2 process (as `trektribe`) is running (`trektribe-api`) with restart count ~20 in ~22h uptime window.

## 7. Recommended Fix Priority

P0 (Immediate)
1. Protect `/metrics` (auth/internal network allowlist).
2. Reduce `/health` public payload or gate it.
3. Fix `/auth/me` rate-limit policy to avoid session-check lockouts.
4. Patch route mismatches/dead links (`/blogs`, `/bookings`, `/wallet`, footer dead routes).

P1 (Next)
1. Align password reset policy with registration strength policy.
2. Resolve CORS rejection to non-500 behavior.
3. Fix `INVALID DATE` listing data mapping.
4. Configure Google Client ID properly if Google login is required.

P2 (Planned)
1. Dependency remediation plan for high/critical advisories.
2. Implement missing wallet/referral/blog UX per feature document.
3. Improve mobile performance (LCP) and contrast findings.

## 8. Audit Artifacts (Local)
- Screenshots folder: `D:\Trektribe plan\trektribe\audit-artifacts\screenshots`
- Route behavior JSON: `D:\Trektribe plan\trektribe\audit-artifacts\route-behavior.json`
- Lighthouse mobile: `D:\Trektribe plan\trektribe\audit-artifacts\lighthouse-trips-mobile.json`
- Lighthouse desktop: `D:\Trektribe plan\trektribe\audit-artifacts\lighthouse-trips-desktop.json`
- Feature doc extracted text: `D:\Trektribe plan\trektribe\features_extracted.txt`

## 9. Change Control
- No code changes were made on VPS or source during this audit.
- All actions were read-only analysis and runtime validation.
