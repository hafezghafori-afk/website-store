import { NextResponse } from "next/server";
import { getStoreProductBySlug } from "@/lib/catalog";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const product = await getStoreProductBySlug(params.slug);

  if (!product) {
    return NextResponse.json(
      {
        ok: false,
        message: "Product not found"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "catalog",
    item: product
  });
}
