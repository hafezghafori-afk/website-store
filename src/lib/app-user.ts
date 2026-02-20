import { DEFAULT_LOCALE } from "@/lib/constants";
import { isClerkEnabled } from "@/lib/clerk-config";
import { prisma } from "@/lib/prisma";

function getPrimaryEmail(user: any) {
  if (!user) {
    return null;
  }
  const primaryId = user.primaryEmailAddressId;
  const primary = user.emailAddresses.find((item: any) => item.id === primaryId);
  return primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function getDisplayName(user: any) {
  if (!user) {
    return null;
  }
  const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (composed) {
    return composed;
  }
  return user.username ?? null;
}

export async function requireAppUser() {
  try {
    if (!isClerkEnabled()) {
      const existing = await prisma.user.findFirst({
        orderBy: {
          createdAt: "asc"
        }
      });

      if (existing) {
        return existing;
      }

      return prisma.user.create({
        data: {
          clerkId: "dev-local-user",
          email: "dev-local@example.com",
          name: "Local Dev User",
          country: "US",
          locale: DEFAULT_LOCALE,
          preferredCurrency: "USD"
        }
      });
    }

    const clerk = await import("@clerk/nextjs/server");
    const { userId } = clerk.auth();
    const currentUser = clerk.currentUser;
    if (!userId) {
      return null;
    }

    const clerkUser = await currentUser();
    const email = getPrimaryEmail(clerkUser) ?? `${userId}@clerk.local`;
    const name = getDisplayName(clerkUser);

    const publicMetadata = (clerkUser?.publicMetadata ?? {}) as {
      country?: string;
      locale?: string;
    };

    const locale = publicMetadata.locale ?? DEFAULT_LOCALE;
    const country = publicMetadata.country ?? null;

    const existingByClerkId = await prisma.user.findUnique({
      where: { clerkId: userId }
    });

    if (existingByClerkId) {
      return prisma.user.update({
        where: { id: existingByClerkId.id },
        data: {
          email,
          name,
          country,
          locale
        }
      });
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email }
    });

    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: userId,
          name,
          country,
          locale
        }
      });
    }

    return prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        country,
        locale,
        preferredCurrency: "USD"
      }
    });
  } catch (error) {
    console.error("[requireAppUser] failed to resolve user context", error);
    return null;
  }
}
