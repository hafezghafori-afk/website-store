import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        surface: "#ffffff",
        text: "#111111",
        muted: "#64748b",
        border: "#e2e8f0",
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca"
        }
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "var(--font-inter)", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 30px rgba(2, 6, 23, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
