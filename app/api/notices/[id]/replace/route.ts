import { replaceNotice } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { expected_version, title, body_en, body_es, change_note?, approved? }  -> 409 if expected_version is stale
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await readJson(req);
    return json({ notice: await replaceNotice(params.id, { ...body, expected_version: Number(body.expected_version) }) });
  } catch (e) {
    return handleError(e);
  }
}
