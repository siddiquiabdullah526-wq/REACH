import { getReport } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const v = new URL(req.url).searchParams.get("version");
    return json(await getReport(params.id, v ? Number(v) : undefined));
  } catch (e) {
    return handleError(e);
  }
}
