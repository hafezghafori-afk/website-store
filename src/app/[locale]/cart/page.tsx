import { Container } from "@/components/container";
import { CartPageClient } from "@/components/cart-page-client";
import type { Locale } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function CartPage({ params }: { params: { locale: Locale } }) {
  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Cart</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Shopping Cart</h1>
      </div>
      <CartPageClient locale={params.locale} />
    </Container>
  );
}
