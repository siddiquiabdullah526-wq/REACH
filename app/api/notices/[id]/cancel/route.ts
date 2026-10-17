import { cancelNotice } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    return json({ notice: await cancelNotice(params.id) });
  } catch (e) {
    return handleError(e);
  }
}
