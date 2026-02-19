"use client";

import { useState } from "react";

type DownloadButtonProps = {
  productId: string;
};

type DownloadResponse = {
  ok: boolean;
  url?: string;
  version?: string;
  message?: string;
};

export function DownloadButton({ productId }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDownload() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId
        })
      });

      const result = (await response.json()) as DownloadResponse;
      if (!response.ok || !result.ok || !result.url) {
        setMessage(result.message ?? "Download failed.");
        return;
      }

      setMessage(result.version ? `Secure link ready (version ${result.version}).` : "Secure link ready.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleDownload} disabled={loading} className="primary-btn w-full text-sm disabled:opacity-60">
        {loading ? "Generating..." : "Download Securely"}
      </button>
      {message ? <p className="text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}
