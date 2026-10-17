import crypto from "crypto";
import { config } from "./config";
import type { Lang } from "./types";

const API = "https://api.retellai.com";

export const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", es: "Spanish" };

export interface CallVariables {
  organization_name: string;
  resident_name: string;
  preferred_language: string;
  notice_title: string;
  notice_body: string;
  is_simulated: string;
}

// POST /v2/create-phone-call. The attempt id doubles as Retell's idempotency key,
// so a retried request never dials the same person twice.
export async function createPhoneCall(opts: {
  to: string;
  lang: Lang;
  attemptId: string;
  metadata: Record<string, string | number>;
  variables: CallVariables;
}): Promise<{ call_id: string }> {
  const agentId = config.retell.agentIds[opts.lang] || config.retell.agentIds.en;
  const body: Record<string, unknown> = {
    from_number: config.retell.fromNumber,
    to_number: opts.to,
    override_agent_id: agentId,
    idempotency_key: opts.attemptId,
    metadata: opts.metadata,
    retell_llm_dynamic_variables: opts.variables,
  };
  // Pin an integer version for the demo so a dashboard edit can't change behavior mid-demo.
  // Omitted = Retell uses the latest version.
  if (/^\d+$/.test(config.retell.agentVersion)) body.override_agent_version = Number(config.retell.agentVersion);

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(`${API}/v2/create-phone-call`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.retell.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    // 429 = calls-per-second limit (default 1). Wait and retry once; the idempotency key prevents double dials.
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  const text = await res!.text();
  const resOk = res!.ok;
  const status = res!.status;
  if (!resOk) throw new Error(`Retell create-phone-call failed (${status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// X-Retell-Signature is "v={timestamp_ms},d={hex}" where hex = HMAC-SHA256(rawBody + timestamp, key).
// Must use the raw body string, not re-serialized JSON. Rejects anything older than 5 minutes.
export function verifyRetellSignature(rawBody: string, header: string | null, key: string, nowMs = Date.now()): boolean {
  if (!header || !key) return false;
  const m = /v=(\d+),d=(.*)/.exec(header);
  if (!m) return false;
  const [, ts, digest] = m;
  if (Math.abs(nowMs - Number(ts)) > 5 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", key).update(rawBody + ts).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(digest.trim(), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Map Retell's disconnection_reason to our delivery_status + failure_reason.
// "completed" means we connected; whether they engaged is decided by call_analyzed.
export function mapDisconnection(reason: string | undefined, inVoicemail?: boolean) {
  const r = reason ?? "";
  if (inVoicemail || r === "voicemail_reached") return { delivery_status: "voicemail" as const, failure_reason: "voicemail" };
  if (r === "dial_no_answer" || r === "user_declined") return { delivery_status: "no_answer" as const, failure_reason: r };
  if (r === "dial_busy") return { delivery_status: "failed" as const, failure_reason: "busy" };
  if (r === "invalid_destination") return { delivery_status: "failed" as const, failure_reason: "invalid_number" };
  if (r === "ivr_reached") return { delivery_status: "failed" as const, failure_reason: "ivr_reached" };
  if (["marked_as_spam", "network_blocked"].includes(r)) return { delivery_status: "failed" as const, failure_reason: "carrier_blocked" };
  if (["dial_failed", "telephony_provider_unavailable", "telephony_provider_permission_denied", "sip_routing_error"].includes(r))
    return { delivery_status: "failed" as const, failure_reason: "network_down" };
  if (r.startsWith("error_") || ["concurrency_limit_reached", "no_valid_payment", "credit_exhausted", "budget_reached", "scam_detected", "registered_call_timeout"].includes(r))
    return { delivery_status: "failed" as const, failure_reason: "provider_error" };
  return { delivery_status: "completed" as const, failure_reason: null };
}
