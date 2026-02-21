import { Container } from "@/components/container";

export default function PrivacyPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "حریم خصوصی" : "Privacy"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "سیاست حریم خصوصی" : "Privacy Policy"}</h1>
      </div>

      <section className="surface-card space-y-4 p-5 text-sm leading-7 text-slate-700">
        <p>
          {isFa
            ? "برای پردازش سفارش، اطلاعات ضروری مانند ایمیل، کشور، و سوابق خرید ذخیره می‌شود."
            : "To process orders, essential information such as email, country, and purchase history is stored."}
        </p>
        <p>
          {isFa
            ? "لینک‌های دانلود امن و لاگ دانلود (IP/UserAgent) برای جلوگیری از سوءاستفاده ثبت می‌شود."
            : "Secure download operations may log IP and user-agent to prevent abuse."}
        </p>
        <p>
          {isFa
            ? "اطلاعات پرداخت کارت توسط Stripe یا درگاه بانکی پردازش می‌شود و در سرور ما نگهداری مستقیم نمی‌شود."
            : "Card data is handled by Stripe or payment gateways and is not stored directly on our servers."}
        </p>
        <p>
          {isFa
            ? "برای درخواست حذف یا اصلاح اطلاعات حساب، از بخش پشتیبانی تیکت ثبت کنید."
            : "To request account data correction or deletion, submit a support ticket."}
        </p>
      </section>
    </Container>
  );
}
