import { getStatus } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/notices/:id/status?version=1  -> the dashboard object
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const v = new URL(req.url).searchParams.get("version");
    return json(await getStatus(params.id, v ? Number(v) : undefined));
  } catch (e) {
    return handleError(e);
  }
}
