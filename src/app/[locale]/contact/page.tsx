import Link from "next/link";
import { Container } from "@/components/container";

export default function ContactPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "تماس" : "Contact"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "تماس با ما" : "Contact Us"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {isFa
            ? "برای سوالات خرید، لایسنس، دانلود یا همکاری، از طریق تیکت پشتیبانی پیام بفرستید."
            : "For checkout, licensing, download access, or partnership requests, contact us through support tickets."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-bold">{isFa ? "پشتیبانی فنی" : "Technical Support"}</h2>
          <p className="text-sm leading-7 text-slate-700">
            {isFa
              ? "برای مشکلات نصب، دانلود یا پرداخت، تیکت ثبت کنید."
              : "Use support tickets for installation, download, or payment issues."}
          </p>
          <Link href={`/${params.locale}/support`} className="primary-btn w-full text-sm sm:w-auto">
            {isFa ? "ثبت تیکت" : "Open Support Ticket"}
          </Link>
        </article>

        <article className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-bold">{isFa ? "پاسخ سریع" : "Quick Self-Service"}</h2>
          <p className="text-sm leading-7 text-slate-700">
            {isFa
              ? "راهنمای خرید، لایسنس و دانلود امن را در بخش مستندات و FAQ ببینید."
              : "Find immediate answers in Docs and FAQ for licensing, payments, and secure downloads."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/${params.locale}/docs`} className="secondary-btn text-sm">
              Docs
            </Link>
            <Link href={`/${params.locale}/faq`} className="secondary-btn text-sm">
              FAQ
            </Link>
          </div>
        </article>
      </section>
    </Container>
  );
}
