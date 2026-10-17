import { config } from "@/lib/config";
import { simulateInboundSms } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Demo only: a resident "texts back". Goes through the same code as a real inbound SMS.
// Body: { contact_id, body: "1" | "2" | "STOP" | anything }
export async function POST(req: Request) {
  if (!config.demoMode) return json({ error: "Demo controls are off. Set DEMO_MODE=true." }, 404);
  try {
    const b = await readJson<{ contact_id?: string; body?: string }>(req);
    return json({ message: await simulateInboundSms(String(b.contact_id ?? ""), String(b.body ?? "")) });
  } catch (e) {
    return handleError(e);
  }
}
