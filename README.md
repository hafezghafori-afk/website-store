# Website Store MVP

Minimal template marketplace built with Next.js App Router, Clerk auth, Prisma, Stripe, and Cloudflare R2.

## Stack
- Next.js 14 + TypeScript + TailwindCSS
- Clerk Authentication
- PostgreSQL + Prisma ORM
- Stripe Checkout (USD / EUR)
- Cloudflare R2 signed download URLs
- Locales: `fa`, `en`
- SEO-ready metadata (`sitemap.xml`, `robots.txt`, product OG images)

## Quick Start
1. Copy `.env.example` to `.env` and fill your keys.
2. Install dependencies: `npm install`
3. Generate prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
4.1. CI-safe migrations: `npm run prisma:migrate:deploy`
5. Seed catalog data: `npm run seed`
6. Start dev server: `npm run dev`
7. If port 3000 is busy: `npm run dev:3002`
8. If common ports are busy: `npm run dev:auto`
9. Before hosting check: `npm run preflight:hosting`

## Payment + Download Flow (Implemented)
1. `POST /api/checkout` creates real `Order` + `Payment` + `OrderItem` records in Prisma.
2. Stripe checkout uses metadata (`orderId`, `paymentId`) for webhook reconciliation.
3. `POST /api/webhooks/stripe` marks order as paid and creates `DownloadToken` records.
4. `POST /api/webhooks/iran-gateway` can also mark order paid/failed and unlock downloads.
5. `GET /api/payments/zarinpal/callback` verifies Zarinpal payment and unlocks downloads.
6. `POST /api/download` verifies entitlement and returns a short-lived R2 signed URL.
7. `GET /api/me/orders` and `GET /api/me/downloads` return authenticated account data.
8. Optional coupon codes are validated in checkout and reflected in payment metadata.
9. Stripe / Iran webhooks are idempotent for paid order transitions and coupon usage updates.
10. Manual Afghanistan transfer flow supports receipt submission and admin approve/reject review.
11. User API keys can be generated/revoked from dashboard.
12. Support center includes ticket threads with user/admin replies.
13. Admin actions and key account events are stored as audit events.
14. Dashboard Profile & Billing section is editable (country, locale, preferred currency).
15. Checkout defaults are now prefilled from profile preferences.
16. Checkout enforces provider availability by selected country + currency.
17. Zarinpal local mock mode is supported for full callback testing without live gateway.

## Dev Scenario: Simulate Paid Order
If you want to test dashboard downloads without real gateway callbacks:

`npm run simulate:paid-order -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD`

## Dev Scenario: API Key End-to-End Smoke
Creates a paid order, download token, and API key for a test user:

`npm run smoke:api-key-flow -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD`

If dev server is running, add `--baseUrl` to also test API key auth on `/api/me/orders`, `/api/me/downloads`, and `/api/download`:

`npm run smoke:api-key-flow -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD --baseUrl http://localhost:3002`

## Dev Scenario: Stripe Webhook + Zarinpal Callback
Stripe webhook simulation:

`npm run test:webhook:stripe -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD`

Iran gateway webhook simulation (supports signed requests when `IRAN_GATEWAY_WEBHOOK_SECRET` is set):

`npm run test:webhook:iran -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD --provider idpay`

Zarinpal callback simulation (requires `ZARINPAL_MOCK_MODE=true` in local `.env`):

`npm run test:zarinpal:callback -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD --baseUrl http://localhost:3002`

One-shot payment smoke (auto-picks free port, starts temporary dev server, runs Stripe + Zarinpal + Iran webhook tests):

`npm run smoke:payments -- --email devbuyer@example.com --productId prd-1 --licenseType personal --currency USD`

## Webhook Security
- If `IRAN_GATEWAY_WEBHOOK_SECRET` is set, `/api/webhooks/iran-gateway` requires HMAC SHA-256 signature.
- Send signature in one of these headers:
  - `x-webhook-signature`
  - `x-signature`
  - `x-iran-webhook-signature`

This creates a paid order + payment + download token for that user.

