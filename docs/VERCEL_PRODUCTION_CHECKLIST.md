# Vercel Production Checklist

This runbook is for deploying and operating `website-store` safely on Vercel without breaking the production database.

## 1. Before You Deploy

- Confirm the production PostgreSQL database is reachable and backed up.
- Confirm `DATABASE_URL` in Vercel points to the production database (not localhost).
- Confirm local `.env` and `.env.local` do not accidentally point to different databases when you test migrations.
- Confirm all payment and storage secrets are set in Vercel Environment Variables (Production).
- Confirm Clerk production keys are configured (not placeholder/test-example keys).

## 2. Required Vercel Environment Variables

Core:
- `DATABASE_URL`
- `DIRECT_URL` (recommended; required for stable Prisma migrations on Neon)
- `NEXT_PUBLIC_APP_URL`

Clerk:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Stripe:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Iran gateway:
- `IRAN_GATEWAY_WEBHOOK_SECRET`
- `ZARINPAL_MERCHANT_ID` (if using real Zarinpal)
- `ZARINPAL_MOCK_MODE=false` in production

Cloudflare R2:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT`
- `R2_REGION` (usually `auto`)

Optional (recommended):
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `HEALTHCHECK_TOKEN` (for deep `/api/health` access in production)

## 3. Safe Local Checks (No Destructive DB Action)

Run before pushing:

```powershell
cd D:\website-store
npm run preflight:env-align
npm run lint
npm run build
```

Notes:
- `npm run build` does **not** run migrations (prevents Vercel build failures from DB advisory locks).
- Run migrations explicitly before/alongside production deploy:
  - `npx prisma migrate deploy`
- Do **not** run `prisma migrate reset` on the production database.

Neon-specific:
- Use pooled Neon URL for `DATABASE_URL` (runtime).
- Use non-pooled direct Neon URL for `DIRECT_URL` (Prisma migrations).

## 4. Deploy to Vercel

- Push code to `main`
- Wait for Vercel deployment to finish
- Open deployment logs and confirm:
  - `Compiled successfully`
  - `Generating static pages ...`
  - no runtime env errors for `DATABASE_URL`

## 5. Post-Deploy Smoke Test (Public Paths)

Use the smoke script:

```powershell
cd D:\website-store
npm run smoke:deploy -- --base-url https://your-domain-or-vercel-url
```

What it checks:
- Home / localized pages
- Templates page
- Contact page
- `robots.txt`
- `sitemap.xml`
- `/api/health`
- `/api/products`
- expected behavior for protected routes (`/dashboard`, `/admin`)

## 6. Manual End-to-End Flow (Recommended)

1. Login with Clerk (`/fa/login` or `/en/login`)
2. Add product to cart
3. Checkout with each enabled method:
   - Stripe (USD/EUR)
   - Zarinpal (IR, if real key configured)
   - Manual receipt flow (AF)
4. Confirm redirect to dashboard
5. Confirm order status and download availability
6. Download file (signed URL)
7. Open admin pages:
   - `/fa/admin/products`
   - `/fa/admin/categories`
   - `/fa/admin/campaigns`
   - `/fa/admin/orders`
   - `/fa/admin/reports`
8. Export CSV in reports

For a detailed step-by-step validation script, see:
- `docs/PRODUCTION_E2E_TEST_FLOW.md`

## 7. Health Monitoring

Use:
- `GET /api/health`

Expected:
- `200 OK` when core dependencies are configured and reachable
- `503` with JSON details if core services are missing or unreachable

Deep health (production-protected):
- `GET /api/health?scope=deep` requires `HEALTHCHECK_TOKEN`
- Pass token via query (`token=...`) or header (`x-health-token`)
- Without token, endpoint returns `401` for deep requests

## 8. Rollback Plan

- Redeploy previous stable Vercel deployment
- Do not revert database schema unless a migration is known-safe and required
- If a migration causes issues, stop traffic-sensitive changes and investigate before applying further migrations

## 9. Security Hygiene

- Never commit `.env` files
- Rotate any secrets that were shared in chat/screenshots/logs
- Keep R2 bucket private (signed URLs only)
- Keep webhook secrets only in Vercel env vars
