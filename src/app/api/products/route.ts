import { NextResponse } from "next/server";
import { getStoreProducts } from "@/lib/catalog";
import { BASE_CURRENCY, type Currency, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { filterProducts } from "@/lib/products";

function getCurrency(input: string | null): Currency {
  if (input && (SUPPORTED_CURRENCIES as readonly string[]).includes(input)) {
    return input as Currency;
  }
  return BASE_CURRENCY;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;
  const sort = searchParams.get("sort") ?? "new";
  const licenseType = searchParams.get("licenseType") === "commercial" ? "commercial" : "personal";
  const currency = getCurrency(searchParams.get("currency"));

  const minRaw = searchParams.get("min") ? Number(searchParams.get("min")) : undefined;
  const maxRaw = searchParams.get("max") ? Number(searchParams.get("max")) : undefined;
  const min = typeof minRaw === "number" && Number.isFinite(minRaw) ? minRaw : undefined;
  const max = typeof maxRaw === "number" && Number.isFinite(maxRaw) ? maxRaw : undefined;

  const products = await getStoreProducts();
  const filtered = filterProducts(products, {
    search,
    category: searchParams.get("category") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    tech: searchParams.get("tech") ?? undefined,
    rtl: searchParams.get("rtl") ?? undefined,
    min,
    max,
    sort,
    license: licenseType,
    currency
  });

  return NextResponse.json({
    ok: true,
    source: "catalog",
    count: filtered.length,
    items: filtered
  });
}
