import Link from "next/link";
import { Container } from "@/components/container";

export default function PricingPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">{isFa ? "قیمت‌گذاری" : "Pricing"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "پلن‌های خرید" : "Purchase Plans"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {isFa
            ? "برای شروع سریع، خرید تکی مناسب است. برای صرفه‌جویی بیشتر، باندل‌ها را انتخاب کنید."
            : "Choose single template purchase for focused needs, or bundles for better value."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-bold">{isFa ? "خرید تکی" : "Single Purchase"}</h2>
          <p className="text-sm text-slate-600">{isFa ? "از حدود 29 تا 129 دلار" : "Typically from $29 to $129"}</p>
          <p className="text-sm leading-7 text-slate-700">
            {isFa
              ? "خرید هر تمپلیت با لایسنس Personal یا Commercial."
              : "Buy individual templates with Personal or Commercial licensing."}
          </p>
          <Link href={`/${params.locale}/templates`} className="primary-btn w-full text-sm">
            {isFa ? "مشاهده تمپلیت‌ها" : "Browse Templates"}
          </Link>
        </article>

        <article className="surface-card space-y-3 border-brand-200 p-5">
          <p className="inline-flex rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
            {isFa ? "پیشنهاد ویژه" : "Best Value"}
          </p>
          <h2 className="text-lg font-bold">{isFa ? "باندل‌ها" : "Bundle Packs"}</h2>
          <p className="text-sm text-slate-600">{isFa ? "چند محصول با قیمت به‌صرفه" : "Multiple templates at discounted price"}</p>
          <p className="text-sm leading-7 text-slate-700">
            {isFa
              ? "برای تیم‌ها و آژانس‌ها که چند نوع پروژه دارند."
              : "Great for teams and agencies with multiple project types."}
          </p>
          <Link href={`/${params.locale}/templates?type=bundle`} className="primary-btn w-full text-sm">
            {isFa ? "مشاهده باندل‌ها" : "Browse Bundles"}
          </Link>
        </article>

        <article className="surface-card space-y-3 p-5">
          <h2 className="text-lg font-bold">{isFa ? "اشتراک (به‌زودی)" : "Membership (Coming Soon)"}</h2>
          <p className="text-sm text-slate-600">{isFa ? "دانلود نامحدود ماهانه/سالانه" : "Monthly/Yearly unlimited downloads"}</p>
          <p className="text-sm leading-7 text-slate-700">
            {isFa
              ? "در نسخه بعدی، اشتراک تیمی با API Keys پیشرفته اضافه می‌شود."
              : "Team-focused membership with advanced API access is planned in next phase."}
          </p>
          <Link href={`/${params.locale}/support`} className="secondary-btn w-full text-sm">
            {isFa ? "اعلام علاقه‌مندی" : "Join Waitlist"}
          </Link>
        </article>
      </section>
    </Container>
  );
}
