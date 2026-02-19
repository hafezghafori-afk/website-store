import { Container } from "@/components/container";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { requireAppUser } from "@/lib/app-user";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const appUser = await requireAppUser();

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Help Center</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Support</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          For checkout issues, download access, license clarification, or billing questions, submit a ticket and we will respond by email.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SupportTicketForm initialName={appUser?.name ?? undefined} initialEmail={appUser?.email ?? undefined} />

        <aside className="surface-card space-y-4 p-5">
          <h2 className="text-lg font-bold">Quick Answers</h2>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-text">Download link expired?</p>
              <p className="mt-1 text-slate-600">Open Dashboard and generate a new secure link from the Downloads section.</p>
            </div>
            <div>
              <p className="font-semibold text-text">Manual transfer pending?</p>
              <p className="mt-1 text-slate-600">Submit your transfer reference in Dashboard. Admin reviews it from the back office.</p>
            </div>
            <div>
              <p className="font-semibold text-text">License upgrade?</p>
              <p className="mt-1 text-slate-600">Contact support with your order id and target license type.</p>
            </div>
          </div>
        </aside>
      </div>
    </Container>
  );
}
