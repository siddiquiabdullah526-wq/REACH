import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { json, readJson } from "@/lib/util";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password } = await readJson<{ password?: string }>(req);
  if (!config.dashboardPassword) return json({ ok: true, note: "No DASHBOARD_PASSWORD set; the dashboard is open." });
  if (password !== config.dashboardPassword) return json({ error: "That password is not right." }, 401);
  const token = await sessionToken(config.dashboardPassword, config.sessionSecret);
  const res = json({ ok: true });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append("set-cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=172800${secure}`);
  return res;
}

export async function DELETE() {
  const res = json({ ok: true });
  res.headers.append("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
