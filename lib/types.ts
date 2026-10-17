// Shared types. These mirror the team contract in docs/CONTRACT.md.
// Rules: IDs are strings, times are ISO 8601 UTC, phones are E.164,
// null = unknown/unanswered, false = explicit "no". The backend is the source of truth.

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];

export type ContactStatus = "pending" | "in_progress" | "acknowledged" | "not_reached" | "opted_out";
// null = unknown (we never heard back). "closed" can only be set by a coordinator.
export type AssistanceStatus = null | "none" | "requested" | "in_progress" | "closed";
export type DeliveryStatus = "queued" | "ringing" | "completed" | "no_answer" | "voicemail" | "failed";
export type Channel = "voice" | "sms";
export type NoticeMode = "routine" | "emergency";
export type NoticeStatus = "active" | "cancelled";

export interface Contact {
  id: string;
  display_name: string;
  phone: string; // E.164, e.g. "+19095551234". Never returned by the status API.
  preferred_language: Lang;
  address: string | null;
  opted_out: boolean;
  // Only one SMS question can be open per contact (team rule).
  active_sms_outreach_id: string | null;
  // Set when a new SMS question replaced an unanswered one; the next reply gets flagged for review.
  replaced_open_question?: boolean;
}

export interface NoticeVersion {
  version: number;
  title: string;
  body: Record<Lang, string>;
  change_note: string | null;
  created_at: string;
}

export interface Notice {
  id: string;
  mode: NoticeMode;
  status: NoticeStatus;
  approved: boolean;
  simulated: boolean;
  region: string;
  current_version: number;
  versions: NoticeVersion[];
  created_at: string;
  updated_at: string;
}

export interface Outreach {
  id: string;
  notice_id: string;
  notice_version: number;
  contact_id: string;
  contact_status: ContactStatus;
  assistance_status: AssistanceStatus;
  understood: boolean | null;
  needs_transport: boolean | null;
  mobility_needs: string | null;
  callback_requested: boolean | null;
  needs_confirmed: boolean | null;
  acknowledged_version: number | null;
  acknowledged_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
  coordinator_notes: { at: string; text: string }[];
  call_summary: string | null;
  attempt_ids: string[];
  next_retry_at: string | null;
  cancelled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attempt {
  id: string;
  outreach_id: string;
  contact_id: string;
  notice_id: string;
  notice_version: number;
  channel: Channel;
  retell_call_id: string | null;
  provider_message_id: string | null;
  is_simulated: boolean;
  started_at: string;
  ended_at: string | null;
  delivery_status: DeliveryStatus;
  failure_reason: string | null;
}

// Enzo's normalized inbound message format (with `from` renamed to `from_number`).
export interface InboundMessage {
  provider_message_id: string;
  outreach_id: string | null;
  from_number: string;
  body: string;
  received_at: string;
  is_simulated: boolean;
  parsed_choice: "1" | "2" | "stop" | null;
  match_status: "matched" | "needs_review" | "opted_out" | "unmatched";
}

export interface DB {
  contacts: Contact[];
  notices: Notice[];
  outreach: Outreach[];
  attempts: Attempt[];
  messages: InboundMessage[];
  processed_events: string[];
  settings: { network_failure: boolean };
  counters: Record<string, number>;
}

// One row on the coordinator dashboard (Abdullah's contract + the agreed additions).
export interface DashboardRow {
  outreach_id: string;
  contact_id: string;
  display_name: string;
  preferred_language: Lang;
  contact_status: ContactStatus;
  assistance_status: AssistanceStatus;
  understood: boolean | null;
  needs_transport: boolean | null;
  mobility_needs: string | null;
  callback_requested: boolean | null;
  needs_confirmed: boolean | null;
  acknowledged_version: number | null;
  last_channel: Channel | null;
  last_delivery_status: DeliveryStatus | null;
  last_failure_reason: string | null;
  needs_review: boolean;
  review_reason: string | null;
  is_simulated: boolean;
  attempt_count: number;
  next_retry_at: string | null;
  coordinator_notes: { at: string; text: string }[];
  updated_at: string;
}

export interface DashboardResponse {
  notice: {
    id: string;
    version: number;
    current_version: number;
    title: string;
    mode: NoticeMode;
    status: NoticeStatus;
    simulated: boolean;
    region: string;
  };
  rows: DashboardRow[];
  refreshed_at: string;
  meta: { network_failure: boolean; demo_mode: boolean; voice_provider: "retell" | "simulated"; sms_provider: "twilio" | "simulated" };
}
