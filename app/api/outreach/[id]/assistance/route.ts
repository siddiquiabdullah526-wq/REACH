import { setAssistance } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { assistance_status: "requested" | "in_progress" | "closed", note?: string }
// This is the only way a case gets closed: a coordinator does it.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson(req);
    return json({ outreach: await setAssistance(params.id, body.assistance_status, body.note) });
  } catch (e) {
    return handleError(e);
  }
}
