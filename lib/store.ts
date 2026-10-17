import fs from "fs/promises";
import path from "path";
import type { DB } from "./types";
import { config } from "./config";
import { freshDb } from "./seed";

// Storage: the whole state is one JSON document.
//  - Local / single server (Render, Railway, `npm start`): a JSON file with an in-process lock.
//  - Serverless (Vercel): Postgres (Supabase/Neon) via DATABASE_URL, one row, optimistic versioning
//    so concurrent webhooks never overwrite each other.
// Plenty for a demo with a handful of contacts. Swap for real tables before any real deployment.

type Mutator<T> = (db: DB) => T | Promise<T>;

// ---------- file backend ----------
let lock: Promise<unknown> = Promise.resolve();
const filePath = () => path.resolve(process.cwd(), config.dataFile);

async function fileLoad(): Promise<DB> {
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as DB;
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
    const db = freshDb();
    await fileSave(db);
    return db;
  }
}

async function fileSave(db: DB) {
  const p = filePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, p);
}

function fileMutate<T>(fn: Mutator<T>): Promise<T> {
  const run = lock.then(async () => {
    const db = await fileLoad();
    const result = await fn(db);
    await fileSave(db);
    return result;
  });
  lock = run.catch(() => undefined);
  return run;
}

// ---------- postgres backend ----------
let pool: any = null;
async function pg() {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 3,
      ssl: config.databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
    await pool.query(
      `create table if not exists reach_state (id text primary key, version integer not null, data jsonb not null)`
    );
  }
  return pool;
}

async function pgLoad(): Promise<{ db: DB; version: number }> {
  const p = await pg();
  const r = await p.query(`select data, version from reach_state where id = 'main'`);
  if (r.rowCount) return { db: r.rows[0].data as DB, version: r.rows[0].version };
  const db = freshDb();
  await p.query(`insert into reach_state (id, version, data) values ('main', 1, $1) on conflict (id) do nothing`, [
    JSON.stringify(db),
  ]);
  return pgLoad();
}

async function pgMutate<T>(fn: Mutator<T>): Promise<T> {
  const p = await pg();
  for (let i = 0; i < 8; i++) {
    const { db, version } = await pgLoad();
    const result = await fn(db);
    const r = await p.query(`update reach_state set data = $1, version = version + 1 where id = 'main' and version = $2`, [
      JSON.stringify(db),
      version,
    ]);
    if (r.rowCount === 1) return result;
    await new Promise((res) => setTimeout(res, 40 + Math.random() * 80)); // someone else wrote first; retry
  }
  throw new Error("Could not save after several retries (too many concurrent writes).");
}

// ---------- public API ----------
const usePg = () => Boolean(config.databaseUrl);

export async function readDb(): Promise<DB> {
  if (usePg()) return (await pgLoad()).db;
  await lock;
  return fileLoad();
}

// Run fn against the latest state and save it. Keep fn free of network calls (they would hold the lock).
export function mutate<T>(fn: Mutator<T>): Promise<T> {
  return usePg() ? pgMutate(fn) : fileMutate(fn);
}

export async function resetDb(): Promise<DB> {
  const db = freshDb();
  if (usePg()) {
    const p = await pg();
    await p.query(`delete from reach_state where id = 'main'`);
    return (await pgLoad()).db;
  }
  await mutate((d) => Object.assign(d, db));
  return db;
}
