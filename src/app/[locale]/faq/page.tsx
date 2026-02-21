import { Container } from "@/components/container";

export default function FaqPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "راهنما" : "Help"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "سوالات متداول" : "Frequently Asked Questions"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {isFa
            ? "پاسخ سوالات رایج درباره لایسنس، دانلود امن، پرداخت و پشتیبانی."
            : "Quick answers about licenses, secure downloads, payment flow, and support."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "بعد از پرداخت چطور دانلود کنم؟" : "How do I download after payment?"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "بعد از تایید پرداخت، از طریق Dashboard لینک دانلود امن دریافت می‌کنید."
              : "After payment confirmation, downloads are unlocked in your dashboard with secure links."}
          </p>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "لایسنس Personal و Commercial چه تفاوتی دارد؟" : "Personal vs Commercial license?"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "Personal برای یک پروژه شخصی است. Commercial برای پروژه‌های چندگانه یا پروژه مشتری."
              : "Personal is for a single personal project. Commercial covers multi-project or client usage."}
          </p>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "لینک دانلود چرا منقضی می‌شود؟" : "Why does the download link expire?"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "برای امنیت فایل‌ها، لینک‌ها زمان‌دار هستند. هر زمان نیاز بود در Dashboard لینک جدید بگیرید."
              : "For file security, links are time-limited. You can generate a new link from dashboard anytime."}
          </p>
        </article>

        <article className="surface-card p-5">
          <h2 className="text-lg font-bold">{isFa ? "اگر پرداخت دستی انجام دهم چه می‌شود؟" : "What about manual transfer payments?"}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            {isFa
              ? "رسید را در Dashboard آپلود کنید تا ادمین تایید کند و دانلود فعال شود."
              : "Upload your transfer receipt in dashboard; admin verifies and unlocks your downloads."}
          </p>
        </article>
      </section>
    </Container>
  );
}
