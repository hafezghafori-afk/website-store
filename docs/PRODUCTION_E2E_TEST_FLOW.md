# Production E2E Test Flow

Use this checklist after a successful Vercel deployment to validate the main revenue flow end-to-end without touching the production database schema destructively.

## Scope

Goal:
- user visits site
- browses templates
- checks out
- payment is recorded
- order appears in dashboard
- secure download works
- admin can review orders/manual receipts

## Prerequisites

- Vercel deployment completed successfully
- Clerk production keys configured
- PostgreSQL `DATABASE_URL` configured
- R2 configured and bucket private
- Stripe configured (USD/EUR)
- Iran gateway configured (if enabled)
- Admin user has Clerk metadata role:

```json
{ "role": "admin" }
```

## 0. Quick Smoke First

Run automated smoke checks:

```powershell
cd D:\website-store
npm run smoke:deploy -- --base-url https://website-store-five.vercel.app
```

Optional deep health:

```powershell
npm run smoke:deploy -- --base-url https://website-store-five.vercel.app --deep-health true --health-token "<HEALTHCHECK_TOKEN>"
```

## 1. Public Catalog Flow

1. Open `https://website-store-five.vercel.app/fa`
2. Verify Home loads and category cards are visible
3. Click a category card and confirm it opens:
   - `/fa/templates?category=...`
4. Test filters on templates page:
   - category
   - tech
   - RTL
   - currency
   - license type
5. Open a product details page
6. Verify:
   - demo link works
   - price box renders
   - add to cart works

Expected:
- no server-side application error
- products render even if one data source is slow/unavailable (fallback)

## 2. Authentication Flow (Clerk)

1. Open `/fa/login`
2. Sign in with a test customer account
3. Confirm redirect back to site
4. Open `/fa/dashboard`

Expected:
- dashboard opens
- no "Signed-in session detected, but user profile could not be loaded from database" error

## 3. Checkout + Stripe (USD/EUR)

1. Add one product to cart
2. Open `/fa/cart`
3. Choose a non-IR/non-AF country (e.g. `US`)
4. Confirm Stripe appears in payment options
5. Go to checkout and complete test payment (Stripe test mode)
6. Confirm redirect to:
   - `/fa/dashboard?payment=success` (or equivalent)

Expected:
- order status becomes `paid`
- payment record created
- email receipt sent (if `RESEND_API_KEY` configured)

## 4. Manual Payment (AF flow)

1. Add a product to cart
2. Choose country `AF`
3. Select manual payment
4. Complete checkout
5. Open `/fa/dashboard/orders`
6. Submit manual receipt using:
   - gallery/files
   - camera capture (mobile)

Expected:
- order stays `pending`
- receipt info saved
- preview/upload flow works on mobile

## 5. Downloads Flow

1. Open `/fa/dashboard/downloads`
2. Click `Download Securely`
3. Confirm signed URL opens and file download starts

Expected:
- no direct public file URL exposed permanently
- signed URL works only for limited time

## 6. Profile / Billing / API Keys

1. Open `/fa/dashboard/profile`
2. Update:
   - name
   - country
   - locale
   - preferred currency
3. Save and verify success message
4. Generate an API key
5. Copy the revealed key (shown once)
6. Revoke the key and verify status changes

Expected:
- updates persist
- API key create/revoke works

## 7. Admin Validation

1. Sign in as admin user
2. Open:
   - `/fa/admin`
   - `/fa/admin/products`
   - `/fa/admin/categories`
   - `/fa/admin/campaigns`
   - `/fa/admin/orders`
   - `/fa/admin/reports`
3. Validate:
   - create/update category
   - assign category to product
   - create campaign coupon
   - review manual receipt order (approve/reject)
   - export CSV from reports

Expected:
- no `auth()` middleware errors
- no Prisma runtime errors from missing env

## 8. API / Health Checks

1. Open `/api/health`
2. Verify response is JSON
3. If using deep health:
   - call `/api/health?scope=deep&token=<HEALTHCHECK_TOKEN>`

Expected:
- `200` (healthy) or `503` (clear config issue details)
- `401` for deep health without valid token (in production)

## 9. Rollback Triggers (When to Stop)

Stop rollout and investigate if any of these happen:
- checkout fails for all methods
- dashboard shows server exceptions
- `/api/health` reports database unreachable
- downloads fail after successful payment
- admin orders page fails to open

## 10. Evidence to Record (Recommended)

Capture and store:
- deployment URL and commit SHA
- `/api/health` output (basic)
- one Stripe test order ID
- one manual payment test order ID
- one successful download event timestamp
- CSV export file sample
