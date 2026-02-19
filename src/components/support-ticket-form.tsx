"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SupportTicketFormProps = {
  initialName?: string;
  initialEmail?: string;
};

type TicketReply = {
  id: string;
  authorType: "user" | "admin" | "system";
  message: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
};

type TicketItem = {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
  replies: TicketReply[];
};

type SupportResponse = {
  ok: boolean;
  message?: string;
  ticket?: {
    id: string;
    subject: string;
    status: string;
    createdAt: string;
  };
};

type TicketListResponse = {
  ok: boolean;
  message?: string;
  items?: TicketItem[];
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export function SupportTicketForm({ initialName, initialEmail }: SupportTicketFormProps) {
  const [name, setName] = useState(initialName ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);
  const [replyMessages, setReplyMessages] = useState<Record<string, { type: "ok" | "error"; text: string }>>({});

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [tickets]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const response = await fetch("/api/support/tickets", {
        cache: "no-store"
      });
      const result = (await response.json()) as TicketListResponse;
      if (response.ok && result.ok) {
        setTickets(result.items ?? []);
      }
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          subject: subject.trim(),
          message: messageBody.trim()
        })
      });

      const result = (await response.json()) as SupportResponse;
      if (!response.ok || !result.ok) {
        setStatus("error");
        setMessage(result.message ?? "Could not submit support request.");
        return;
      }

      setStatus("success");
      setMessage(result.message ?? "Support request submitted.");
      setSubject("");
      setMessageBody("");
      await loadTickets();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected support error.");
    }
  }

  async function onReplySubmit(ticketId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = (replyDrafts[ticketId] ?? "").trim();
    if (draft.length < 2) {
      return;
    }

    setReplyBusyId(ticketId);
    setReplyMessages((current) => {
      const next = { ...current };
      delete next[ticketId];
      return next;
    });

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: draft
        })
      });

      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !result.ok) {
        setReplyMessages((current) => ({
          ...current,
          [ticketId]: {
            type: "error",
            text: result.message ?? "Reply failed."
          }
        }));
        return;
      }

      setReplyDrafts((current) => ({
        ...current,
        [ticketId]: ""
      }));
      setReplyMessages((current) => ({
        ...current,
        [ticketId]: {
          type: "ok",
          text: "Reply sent."
        }
      }));
      await loadTickets();
    } catch (error) {
      setReplyMessages((current) => ({
        ...current,
        [ticketId]: {
          type: "error",
          text: error instanceof Error ? error.message : "Unexpected reply error."
        }
      }));
    } finally {
      setReplyBusyId(null);
    }
  }

  return (
    <div className="surface-card space-y-6 p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <h2 className="text-lg font-bold">Submit a Support Request</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
        </div>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={messageBody}
          onChange={(event) => setMessageBody(event.target.value)}
          placeholder="Describe your issue..."
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
          rows={5}
        />
        <button
          type="submit"
          disabled={status === "loading" || subject.trim().length < 3 || messageBody.trim().length < 10}
          className="primary-btn text-sm disabled:opacity-60"
        >
          {status === "loading" ? "Submitting..." : "Send Request"}
        </button>
        {message ? <p className={status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>{message}</p> : null}
      </form>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-base font-bold">Your Tickets</h3>
        {ticketsLoading ? <p className="mt-3 text-sm text-slate-500">Loading tickets...</p> : null}
        {!ticketsLoading && sortedTickets.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No tickets yet.</p>
        ) : null}
        <div className="mt-3 space-y-4">
          {sortedTickets.map((ticket) => (
            <article key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{ticket.subject}</span>
                <span>{ticket.status}</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="mt-2 space-y-2 text-xs">
                <p className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                  <span className="font-semibold text-slate-700">You:</span> {ticket.message}
                </p>
                {ticket.replies.map((reply) => (
                  <p key={reply.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1">
                    <span className="font-semibold text-slate-700">{reply.authorType === "admin" ? "Admin" : "You"}:</span>{" "}
                    {reply.message}
                  </p>
                ))}
              </div>
              <form onSubmit={(event) => void onReplySubmit(ticket.id, event)} className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  value={replyDrafts[ticket.id] ?? ""}
                  onChange={(event) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [ticket.id]: event.target.value
                    }))
                  }
                  placeholder="Write a follow-up reply..."
                  className="w-full rounded-lg border border-border bg-white px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  disabled={replyBusyId === ticket.id || (replyDrafts[ticket.id] ?? "").trim().length < 2}
                  className="secondary-btn px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {replyBusyId === ticket.id ? "Sending..." : "Reply"}
                </button>
                {replyMessages[ticket.id] ? (
                  <p className={replyMessages[ticket.id].type === "error" ? "text-xs text-red-600" : "text-xs text-emerald-700"}>
                    {replyMessages[ticket.id].text}
                  </p>
                ) : null}
              </form>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
