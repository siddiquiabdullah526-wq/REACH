import { startNotice } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { "version": 1, "contact_ids": ["contact_a", "contact_b", "contact_c"] }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson<{ version?: number; contact_ids?: string[] }>(req);
    return json(await startNotice(params.id, Number(body.version), body.contact_ids ?? []));
  } catch (e) {
    return handleError(e);
  }
}
