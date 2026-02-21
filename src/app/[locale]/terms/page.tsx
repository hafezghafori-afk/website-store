import { Container } from "@/components/container";

export default function TermsPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "قوانین" : "Legal"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "شرایط استفاده" : "Terms of Service"}</h1>
      </div>

      <section className="surface-card space-y-4 p-5 text-sm leading-7 text-slate-700">
        <p>
          {isFa
            ? "خرید هر محصول به‌معنای پذیرش قوانین لایسنس همان محصول است."
            : "By purchasing any product, you agree to the license terms attached to that product."}
        </p>
        <p>
          {isFa
            ? "فروش مجدد سورس‌کد تمپلیت‌ها یا توزیع عمومی فایل خریداری‌شده مجاز نیست."
            : "Reselling source templates or public redistribution of purchased files is prohibited."}
        </p>
        <p>
          {isFa
            ? "در صورت تخلف از شرایط لایسنس، دسترسی دانلود ممکن است محدود یا لغو شود."
            : "In case of license violation, download access may be limited or revoked."}
        </p>
        <p>
          {isFa
            ? "پرداخت‌های تاییدشده دیجیتال عموما غیرقابل بازگشت هستند مگر در موارد خطای فنی قابل اثبات."
            : "Confirmed digital payments are generally non-refundable unless a verifiable technical issue is confirmed."}
        </p>
      </section>
    </Container>
  );
}
