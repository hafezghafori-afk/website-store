import { hashApiKey } from "@/lib/api-keys";
import { requireAppUser } from "@/lib/app-user";
import { prisma } from "@/lib/prisma";

function extractApiKey(request: Request) {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) {
    return headerKey;
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return token;
    }
  }

  return null;
}

export async function resolveRequestUser(request: Request) {
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const keyHash = hashApiKey(apiKey);
    const matched = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true
      },
      include: {
        user: true
      }
    });

    if (matched) {
      await prisma.apiKey.update({
        where: {
          id: matched.id
        },
        data: {
          lastUsedAt: new Date()
        }
      });

      return {
        user: matched.user,
        authType: "api_key" as const
      };
    }
  }

  const appUser = await requireAppUser();
  if (!appUser) {
    return null;
  }

  return {
    user: appUser,
    authType: "session" as const
  };
}
