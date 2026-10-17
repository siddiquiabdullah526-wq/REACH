import crypto from "crypto";
import { config } from "@/lib/config";
import { handleInboundSms } from "@/lib/outreach";
import { isE164, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Twilio signs each webhook: base64(HMAC-SHA1(fullUrl + sorted key/value pairs, authToken)).
function validTwilioSignature(url: string, params: URLSearchParams, signature: string | null) {
  if (!signature) return false;
  const keys = Array.from(new Set(params.keys())).sort();
  const data = url + keys.map((k) => k + (params.get(k) ?? "")).join("");
  const expected = crypto.createHmac("sha1", config.twilio.authToken).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Inbound SMS. Accepts Twilio's form post, or Enzo's normalized JSON:
// { provider_message_id, from_number, body, received_at?, is_simulated? } with header x-reach-secret.
export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  let msg: { provider_message_id: string; from_number: string; body: string; received_at?: string; is_simulated: boolean };
  let twilio = false;

  if (type.includes("application/x-www-form-urlencoded")) {
    const f = new URLSearchParams(await req.text());
    twilio = true;
    // Twilio signs the public URL it called; set PUBLIC_BASE_URL so we rebuild it exactly.
    if (config.twilio.authToken && process.env.PUBLIC_BASE_URL) {
      const url = `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/webhooks/sms`;
      if (!validTwilioSignature(url, f, req.headers.get("x-twilio-signature"))) return json({ error: "Invalid Twilio signature." }, 401);
    }
    msg = { provider_message_id: f.get("MessageSid") ?? "", from_number: f.get("From") ?? "", body: f.get("Body") ?? "", is_simulated: false };
  } else {
    const secret = process.env.SMS_WEBHOOK_SECRET ?? "";
    if (secret ? req.headers.get("x-reach-secret") !== secret : !config.demoMode)
      return json({ error: "JSON messages need the x-reach-secret header (or DEMO_MODE=true)." }, 401);
    const b: any = await req.json().catch(() => ({}));
    msg = {
      provider_message_id: String(b.provider_message_id ?? ""),
      from_number: String(b.from_number ?? b.from ?? ""),
      body: String(b.body ?? ""),
      received_at: b.received_at,
      is_simulated: b.is_simulated === true,
    };
  }
  if (!msg.provider_message_id || !isE164(msg.from_number)) return json({ error: "Need provider_message_id and an E.164 from_number." }, 422);
  await handleInboundSms(msg);
  if (twilio) return new Response("<Response></Response>", { headers: { "content-type": "text/xml" } });
  return json({ ok: true });
}
