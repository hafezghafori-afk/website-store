"use client";

import { useState } from "react";

type ManualReceiptFormProps = {
  orderId: string;
  existingReference?: string;
  existingReceiptUrl?: string;
  submittedAt?: string;
};

type ManualReceiptResponse = {
  ok: boolean;
  message?: string;
};

export function ManualReceiptForm({
  orderId,
  existingReference,
  existingReceiptUrl,
  submittedAt
}: ManualReceiptFormProps) {
  const [reference, setReference] = useState(existingReference ?? "");
  const [receiptUrl, setReceiptUrl] = useState(existingReceiptUrl ?? "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/payments/manual-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          reference: reference.trim(),
          receiptUrl: receiptUrl.trim() || undefined,
          note: note.trim() || undefined
        })
      });

      const result = (await response.json()) as ManualReceiptResponse;
      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Could not submit receipt.");
        return;
      }

      setStatus("success");
      setMessage(result.message ?? "Receipt submitted.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Manual Transfer Verification</p>
      <p className="mt-1 text-xs text-amber-800">Submit your transfer reference so admin can verify and unlock downloads.</p>
      {submittedAt ? (
        <p className="mt-2 text-xs text-emerald-700">Receipt submitted. You can update and resubmit if needed.</p>
      ) : null}
      <form className="mt-3 space-y-2" onSubmit={onSubmit}>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Transfer/Receipt Reference"
          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
        />
        <input
          value={receiptUrl}
          onChange={(event) => setReceiptUrl(event.target.value)}
          placeholder="Receipt URL (optional)"
          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
        />
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note for admin (optional)"
          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
          rows={2}
        />
        <button
          type="submit"
          disabled={status === "loading" || reference.trim().length < 2}
          className="secondary-btn w-full text-xs disabled:opacity-60"
        >
          {status === "loading" ? "Submitting..." : "Submit Receipt"}
        </button>
      </form>
      {message ? (
        <p className={status === "error" ? "mt-2 text-xs text-red-600" : "mt-2 text-xs text-emerald-700"}>{message}</p>
      ) : null}
    </div>
  );
}
