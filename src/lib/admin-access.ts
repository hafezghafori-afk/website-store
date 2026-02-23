import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/clerk-config";
import { getCurrentUserId, isAdminUser } from "@/lib/server-auth";

export function ensureAdminAccess(locale: string) {
  const clerkEnabled = isClerkEnabled();

  if (clerkEnabled) {
    const userId = getCurrentUserId();
    if (!userId) {
      redirect(`/${locale}/login`);
    }

    if (!isAdminUser()) {
      redirect(`/${locale}/admin`);
    }
  }

  return { clerkEnabled };
}
