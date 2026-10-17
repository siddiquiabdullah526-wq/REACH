import { createNotice, listNotices } from "@/lib/outreach";
import { handleError, json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json({ notices: await listNotices() });
  } catch (e) {
    return handleError(e);
  }
}

// Body: { title, body_en, body_es, mode: "routine" | "emergency", approved: boolean, simulated?: boolean }
export async function POST(req: Request) {
  try {
    return json({ notice: await createNotice(await readJson(req)) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
