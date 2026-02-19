import { z } from "zod";
import { BASE_CURRENCY, LICENSE_TYPES, SUPPORTED_CURRENCIES } from "@/lib/constants";
import type { PaymentProvider } from "@/lib/types";

const providerValues: PaymentProvider[] = ["stripe", "zarinpal", "manual-af"];

export const checkoutSchema = z.object({
  productId: z.string().min(1),
  licenseType: z.enum(LICENSE_TYPES),
  currency: z.enum(SUPPORTED_CURRENCIES).default(BASE_CURRENCY),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/),
  provider: z.enum(providerValues as [PaymentProvider, ...PaymentProvider[]]),
  couponCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional()
});

export const downloadSchema = z.object({
  productId: z.string().min(1)
});

export const manualReceiptSchema = z.object({
  orderId: z.string().min(1),
  reference: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional(),
  receiptUrl: z.string().trim().url().max(500).optional()
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  email: z.string().trim().email().max(320).optional(),
  name: z.string().trim().min(2).max(120).optional()
});

export const supportTicketReplySchema = z.object({
  message: z.string().trim().min(2).max(4000)
});

const supportTicketStatuses = ["open", "in_progress", "resolved", "closed"] as const;

export const supportTicketStatusSchema = z.enum(supportTicketStatuses);

export const adminSupportTicketActionSchema = z
  .object({
    id: z.string().trim().min(1),
    status: supportTicketStatusSchema.optional(),
    reply: z.string().trim().min(2).max(4000).optional()
  })
  .refine((value) => Boolean(value.status || value.reply), {
    message: "At least one action (status or reply) is required."
  });

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  locale: z.enum(["fa", "en"]).optional(),
  preferredCurrency: z.enum(SUPPORTED_CURRENCIES).default(BASE_CURRENCY)
});
