import { config, smsProvider } from "./config";
import type { Lang } from "./types";

// SMS fallback. Real US SMS from a fresh number needs A2P 10DLC registration (days), so the
// default is "simulated": the message is recorded and labeled as simulated on the dashboard.
// If you do have a registered Twilio number, set TWILIO_* and it sends for real.

export function smsText(lang: Lang, title: string, body: string, simulated: boolean): string {
  const tag = simulated ? (lang === "es" ? "(SIMULACRO) " : "(TEST) ") : "";
  if (lang === "es")
    return `${tag}${config.orgName}: ${title}. ${body} Responda 1 si puede seguir estas instrucciones. Responda 2 si necesita ayuda. Responda STOP para no recibir más mensajes.`;
  return `${tag}${config.orgName}: ${title}. ${body} Reply 1 if you can follow these instructions. Reply 2 if you need assistance. Reply STOP to opt out.`;
}

export async function sendSms(to: string, text: string): Promise<{ provider_message_id: string; simulated: boolean }> {
  if (smsProvider() === "simulated") {
    return { provider_message_id: `sim_out_${Date.now().toString(36)}`, simulated: true };
  }
  const { accountSid, authToken, fromNumber } = config.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: text }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio send failed (${res.status}): ${data?.message ?? "unknown error"}`);
  return { provider_message_id: data.sid, simulated: false };
}

// Parse a reply to our numbered question. Anything else gets flagged for a human.
export function parseReply(body: string): "1" | "2" | "stop" | null {
  const s = body.trim().toLowerCase().replace(/[.!\s]+$/g, "");
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "alto", "parar"].includes(s)) return "stop";
  if (s === "1" || s === "one" || s === "uno") return "1";
  if (s === "2" || s === "two" || s === "dos") return "2";
  return null;
}
