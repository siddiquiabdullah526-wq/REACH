import { config } from "@/lib/config";
import { resetDb } from "@/lib/store";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Demo only: wipe outreach and start fresh (contacts and sample notices are re-seeded).
export async function POST() {
  if (!config.demoMode) return json({ error: "Demo controls are off. Set DEMO_MODE=true." }, 404);
  try {
    await resetDb();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