## Dev Cleanup: Remove Test Data
Dry run:

`npm run cleanup:test-data -- --dry-run true --email devbuyer@example.com`

Apply cleanup:

`npm run cleanup:test-data -- --email devbuyer@example.com`

If you also want to remove matching user accounts:

`npm run cleanup:test-data -- --email devbuyer@example.com --remove-users true`

## Required Runtime Setup
- Add real `DATABASE_URL` in `.env` and run migrations before checkout testing.
- Configure Stripe keys + webhook secret in `.env`.
- Configure Zarinpal merchant id in `.env` (`ZARINPAL_MERCHANT_ID`).
- Configure R2 credentials in `.env` for secure download links.
- In Clerk, set admin user metadata role: `admin` to access `/[locale]/admin`.

## Admin APIs
- Products: `GET|POST /api/admin/products` (`action=create|update|delete`)
  - Supports comma-separated `tags` and `tech` on create/update.
- Upload versions: `GET|POST /api/admin/upload-version` (supports direct file upload to R2)
- Orders: `GET /api/admin/orders`
- Orders review: `POST /api/admin/orders` (`action=approve|reject`)
- Users: `GET|POST /api/admin/users` (update name/country/locale/preferredCurrency)
- Logs: `GET /api/admin/logs` (download logs + audit events)
- Coupons: `GET|POST /api/admin/coupons` (`action=create|toggle|delete`)
- Support tickets: `GET|POST /api/admin/support-tickets` (`status=open|in_progress|resolved|closed`, optional `reply`)

## Manual Receipt API
- Submit receipt: `POST /api/payments/manual-receipt` with `{ orderId, reference, receiptUrl?, note? }`

## Support APIs
- User tickets: `GET|POST /api/support/tickets`
- User reply: `POST /api/support/tickets/:id/reply` with `{ message }`

## Profile API
- `GET|POST /api/me/profile` for account preferences (name/country/locale/preferredCurrency)

## Checkout UX
- Checkout page provides option selectors (product, license, currency, country) before payment.

## API Keys
- User keys: `GET|POST /api/me/api-keys` (`action=create|revoke`)
- API key auth supported on:
  - `GET /api/me/orders`
  - `GET /api/me/downloads`
  - `POST /api/download`
- Send key via one of:
  - `Authorization: Bearer <API_KEY>`
  - `x-api-key: <API_KEY>`

## MVP Routes
- Home: `/fa`
- Templates list: `/fa/templates`
- Bundles list: `/fa/templates?type=bundle`
- Product details: `/fa/templates/:slug`
- Checkout: `/fa/checkout`
- Dashboard: `/fa/dashboard`
- Admin: `/fa/admin`
- Orders API: `/api/me/orders`
- Downloads API: `/api/me/downloads`

## SEO Routes
- `GET /sitemap.xml`
- `GET /robots.txt`
- Product OG image: `/{locale}/templates/{slug}/opengraph-image`

## CI Pipeline
- GitHub Actions workflow: `.github/workflows/ci.yml`
- Runs on push / pull request:
  - `npm ci`
  - `npm run prisma:generate`
  - `npm run prisma:migrate:deploy`
  - `npm run seed`
  - `npm run lint`
  - `npm run build`
  - `npm run smoke:payments`

## CD Pipeline (Vercel)
- GitHub Actions workflow: `.github/workflows/deploy-vercel.yml`
- Triggers:
  - Auto after successful `CI` run on `main/master`
  - Manual run with `workflow_dispatch`
- Required GitHub repository secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Workflow steps:
  - `vercel pull --environment=production`
  - `vercel build --prod`
  - `vercel deploy --prebuilt --prod`
- Important:
  - Set production environment variables in Vercel project settings (`DATABASE_URL`, Clerk keys, Stripe keys, R2 keys, and gateway secrets).

## Hosting Preflight
- Run before production deploy:
  - `npm run preflight:hosting`
- Useful flags:
  - `--allow-http true` for local-only checks
  - `--require-zarinpal false` if Zarinpal is not part of your launch
