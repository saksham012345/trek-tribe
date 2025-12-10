# Trek Tribe – Presentation Ready Summary

## 1) Product Snapshot
- Modern travel marketplace + organizer console with CRM, trip creation, booking, payment verification, and flexible lead management.
- Dual payment flows for organizers: **Automated & trusted (Razorpay-style QR)** or **Manual screenshot (lower trust, manual verification)**.
- Professional CRM with real-time auto-refresh, KPI cards, activity feed, conversion funnel, and analytics tabs.

## 2) Key Features
- **Trip management**: Create trips with packages, schedules, pickup/drop points, itinerary PDF, live photos, thumbnail auto-pick, safety info.
- **Payment configuration**: Full/advance payments, refund policies, choice of collection mode (Razorpay vs manual), verification mode, manual proof requirement flag, gateway QR metadata.
- **Payment verification**: Organizer QR generation, verification history, deactivate/reactivate, manual proof flow, trusted amount-specific QR generator.
- **CRM**: Dashboard/leads/analytics tabs, auto-refresh (30s), recent activity, conversion funnel, lead distribution, 7-day trends, KPI cards, profile verification warning.
- **Payment Verification Dashboard**: Shows verification code QR, stats, history, and trusted amount QR generator.
- **Safety & trust**: Profile completion checks, subscription gating, lead verification states.

## 3) Recent Additions (this iteration)
- Organizer choice: Razorpay trusted QR (automated) or manual screenshot (less trusted).
- Amount-specific trusted QR endpoint (`/payment-verification/generate-amount-qr`) and UI blocks (Create Trip + PaymentVerificationDashboard).
- Payment config schema extended with `collectionMode`, `verificationMode`, `manualProofRequired`, `trustLevel`, `gatewayQR` metadata.
- Manual mode enforces QR upload; automated mode skips manual QR requirement and uses trusted QR payload.
- Organizer-facing guide (`PAYMENT_OPTIONS_GUIDE.md`).

## 4) Tech Stack
- **Frontend**: React + TypeScript, Tailwind CSS, React Router, React.lazy for code splitting, Toast notifications.
- **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB), Zod validation, QRCode generation, crypto.
- **Build/Deploy**: Docker (api/web), render/vercel configs present, nginx for web static.
- **Payments**: Razorpay-style payloads for trusted QR, manual QR uploads for fallback.

## 5) Key Endpoints (Payments/Verification)
- `POST /payment-verification/generate-code` – organizer QR for verification.
- `GET /payment-verification/active-code` – current code/QR.
- `POST /payment-verification/verify-payment` – record payment by QR code.
- `POST /payment-verification/generate-amount-qr` – trusted amount-specific QR (Razorpay-style).
- `GET /payment-verification/history` – verified payments.
- Trip creation enforces manual QR only when `collectionMode === 'manual'`.

## 6) Production Readiness Checklist
- [ ] Backend build/test: `cd services/api && npm install && npm run build && npm test` (no tests auto-discovered via runner; ensure suites exist).
- [ ] Frontend build: `cd web && npm install && npm run build`.
- [ ] Env vars: set Razorpay keys, DB URI, JWT secrets, CORS origins, file upload base URL.
- [ ] Run `docker compose build` (api, web) and `docker compose up -d` smoke test.
- [ ] Validate payment QR flows: generate trusted QR, scan, verify payment; manual flow with screenshot and manual verification.
- [ ] CRM smoke test: auto-refresh, activity feed, analytics, lead status updates.
- [ ] Organizer create-trip: both payment modes, advance/full payments, file uploads (images/PDF/QR), package variants.
- [ ] Security: ensure auth middleware on organizer routes; confirm public verify-payment route as intended.

## 7) Presentation-Ready Talking Points
- **Value**: Organizers choose secure automated payments or manual fallback; customers see higher trust with automated QR.
- **Data**: Real-time CRM with auto-refresh and trends reduces response time to leads.
- **Flexibility**: Ultra-flexible trip schema (tolerant parsing), package variants, advance/full payments.
- **Trust & Compliance**: Verification workflows, profile completeness checks, subscription gating.

## 8) Known Gaps / Actions
- Automated tests not discovered in runner; run project-level suites locally (backend/frontend) and add CI.
- Ensure Razorpay keys and webhook handling are wired in deployment envs.
- Consider adding customer-facing payment page that consumes the trusted QR payload directly.

## 9) Quick Commands
```bash
# Backend
cd services/api
npm install
npm run build
npm test

# Frontend
cd ../web
npm install
npm run build

# Docker
cd ..
docker compose build
```
