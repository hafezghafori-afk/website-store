import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RecordAuditEventInput = {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Prisma.InputJsonValue;
};

export async function recordAuditEvent(input: RecordAuditEventInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        details: input.details
      }
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[audit] failed to persist event:", error);
    }
  }
}
