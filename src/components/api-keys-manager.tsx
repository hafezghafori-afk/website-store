"use client";

import { useMemo, useState } from "react";

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type ApiKeysManagerProps = {
  initialKeys: ApiKeyItem[];
};

type ApiKeysResponse = {
  ok: boolean;
  message?: string;
  plainKey?: string;
  key?: ApiKeyItem;
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ApiKeysManager({ initialKeys }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [name, setName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const activeCount = useMemo(() => keys.filter((item) => item.isActive).length, [keys]);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setRevealedKey("");

    try {
      const response = await fetch("/api/me/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "create",
          name: name.trim() || "Default Key"
        })
      });

      const result = (await response.json()) as ApiKeysResponse;
      if (!response.ok || !result.ok || !result.key) {
        setStatus("error");
        setMessage(result.message ?? "Failed to create API key.");
        return;
      }

      setKeys((prev) => [result.key!, ...prev]);
      setRevealedKey(result.plainKey ?? "");
      setName("");
      setStatus("success");
      setMessage(result.message ?? "API key created.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected API key error.");
    }
  }

  async function revokeKey(id: string) {
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/me/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "revoke",
          id
        })
      });

      const result = (await response.json()) as ApiKeysResponse;
      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Could not revoke API key.");
        return;
      }

      setKeys((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                isActive: false,
                revokedAt: new Date().toISOString()
              }
            : item
        )
      );
      setStatus("success");
      setMessage(result.message ?? "API key revoked.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected API key error.");
    }
  }

  return (
    <article className="surface-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-black tracking-tight">API Keys</h2>
        <p className="text-xs text-slate-500">Active: {activeCount}</p>
      </div>

      <form className="flex flex-wrap gap-2" onSubmit={createKey}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name (e.g. Team CI)"
          className="min-w-[220px] flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
        <button type="submit" disabled={status === "loading"} className="primary-btn text-sm disabled:opacity-60">
          {status === "loading" ? "Working..." : "Generate Key"}
        </button>
      </form>

      {revealedKey ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-800">Copy now: this key is shown only once.</p>
          <p className="mt-1 break-all rounded-md bg-white p-2 font-mono text-xs text-emerald-900">{revealedKey}</p>
        </div>
      ) : null}

      {message ? (
        <p className={status === "error" ? "text-xs text-red-600" : "text-xs text-emerald-700"}>{message}</p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold text-text">API Usage</p>
        <p className="mt-1">Use header <code>Authorization: Bearer &lt;API_KEY&gt;</code> or <code>x-api-key</code>.</p>
        <p className="mt-1">Supported endpoints: <code>/api/me/orders</code>, <code>/api/me/downloads</code>, <code>/api/download</code>.</p>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-slate-600">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="rounded-xl border border-border bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{key.name}</p>
                <p className={key.isActive ? "text-xs text-emerald-700" : "text-xs text-slate-500"}>
                  {key.isActive ? "active" : "revoked"}
                </p>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-600">{key.keyPrefix}...</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <p>Created: {formatDate(key.createdAt)}</p>
                <p>Last used: {formatDate(key.lastUsedAt)}</p>
              </div>
              {key.isActive ? (
                <button
                  type="button"
                  onClick={() => revokeKey(key.id)}
                  className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
