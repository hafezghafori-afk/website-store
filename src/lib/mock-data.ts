import type { Product, ProductCategory } from "@/lib/types";

export const CATEGORIES: ProductCategory[] = [
  {
    id: "cat-landing",
    title: "Landing Pages",
    slug: "landing-pages",
    description: "High-conversion landing templates for SaaS and startups."
  },
  {
    id: "cat-corporate",
    title: "Corporate / Business",
    slug: "corporate-business",
    description: "Professional websites for agencies, firms, and services."
  },
  {
    id: "cat-ecommerce",
    title: "Ecommerce UI",
    slug: "ecommerce-ui",
    description: "Storefront UIs optimized for product listing and checkout flow."
  },
  {
    id: "cat-admin",
    title: "Admin Dashboards",
    slug: "admin-dashboards",
    description: "Management panels with analytics and role-based sections."
  },
  {
    id: "cat-portfolio",
    title: "Portfolio / Resume",
    slug: "portfolio-resume",
    description: "Clean personal branding templates for freelancers and creators."
  },
  {
    id: "cat-ui-kit",
    title: "UI Kits / Components",
    slug: "ui-kits-components",
    description: "Reusable component systems with consistent visual patterns."
  }
];

export const PRODUCTS: Product[] = [
  {
    id: "prd-1",
    slug: "saas-indigo",
    title: "SaaS Indigo",
    summary: "Modern SaaS landing template with pricing, features, and FAQ blocks.",
    description:
      "A minimal Next.js + Tailwind template focused on conversion with clean layout, high readability, and accessible components.",
    coverImage: "https://picsum.photos/seed/saas-indigo/1200/760",
    demoUrl: "https://example.com/demo/saas-indigo",
    isBundle: false,
    status: "published",
    category: "landing-pages",
    tags: ["RTL", "Tailwind", "Next.js", "SEO Ready"],
    tech: ["Next.js", "React", "Tailwind"],
    rtl: true,
    responsive: true,
    includes: ["Source code", "Figma tokens", "Documentation"],
    versions: ["1.0.0", "1.1.0"],
    basePriceUsd: { personal: 39, commercial: 89 },
    changelog: ["1.1.0 - Added pricing switch and FAQ accordion", "1.0.0 - Initial release"],
    faq: [
      { q: "Can I use this for client work?", a: "Yes, with Commercial license." },
      { q: "Is RTL supported?", a: "Yes, full RTL layout is included." }
    ],
    reviews: [{ name: "Amir", message: "Clean code and easy to customize.", rating: 5 }],
    isNew: true,
    isBestSeller: true
  },
  {
    id: "prd-2",
    slug: "commerce-lite",
    title: "Commerce Lite",
    summary: "Minimal ecommerce UI kit with category, search, and checkout pages.",
    description: "Built for template shops and digital product stores with lightweight components.",
    coverImage: "https://picsum.photos/seed/commerce-lite/1200/760",
    demoUrl: "https://example.com/demo/commerce-lite",
    isBundle: false,
    status: "published",
    category: "ecommerce-ui",
    tags: ["Responsive", "Tailwind", "React"],
    tech: ["React", "Tailwind"],
    rtl: false,
    responsive: true,
    includes: ["Source code", "Style guide"],
    versions: ["1.0.0"],
    basePriceUsd: { personal: 49, commercial: 109 },
    changelog: ["1.0.0 - Initial release"],
    faq: [{ q: "Does it include checkout pages?", a: "Yes, checkout and order summary are included." }],
    reviews: [{ name: "Sara", message: "Good structure for quick launch.", rating: 4 }],
    isNew: true,
    isBestSeller: false
  },
  {
    id: "prd-3",
    slug: "corporate-core",
    title: "Corporate Core",
    summary: "Business-oriented multipage template for agencies and consulting firms.",
    description: "Professional sections for services, case studies, and trust blocks.",
    coverImage: "https://picsum.photos/seed/corporate-core/1200/760",
    demoUrl: "https://example.com/demo/corporate-core",
    isBundle: false,
    status: "published",
    category: "corporate-business",
    tags: ["Next.js", "i18n", "RTL"],
    tech: ["Next.js", "Tailwind", "Node"],
    rtl: true,
    responsive: true,
    includes: ["Source code", "Assets", "Guide"],
    versions: ["1.0.0", "1.2.0"],
    basePriceUsd: { personal: 45, commercial: 95 },
    changelog: ["1.2.0 - Improved hero and testimonial cards", "1.0.0 - Initial release"],
    faq: [{ q: "Can I replace branding fast?", a: "Yes, all brand tokens are centralized." }],
    reviews: [{ name: "Neda", message: "Great for corporate client projects.", rating: 5 }],
    isNew: false,
    isBestSeller: true
  },
  {
    id: "prd-4",
    slug: "admin-focus",
    title: "Admin Focus",
    summary: "Dashboard starter with analytics cards and user management pages.",
    description: "Designed for SaaS admin experiences with neutral, minimal components.",
    coverImage: "https://picsum.photos/seed/admin-focus/1200/760",
    demoUrl: "https://example.com/demo/admin-focus",
    isBundle: true,
    status: "published",
    category: "admin-dashboards",
    tags: ["Dashboard", "React", "Responsive"],
    tech: ["React", "Tailwind", "Node"],
    rtl: true,
    responsive: true,
    includes: ["Source code", "Chart blocks"],
    versions: ["1.0.0", "1.0.1"],
    basePriceUsd: { personal: 55, commercial: 119 },
    changelog: ["1.0.1 - Improved table pagination", "1.0.0 - Initial release"],
    faq: [{ q: "Does it include auth pages?", a: "Login and profile views are included." }],
    reviews: [{ name: "Ali", message: "Very useful admin baseline.", rating: 4 }],
    isNew: false,
    isBestSeller: true
  },
  {
    id: "prd-5",
    slug: "portfolio-clean",
    title: "Portfolio Clean",
    summary: "Minimal personal portfolio with project cards and CV section.",
    description: "Ideal for designers and developers who need a polished online profile.",
    coverImage: "https://picsum.photos/seed/portfolio-clean/1200/760",
    demoUrl: "https://example.com/demo/portfolio-clean",
    isBundle: false,
    status: "published",
    category: "portfolio-resume",
    tags: ["Portfolio", "SEO Ready", "Tailwind"],
    tech: ["Next.js", "Tailwind"],
    rtl: true,
    responsive: true,
    includes: ["Source code", "Content template"],
    versions: ["1.0.0"],
    basePriceUsd: { personal: 29, commercial: 69 },
    changelog: ["1.0.0 - Initial release"],
    faq: [{ q: "Can I use custom fonts?", a: "Yes, font variables are configured." }],
    reviews: [{ name: "Farid", message: "Simple and elegant.", rating: 5 }],
    isNew: false,
    isBestSeller: false
  },
  {
    id: "prd-6",
    slug: "kit-neo",
    title: "Kit Neo",
    summary: "Reusable UI kit with buttons, cards, and marketing sections.",
    description: "Component-first template kit for rapid product page building.",
    coverImage: "https://picsum.photos/seed/kit-neo/1200/760",
    demoUrl: "https://example.com/demo/kit-neo",
    isBundle: true,
    status: "published",
    category: "ui-kits-components",
    tags: ["Components", "Tailwind", "Dark Mode"],
    tech: ["React", "Tailwind"],
    rtl: false,
    responsive: true,
    includes: ["Source code", "Token map", "Examples"],
    versions: ["1.0.0", "1.3.0"],
    basePriceUsd: { personal: 59, commercial: 129 },
    changelog: ["1.3.0 - Added eCommerce sections", "1.0.0 - Initial release"],
    faq: [{ q: "Can I use parts of it in multiple apps?", a: "Yes, under Commercial license." }],
    reviews: [{ name: "John", message: "Saved us weeks of UI work.", rating: 5 }],
    isNew: true,
    isBestSeller: false
  }
];

export const WHY_POINTS = [
  {
    title: "Fast Launch",
    description: "Production-ready pages with clear conversion-focused structure."
  },
  {
    title: "Clean Architecture",
    description: "Scalable layout and reusable components for long-term maintenance."
  },
  {
    title: "RTL + i18n Ready",
    description: "Built-in support for Persian locales and English out of the box."
  }
];
