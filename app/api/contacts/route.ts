import { listContacts } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json({ contacts: await listContacts() });
  } catch (e) {
    return handleError(e);
  }
}
