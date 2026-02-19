import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Vazirmatn } from "next/font/google";
import "@/app/globals.css";
import { isClerkEnabled } from "@/lib/clerk-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap"
});

function resolveMetadataBase() {
  const fallback = "http://localhost:3002";
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? fallback);
  } catch {
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  title: "TemplateBaz | Minimal Template Store",
  description: "Template marketplace MVP with multi-language storefront and secure downloads.",
  metadataBase: resolveMetadataBase(),
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "TemplateBaz | Minimal Template Store",
    description: "Template marketplace MVP with multi-language storefront and secure downloads.",
    images: ["/icon.svg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkEnabled = isClerkEnabled();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${vazirmatn.variable} font-sans antialiased`}>
        {clerkEnabled ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
