import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AccountRouteNav } from "@/components/account-route-nav";
import { Container } from "@/components/container";
import { DownloadButton } from "@/components/download-button";
import { EmptyState } from "@/components/empty-state";
import { requireAppUser } from "@/lib/app-user";
import { getDashboardDownloadables } from "@/lib/account-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardDownloadsPage({
  params
}: {
  params: { locale: string };
}) {
  noStore();

  const appUser = await requireAppUser();
  if (!appUser) {
    redirect(`/${params.locale}/login`);
  }

  const downloadables = await getDashboardDownloadables(appUser.id);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Downloads</h1>
      </div>

      <AccountRouteNav locale={params.locale} active="downloads" />

      <section className="space-y-4">
        {downloadables.length === 0 ? (
          <EmptyState
            title="No active downloads"
            description="After a paid order is confirmed, secure download links will be available here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {downloadables.map((token) => (
              <article key={token.id} className="surface-card space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{token.product.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{token.product.slug}</p>
                  </div>
                  <p className="rounded-full border border-border bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    Active
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-white p-3 text-xs text-slate-600">
                  <p>
                    Uses: {token.usedCount}/{token.maxUses}
                  </p>
                  <p className="mt-1">Expires: {new Date(token.expiresAt).toLocaleString("en")}</p>
                </div>
                <DownloadButton productId={token.productId} />
              </article>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
