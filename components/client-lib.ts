"use client";
import type { DashboardRow } from "@/lib/types";

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Sign in first.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data as T;
}

const TZ = "America/Los_Angeles"; // storage is UTC; display is Pacific (team rule)
export const timePT = (iso: string | null | undefined) =>
  iso
    ? new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(iso)) + " PT"
    : "";

export const LANG_LABEL: Record<string, string> = { en: "EN", es: "ES" };

export const REASON: Record<string, string> = {
  no_answer: "No answer",
  dial_no_answer: "No answer",
  user_declined: "Declined the call",
  voicemail: "Went to voicemail",
  busy: "Line busy",
  network_down: "Network down",
  invalid_number: "Number not valid",
  provider_error: "Calling service error",
  carrier_blocked: "Blocked by carrier",
  no_response: "Picked up but didn’t answer the questions",
  ivr_reached: "Reached a phone menu",
};

export const REVIEW: Record<string, string> = {
  did_not_understand: "Said they didn’t understand the notice",
  needs_not_confirmed_on_call: "Needs weren’t confirmed on the call",
  reply_may_refer_to_old_notice: "Text reply may be about an older notice",
  reply_without_open_question: "Texted when no question was open",
  unrecognized_reply: "Text reply wasn’t 1 or 2",
  reply_after_notice_cancelled: "Replied after the notice was cancelled",
};

export type Lane = "help" | "miss" | "wait" | "ok";

export function laneOf(r: DashboardRow): Lane {
  if (r.needs_review || r.assistance_status === "requested" || r.assistance_status === "in_progress") return "help";
  if (r.contact_status === "not_reached" || r.contact_status === "opted_out") return "miss";
  if (r.contact_status === "pending" || r.contact_status === "in_progress") return "wait";
  return "ok";
}

export function describe(r: DashboardRow): string {
  const via = r.last_channel === "sms" ? "text" : "call";
  switch (r.contact_status) {
    case "pending":
      return "Queued to call";
    case "in_progress":
      return r.last_channel === "voice" ? "Calling now" : "Waiting on a reply";
    case "acknowledged": {
      const base = `Heard version ${r.acknowledged_version ?? "?"} by ${via}`;
      if (r.assistance_status === "closed") return `${base}. Case closed by a coordinator.`;
      if (r.assistance_status === "in_progress") return `${base}. Help in progress.`;
      if (r.assistance_status === "requested") return `${base}. Asked for help.`;
      return `${base}. Said no help needed.`;
    }
    case "opted_out":
      return "Asked not to be contacted again";
    case "not_reached": {
      if (r.last_channel === "sms" && r.last_delivery_status === "completed" && !r.last_failure_reason)
        return "Call didn’t connect. Text sent, no reply yet.";
      const reason = r.last_failure_reason ? REASON[r.last_failure_reason] ?? r.last_failure_reason : "Not reached";
      return `${reason} (last try: ${via})`;
    }
  }
}

export function needsOf(r: DashboardRow): string[] {
  const out: string[] = [];
  if (r.needs_transport) out.push("Transportation");
  if (r.mobility_needs) out.push(r.mobility_needs);
  if (r.callback_requested) out.push("Wants a call back");
  if (r.understood === false) out.push("Didn’t understand");
  return out;
}
