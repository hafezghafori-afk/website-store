import type { Currency } from "@/lib/constants";

type ZarinpalRequestResult = {
  ok: boolean;
  authority?: string;
  gatewayUrl?: string;
  code?: number;
  message?: string;
  raw?: unknown;
};

type ZarinpalVerifyResult = {
  ok: boolean;
  alreadyVerified?: boolean;
  code?: number;
  refId?: number;
  cardPan?: string | null;
  feeType?: string | null;
  fee?: number | null;
  message?: string;
  raw?: unknown;
};

function toNumber(input: string | undefined, fallback: number) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function isTruthy(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function createMockAuthority() {
  return `A${Date.now()}${Math.floor(Math.random() * 100000).toString().padStart(5, "0")}`;
}

function appendQuery(urlString: string, params: Record<string, string>) {
  const url = new URL(urlString);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function isZarinpalMockMode() {
  return isTruthy(process.env.ZARINPAL_MOCK_MODE);
}

export function isZarinpalConfigured() {
  return isZarinpalMockMode() || Boolean(process.env.ZARINPAL_MERCHANT_ID);
}

function getZarinpalRequestUrl() {
  return process.env.ZARINPAL_REQUEST_URL ?? "https://payment.zarinpal.com/pg/v4/payment/request.json";
}

function getZarinpalVerifyUrl() {
  return process.env.ZARINPAL_VERIFY_URL ?? "https://payment.zarinpal.com/pg/v4/payment/verify.json";
}

function getZarinpalStartPayBase() {
  return process.env.ZARINPAL_STARTPAY_URL ?? "https://payment.zarinpal.com/pg/StartPay/";
}

export function toIrrAmount(amount: number, currency: Currency) {
  if (currency === "USD") {
    const irrPerUsd = toNumber(process.env.IRR_PER_USD, 650000);
    return Math.max(1000, Math.round(amount * irrPerUsd));
  }

  const irrPerEur = toNumber(process.env.IRR_PER_EUR, 700000);
  return Math.max(1000, Math.round(amount * irrPerEur));
}

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function createZarinpalPaymentRequest(input: {
  amountIrr: number;
  callbackUrl: string;
  description: string;
  email?: string | null;
}) {
  if (isZarinpalMockMode()) {
    const authority = createMockAuthority();
    return {
      ok: true,
      authority,
      gatewayUrl: appendQuery(input.callbackUrl, {
        Authority: authority,
        Status: "OK"
      }),
      code: 100,
      message: "Mock mode: payment initialized."
    } satisfies ZarinpalRequestResult;
  }

  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    return {
      ok: false,
      message: "Zarinpal merchant id is missing."
    } satisfies ZarinpalRequestResult;
  }

  const payload = {
    merchant_id: merchantId,
    amount: Math.round(input.amountIrr),
    callback_url: input.callbackUrl,
    description: input.description,
    metadata: input.email ? { email: input.email } : {}
  };

  const response = await fetch(getZarinpalRequestUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = (await response.json()) as unknown;
  const root = asRecord(raw);
  const data = asRecord(root.data);
  const errors = asRecord(root.errors);
  const code = typeof data.code === "number" ? data.code : typeof errors.code === "number" ? errors.code : undefined;
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof errors.message === "string" && errors.message) ||
    (typeof root.message === "string" ? root.message : undefined);

  const authority = typeof data.authority === "string" ? data.authority : undefined;
  if (!response.ok || !authority || (code !== undefined && code !== 100)) {
    return {
      ok: false,
      code,
      message: message ?? "Zarinpal request failed.",
      raw
    } satisfies ZarinpalRequestResult;
  }

  return {
    ok: true,
    authority,
    gatewayUrl: `${getZarinpalStartPayBase()}${authority}`,
    code,
    message,
    raw
  } satisfies ZarinpalRequestResult;
}

export async function verifyZarinpalPayment(input: {
  authority: string;
  amountIrr: number;
}) {
  if (isZarinpalMockMode()) {
    const refIdBase = Number(String(input.authority).replace(/\D/g, "").slice(-10));
    return {
      ok: true,
      alreadyVerified: false,
      code: 100,
      message: "Mock mode: verification succeeded.",
      refId: Number.isFinite(refIdBase) && refIdBase > 0 ? refIdBase : Date.now(),
      cardPan: "6037****1234",
      feeType: "Merchant",
      fee: 0
    } satisfies ZarinpalVerifyResult;
  }

  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    return {
      ok: false,
      message: "Zarinpal merchant id is missing."
    } satisfies ZarinpalVerifyResult;
  }

  const response = await fetch(getZarinpalVerifyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      merchant_id: merchantId,
      amount: Math.round(input.amountIrr),
      authority: input.authority
    })
  });

  const raw = (await response.json()) as unknown;
  const root = asRecord(raw);
  const data = asRecord(root.data);
  const errors = asRecord(root.errors);
  const code = typeof data.code === "number" ? data.code : typeof errors.code === "number" ? errors.code : undefined;
  const message =
    (typeof data.message === "string" && data.message) ||
    (typeof errors.message === "string" && errors.message) ||
    (typeof root.message === "string" ? root.message : undefined);
  const refId = typeof data.ref_id === "number" ? data.ref_id : undefined;
  const cardPan = typeof data.card_pan === "string" ? data.card_pan : null;
  const feeType = typeof data.fee_type === "string" ? data.fee_type : null;
  const fee = typeof data.fee === "number" ? data.fee : null;

  if (!response.ok || (code !== 100 && code !== 101)) {
    return {
      ok: false,
      code,
      message: message ?? "Zarinpal verification failed.",
      refId,
      cardPan,
      feeType,
      fee,
      raw
    } satisfies ZarinpalVerifyResult;
  }

  return {
    ok: true,
    alreadyVerified: code === 101,
    code,
    message,
    refId,
    cardPan,
    feeType,
    fee,
    raw
  } satisfies ZarinpalVerifyResult;
}
