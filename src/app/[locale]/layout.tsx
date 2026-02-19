import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { LOCALES, type Locale } from "@/lib/constants";
import { getDirection } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "TemplateBaz Storefront"
};

export default function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!LOCALES.includes(params.locale as Locale)) {
    notFound();
  }

  const locale = params.locale as Locale;

  return (
    <div lang={locale} dir={getDirection(locale)} className="min-h-screen">
      <Navbar locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} />
    </div>
  );
}
