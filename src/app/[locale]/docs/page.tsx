import { Container } from "@/components/container";

export default function DocsPage() {
  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Guides</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Documentation</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Core integration notes for purchases, downloads, and storefront operations.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">Licenses</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Personal: single project usage.</li>
            <li>Commercial: multi-project/client usage.</li>
            <li>Resale of source templates is prohibited.</li>
          </ul>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">Secure Downloads</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Download links are signed and time-limited.</li>
            <li>Each token has a usage limit.</li>
            <li>All downloads are logged (IP + UserAgent).</li>
          </ul>
        </article>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">API Endpoints</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p><code>GET /api/products</code> list with filters</p>
          <p><code>GET /api/products?type=bundle</code> list only bundles</p>
          <p><code>GET /api/products/:slug</code> product details</p>
          <p><code>POST /api/checkout</code> create order and payment session</p>
          <p><code>GET /api/payments/zarinpal/callback</code> zarinpal callback + verification</p>
          <p><code>POST /api/download</code> return signed download URL after entitlement checks</p>
          <p><code>POST /api/payments/manual-receipt</code> submit manual transfer reference</p>
          <p><code>GET|POST /api/support/tickets</code> list and create support tickets</p>
          <p><code>POST /api/support/tickets/:id/reply</code> add user reply to an existing ticket</p>
          <p><code>GET|POST /api/me/profile</code> read/update profile and billing preferences</p>
          <p><code>GET /api/me/orders</code> user orders (session or API key)</p>
          <p><code>GET /api/me/downloads</code> user downloads (session or API key)</p>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">Payment Testing</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>Use Stripe webhook simulation script for local callback verification.</p>
          <p>Set <code>ZARINPAL_MOCK_MODE=true</code> in local environment to simulate Zarinpal callback flow.</p>
          <p>If <code>IRAN_GATEWAY_WEBHOOK_SECRET</code> is set, send HMAC signature in webhook headers for Iran gateway callbacks.</p>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">SEO</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p><code>GET /sitemap.xml</code> generated catalog sitemap</p>
          <p><code>GET /robots.txt</code> crawler rules + sitemap link</p>
          <p><code>/{`{locale}`}/templates/{`{slug}`}/opengraph-image</code> dynamic product social card image</p>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">Audit Events</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>Admin actions, manual receipt submissions, support updates, and API key changes are recorded as audit events.</p>
          <p>Use <code>GET /api/admin/logs</code> or the Admin panel to review timeline data.</p>
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg font-bold">API Key Auth</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>Generate and revoke API keys from Dashboard.</p>
          <p>Send key in <code>Authorization: Bearer &lt;API_KEY&gt;</code> or <code>x-api-key: &lt;API_KEY&gt;</code>.</p>
          <p>Only active keys are accepted. Revoked keys are rejected immediately.</p>
        </div>
      </section>
    </Container>
  );
}
