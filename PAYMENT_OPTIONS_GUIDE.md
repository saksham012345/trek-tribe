# Organizer Payment Options (Razorpay vs Manual)

## What you can choose when creating a trip
- **Automated & Trusted (Razorpay-style QR)**
  - Auto-generates a QR for the exact amount you set.
  - Marked as **trusted** and uses automated verification.
  - Travelers scan and pay; you avoid manual screenshot review.
  - No manual proof required.
- **Manual Screenshot / QR (Less trusted)**
  - You upload your own QR/screenshot.
  - Travelers upload payment screenshots; you verify manually.
  - Marked as **manual** and less trusted.
  - Use this only if you cannot use Razorpay automation.

## How to use (Create Trip page)
1) In **Payment Configuration**, pick one:
   - **Automated & Trusted (Razorpay QR)** → click **Generate QR** after entering trip price; preview shows the trusted QR and reference.
   - **Manual Screenshot (Less trusted)** → upload your own QR/screenshot; travelers must upload proofs; you verify manually.
2) Set payment type (full/advance) and any refund instructions.
3) Save the trip.

## How it shows up to you
- Payment config now carries: `collectionMode`, `verificationMode`, `manualProofRequired`, `trustLevel`, and optional `gatewayQR` metadata.
- Manual mode still enforces at least one uploaded QR/screenshot.
- Automated mode skips the QR-upload prerequisite because a trusted QR is generated.

## Payment Verification Dashboard
- New **Trusted QR (Automated)** block lets you generate an amount-specific QR anytime.
- You see the QR image, reference ID, amount, and currency; share it with travelers when needed.

## Tips
- Prefer **Automated & Trusted** whenever possible to reduce fraud and manual workload.
- Use **Manual** only as a fallback; expect slower verification and lower trust.
