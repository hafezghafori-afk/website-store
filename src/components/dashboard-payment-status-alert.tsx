type DashboardPaymentStatusAlertProps = {
  paymentStatus?: string;
  paymentProvider?: string;
};

export function DashboardPaymentStatusAlert({ paymentStatus = "", paymentProvider = "" }: DashboardPaymentStatusAlertProps) {
  const normalizedStatus = paymentStatus.toLowerCase();
  const normalizedProvider = paymentProvider.toLowerCase();
  const providerSuffix = normalizedProvider ? ` (${normalizedProvider})` : "";

  if (normalizedStatus === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        Payment confirmed. Your downloads are now available.
      </div>
    );
  }

  if (normalizedStatus === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Payment is pending verification{providerSuffix}. You can submit receipt details below for manual review.
      </div>
    );
  }

  if (normalizedStatus === "cancelled") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Payment was cancelled{providerSuffix}. You can retry checkout anytime.
      </div>
    );
  }

  if (normalizedStatus === "failed") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Payment failed{providerSuffix}. Please retry checkout or contact support.
      </div>
    );
  }

  return null;
}
