import { config } from "@/lib/config";
import { handleRetellEvent } from "@/lib/outreach";
import { verifyRetellSignature } from "@/lib/retell";
import { json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Retell posts call_started, call_ended and call_analyzed here.
// Set this URL on both agents (scripts/setup-retell.mjs does it for you).
export async function POST(req: Request) {
  const raw = await req.text(); // raw body is required for the signature check
  if (!config.retell.skipVerify) {
    const ok = verifyRetellSignature(raw, req.headers.get("x-retell-signature"), config.retell.webhookKey);
    if (!ok) return json({ error: "Invalid Retell signature." }, 401);
  }
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }
  try {
    await handleRetellEvent(payload);
  } catch (e) {
    console.error("Retell webhook failed", e);
    return json({ error: "Could not process the event." }, 500); // Retell will show the failure
  }
  return new Response(null, { status: 204 });
}
