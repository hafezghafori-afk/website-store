import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { AccountRouteNav } from "@/components/account-route-nav";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { Container } from "@/components/container";
import { ProfileBillingForm } from "@/components/profile-billing-form";
import { requireAppUser } from "@/lib/app-user";
import { getDashboardApiKeys } from "@/lib/account-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage({
  params
}: {
  params: { locale: string };
}) {
  noStore();

  const appUser = await requireAppUser();
  if (!appUser) {
    redirect(`/${params.locale}/login`);
  }

  const apiKeys = await getDashboardApiKeys(appUser.id);

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Profile & Billing</h1>
        <p className="mt-2 text-sm text-slate-600">Manage your profile, locale/currency preferences, and team API keys.</p>
      </div>

      <AccountRouteNav locale={params.locale} active="profile" />

      <section className="grid gap-6 lg:grid-cols-2">
        <ProfileBillingForm
          initialProfile={{
            email: appUser.email,
            name: appUser.name,
            country: appUser.country,
            locale: appUser.locale as "fa" | "en",
            preferredCurrency: appUser.preferredCurrency as "USD" | "EUR"
          }}
        />

        <ApiKeysManager
          initialKeys={apiKeys.map((key) => ({
            ...key,
            lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
            revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
            createdAt: key.createdAt.toISOString()
          }))}
        />
      </section>
    </Container>
  );
}
