import { Container } from "@/components/container";

export default function AboutPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "درباره" : "About"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "درباره TemplateBaz" : "About TemplateBaz"}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          {isFa
            ? "TemplateBaz یک فروشگاه مینیمال برای فروش تمپلیت‌های آماده است. تمرکز ما روی تجربه خرید ساده، دانلود امن و ساختار حرفه‌ای محصول است."
            : "TemplateBaz is a minimal template marketplace focused on fast purchase flow, secure delivery, and clean product quality."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "کیفیت کد" : "Code Quality"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "محصولات با معماری قابل نگهداری و مستندات نصب ارائه می‌شوند."
              : "Templates are shipped with maintainable architecture and setup guides."}
          </p>
        </article>
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "تحویل امن" : "Secure Delivery"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "لینک‌های دانلود امضاشده و زمان‌دار هستند و لاگ دانلود ثبت می‌شود."
              : "Signed and time-limited download links are generated per customer."}
          </p>
        </article>
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "پشتیبانی واقعی" : "Practical Support"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "با سیستم تیکت داخلی، مسائل خرید، لایسنس و دانلود قابل پیگیری است."
              : "Built-in support tickets keep purchase, licensing, and access issues trackable."}
          </p>
        </article>
      </section>
    </Container>
  );
}
