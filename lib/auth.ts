// Tiny shared-password auth for the coordinator dashboard. Works in the Edge runtime (middleware).
export const SESSION_COOKIE = "rb_session";

export async function sessionToken(password: string, secret: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}|${secret}|reach`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
