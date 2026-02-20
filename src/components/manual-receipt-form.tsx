"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type ManualReceiptFormProps = {
  orderId: string;
  existingReference?: string;
  existingReceiptUrl?: string;
  submittedAt?: string;
};

type ManualReceiptResponse = {
  ok: boolean;
  message?: string;
  receiptUrl?: string | null;
};

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export function ManualReceiptForm({
  orderId,
  existingReference,
  existingReceiptUrl,
  submittedAt
}: ManualReceiptFormProps) {
  const [reference, setReference] = useState(existingReference ?? "");
  const [receiptUrl, setReceiptUrl] = useState(existingReceiptUrl ?? "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(receiptFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [receiptFile]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const body = new FormData();
      body.append("orderId", orderId);
      body.append("reference", reference.trim());
      if (receiptUrl.trim() && isAbsoluteUrl(receiptUrl)) {
        body.append("receiptUrl", receiptUrl.trim());
      }
      if (note.trim()) {
        body.append("note", note.trim());
      }
      if (receiptFile) {
        body.append("receiptFile", receiptFile);
      }

      const response = await fetch("/api/payments/manual-receipt", {
        method: "POST",
        body
      });

      const result = (await response.json()) as ManualReceiptResponse;
      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Could not submit receipt.");
        return;
      }

      setStatus("success");
      setMessage(result.message ?? "Receipt submitted.");
      if (typeof result.receiptUrl === "string" && result.receiptUrl.trim().length > 0) {
        setReceiptUrl(result.receiptUrl);
      }
      setReceiptFile(null);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  }

  function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setReceiptFile(file);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Manual Transfer Verification</p>
      <p className="mt-1 text-xs text-amber-800">Submit your transfer reference and receipt photo so admin can verify and unlock downloads.</p>
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
        <div className="rounded-lg border border-amber-200 bg-white p-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Receipt Image</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="secondary-btn px-3 py-1.5 text-xs"
            >
              Choose From Gallery / Files
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="secondary-btn px-3 py-1.5 text-xs"
            >
              Take Photo
            </button>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelected}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileSelected}
            className="hidden"
          />
          {receiptFile ? (
            <p className="mt-2 text-xs text-slate-700">
              Selected: {receiptFile.name} ({Math.max(1, Math.round(receiptFile.size / 1024))} KB)
            </p>
          ) : null}
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Receipt preview"
              width={320}
              height={240}
              unoptimized
              className="mt-2 max-h-40 w-auto rounded-md border border-amber-200 object-contain"
            />
          ) : null}
        </div>
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
      {receiptUrl ? (
        <a href={receiptUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-700 underline">
          View submitted receipt
        </a>
      ) : null}
      {message ? (
        <p className={status === "error" ? "mt-2 text-xs text-red-600" : "mt-2 text-xs text-emerald-700"}>{message}</p>
      ) : null}
    </div>
  );
}
