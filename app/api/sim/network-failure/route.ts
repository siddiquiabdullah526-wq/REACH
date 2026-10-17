import { config } from "@/lib/config";
import { setNetworkFailure } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Demo only: pretend the phone network is down. Calls and texts fail with "network_down".
export async function POST(req: Request) {
  if (!config.demoMode) return json({ error: "Demo controls are off. Set DEMO_MODE=true." }, 404);
  try {
    const { enabled } = await readJson<{ enabled?: boolean }>(req);
    return json({ settings: await setNetworkFailure(enabled === true) });
  } catch (e) {
    return handleError(e);
  }
}
