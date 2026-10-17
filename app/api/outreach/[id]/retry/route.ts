import { retryOutreach } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { channel: "voice" | "sms" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson(req);
    return json({ outreach: await retryOutreach(params.id, body.channel === "sms" ? "sms" : "voice") });
  } catch (e) {
    return handleError(e);
  }
}
