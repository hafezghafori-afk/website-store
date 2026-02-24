import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/server-auth";

function canUseAdminApi() {
  if (!isClerkEnabled()) {
    return { ok: true as const };
  }

  const { userId } = auth();
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }) };
  }

  if (!isAdminUser()) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "Admin access required." }, { status: 403 })
    };
  }

  return { ok: true as const };
}

function parseDateStart(input?: string | null) {
  if (!input) {
    return null;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(input?: string | null) {
  if (!input) {
    return null;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setHours(23, 59, 59, 999);
  return date;
}

function csvCell(value: unknown) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const access = canUseAdminApi();
  if (!access.ok) {
    return access.response;
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "all").trim();
  const currency = (url.searchParams.get("currency") ?? "all").trim().toUpperCase();
  const provider = (url.searchParams.get("provider") ?? "all").trim();
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const daysRaw = Number(url.searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.round(daysRaw))) : 30;

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - (days - 1));
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now);
  defaultTo.setHours(23, 59, 59, 999);

  const fromDate = parseDateStart(fromRaw) ?? defaultFrom;
  const toDate = parseDateEnd(toRaw) ?? defaultTo;

  const where: any = {
    createdAt: {
      gte: fromDate,
      lte: toDate
    }
  };

  const andConditions: any[] = [];
  if (status !== "all") {
    andConditions.push({ status });
  }
  if (currency === "USD" || currency === "EUR") {
    andConditions.push({ currency });
  }
  if (provider !== "all") {
    andConditions.push({ payments: { some: { provider } } });
  }
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      },
      items: {
        include: {
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  slug: true,
                  title: true
                }
              }
            }
          }
        }
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    take: 5000
  });

  const rows = orders.map((order) => {
    const latestPayment = order.payments[0];
    return {
      orderId: order.id,
      createdAt: order.createdAt.toISOString(),
      userId: order.userId,
      userEmail: order.user.email,
      userName: order.user.name ?? "",
      status: order.status,
      currency: order.currency,
      total: order.total,
      paymentProvider: latestPayment?.provider ?? "",
      paymentStatus: latestPayment?.status ?? "",
      paymentRef: latestPayment?.providerRef ?? "",
      itemCount: order.items.length,
      itemTitles: order.items.map((item) => item.productVariant.product.title).join(" | "),
      itemLicenses: order.items.map((item) => item.productVariant.licenseType).join(" | ")
    };
  });

  const csv = toCsv(rows);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="admin-orders-report-${stamp}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
