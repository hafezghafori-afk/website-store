import Link from "next/link";

export default function LocaleNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-4xl font-black tracking-tight">404</p>
      <p className="mt-3 text-slate-600">Page not found in this locale.</p>
      <Link href="/fa" className="primary-btn mt-6">
        Return Home
      </Link>
    </div>
  );
}
