import type { DB } from "./types";

export const nowIso = () => new Date().toISOString();

// Readable sequential IDs like "outreach_001", matching the team contract.
export function nextId(db: DB, prefix: string): string {
  const n = (db.counters[prefix] ?? 0) + 1;
  db.counters[prefix] = n;
  return `${prefix}_${String(n).padStart(3, "0")}`;
}

export const isE164 = (p: string) => /^\+[1-9]\d{6,14}$/.test(p);

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function handleError(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: "Something went wrong on the server. Check the server logs." }, 500);
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

// Retell / form values arrive as booleans or strings; normalize to boolean | null.
export function toBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(s)) return true;
    if (["false", "no", "n", "0"].includes(s)) return false;
  }
  return null;
}

export function toText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || ["none", "n/a", "null", "no"].includes(s.toLowerCase())) return null;
  return s;
}
