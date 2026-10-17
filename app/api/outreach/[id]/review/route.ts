import { resolveReview } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { note?: string }  -> clears the needs_review flag after a human checked it
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    return json({ outreach: await resolveReview(params.id, body?.note) });
  } catch (e) {
    return handleError(e);
  }
}
