import { getFollowupList } from "@/lib/outreach";
import { handleError, json } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// GET /api/notices/:id/followup?version=1&format=csv  -> the door-knock list
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const v = url.searchParams.get("version");
    const data = await getFollowupList(params.id, v ? Number(v) : undefined);
    if (url.searchParams.get("format") !== "csv") return json(data);
    const cols = ["display_name", "address", "phone", "preferred_language", "contact_status", "assistance_status", "needs_transport", "mobility_needs", "callback_requested", "last_failure_reason", "review_reason"];
    const lines = [cols.join(","), ...data.rows.map((r: any) => cols.map((c) => csvCell(r[c])).join(","))];
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="followup-${params.id}-v${data.notice.version}.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
