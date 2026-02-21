import Link from "next/link";
import { Container } from "@/components/container";

const POSTS = [
  {
    slug: "choose-template-license",
    title: "How to choose the right template license",
    summary: "Personal vs Commercial explained with practical examples."
  },
  {
    slug: "secure-download-best-practices",
    title: "Secure download flow for digital products",
    summary: "Signed URLs, expiration windows, and audit logging essentials."
  },
  {
    slug: "speed-up-template-launch",
    title: "Launch a template store in days, not months",
    summary: "A practical MVP roadmap for catalog, checkout, and delivery."
  }
];

export default function BlogPage({ params }: { params: { locale: string } }) {
  const isFa = params.locale === "fa";

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Blog</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{isFa ? "آموزش و مقالات" : "Guides & Articles"}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          {isFa
            ? "محتوای آموزشی برای خرید، استفاده و توسعه تمپلیت‌ها."
            : "Educational content around buying, using, and scaling template products."}
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {POSTS.map((post) => (
          <article key={post.slug} className="surface-card space-y-3 p-5">
            <h2 className="text-lg font-bold">{post.title}</h2>
            <p className="text-sm leading-7 text-slate-600">{post.summary}</p>
            <Link href={`/${params.locale}/docs`} className="secondary-btn w-full text-sm">
              {isFa ? "مطالعه" : "Read"}
            </Link>
          </article>
        ))}
      </section>
    </Container>
  );
}
