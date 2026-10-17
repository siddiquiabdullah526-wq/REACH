import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionToken } from "./lib/auth";

// Everything except the public landing page, login, health check and provider webhooks
// sits behind DASHBOARD_PASSWORD. The test roster has real phone numbers, so keep it that way.
const PUBLIC_API = ["/api/webhooks/", "/api/login", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const password = process.env.DASHBOARD_PASSWORD ?? "";
  if (!password) return NextResponse.next(); // local dev without a password

  const expected = await sessionToken(password, process.env.SESSION_SECRET || "reach-dev-secret");
  if (req.cookies.get(SESSION_COOKIE)?.value === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in to the dashboard first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/dashboard/:path*", "/api/:path*"] };
