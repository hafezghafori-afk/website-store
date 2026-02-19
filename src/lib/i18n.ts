import type { Locale } from "@/lib/constants";
import { DEFAULT_LOCALE, LOCALES, RTL_LOCALES } from "@/lib/constants";

type Translation = {
  brandName: string;
  nav: {
    templates: string;
    bundles: string;
    docs: string;
    support: string;
    login: string;
    cart: string;
  };
  hero: {
    title: string;
    subtitle: string;
    browse: string;
    demo: string;
  };
  sections: {
    categories: string;
    newArrivals: string;
    bestSellers: string;
    whyTitle: string;
    products: string;
    checkout: string;
    dashboard: string;
    admin: string;
  };
  filters: {
    title: string;
    tech: string;
    rtl: string;
    price: string;
    license: string;
    sort: string;
    search: string;
  };
  common: {
    details: string;
    buyNow: string;
    addToCart: string;
    empty: string;
    downloads: string;
    orders: string;
  };
};

const translations: Record<Locale, Translation> = {
  fa: {
    brandName: "TemplateBaz",
    nav: {
      templates: "تمپلیت‌ها",
      bundles: "باندل‌ها",
      docs: "مستندات",
      support: "پشتیبانی",
      login: "ورود",
      cart: "سبد خرید"
    },
    hero: {
      title: "تمپلیت‌های مینیمال و آماده برای فروش سریع",
      subtitle: "ساخته شده با تمرکز روی سرعت، خوانایی و تجربه خرید بدون اصطکاک.",
      browse: "مشاهده تمپلیت‌ها",
      demo: "دیدن دمو"
    },
    sections: {
      categories: "دسته‌بندی‌های اصلی",
      newArrivals: "جدیدترین‌ها",
      bestSellers: "پرفروش‌ترین‌ها",
      whyTitle: "چرا TemplateBaz؟",
      products: "محصولات",
      checkout: "تسویه حساب",
      dashboard: "داشبورد",
      admin: "ادمین"
    },
    filters: {
      title: "فیلترها",
      tech: "تکنولوژی",
      rtl: "پشتیبانی RTL",
      price: "بازه قیمت",
      license: "نوع لایسنس",
      sort: "مرتب‌سازی",
      search: "جستجو"
    },
    common: {
      details: "جزئیات",
      buyNow: "خرید",
      addToCart: "افزودن به سبد",
      empty: "موردی یافت نشد",
      downloads: "دانلودها",
      orders: "سفارش‌ها"
    }
  },
  en: {
    brandName: "TemplateBaz",
    nav: {
      templates: "Templates",
      bundles: "Bundles",
      docs: "Docs",
      support: "Support",
      login: "Login",
      cart: "Cart"
    },
    hero: {
      title: "Minimal templates built to sell fast",
      subtitle: "Modern storefront UI with clean spacing, strong typography, and clear conversion paths.",
      browse: "Browse Templates",
      demo: "View Demo"
    },
    sections: {
      categories: "Top Categories",
      newArrivals: "New Arrivals",
      bestSellers: "Best Sellers",
      whyTitle: "Why TemplateBaz?",
      products: "Products",
      checkout: "Checkout",
      dashboard: "Dashboard",
      admin: "Admin"
    },
    filters: {
      title: "Filters",
      tech: "Tech",
      rtl: "RTL",
      price: "Price",
      license: "License",
      sort: "Sort",
      search: "Search"
    },
    common: {
      details: "Details",
      buyNow: "Buy Now",
      addToCart: "Add to Cart",
      empty: "Nothing found",
      downloads: "Downloads",
      orders: "Orders"
    }
  }
};

export function isLocale(input: string): input is Locale {
  return (LOCALES as readonly string[]).includes(input);
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function getDictionary(locale: string): Translation {
  if (isLocale(locale)) {
    return translations[locale];
  }
  return translations[DEFAULT_LOCALE];
}
