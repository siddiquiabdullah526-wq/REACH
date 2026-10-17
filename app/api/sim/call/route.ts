import { config } from "@/lib/config";
import { simulateCall } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Demo only: resolve a ringing call. Builds a Retell-shaped payload and runs it through the
// same webhook handler as real calls. Body: { outreach_id, outcome }
// outcome: confirmed | needs_assistance | no_answer | voicemail | hung_up | opt_out
export async function POST(req: Request) {
  if (!config.demoMode) return json({ error: "Demo controls are off. Set DEMO_MODE=true." }, 404);
  try {
    const b = await readJson<{ outreach_id?: string; outcome?: string }>(req);
    return json(await simulateCall(String(b.outreach_id ?? ""), String(b.outcome ?? "")));
  } catch (e) {
    return handleError(e);
  }
}
