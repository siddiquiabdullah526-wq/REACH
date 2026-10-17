import { getOutreachDetail } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    return json(await getOutreachDetail(params.id));
  } catch (e) {
    return handleError(e);
  }
}
