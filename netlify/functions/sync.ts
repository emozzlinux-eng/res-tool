import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { workspaces } from "../../db/schema.js";

// Sync keys are 128-bit random hex strings generated on the device.
const KEY_PATTERN = /^[a-f0-9]{32}$/;
const MAX_BYTES = 1_000_000;

const json = (body: unknown, status = 200) => Response.json(body, { status });

export default async (req: Request) => {
  const key = (new URL(req.url).searchParams.get("key") || "").toLowerCase();
  if (!KEY_PATTERN.test(key)) return json({ error: "Invalid sync key" }, 400);

  if (req.method === "GET") {
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, key));
    if (!row) return json({ error: "Not found" }, 404);
    return json({ data: row.data, updatedAt: row.updatedAt });
  }

  if (req.method === "PUT") {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: "Payload too large" }, 413);

    let body: { data?: unknown; updatedAt?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const { data, updatedAt } = body;
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof updatedAt !== "number") {
      return json({ error: "Invalid payload" }, 400);
    }

    // Last write wins, but never overwrite newer data with an older snapshot.
    const [existing] = await db
      .select({ updatedAt: workspaces.updatedAt })
      .from(workspaces)
      .where(eq(workspaces.id, key));
    if (existing && existing.updatedAt > updatedAt) {
      return json({ error: "Conflict", updatedAt: existing.updatedAt }, 409);
    }

    await db
      .insert(workspaces)
      .values({ id: key, data, updatedAt })
      .onConflictDoUpdate({ target: workspaces.id, set: { data, updatedAt } });
    return json({ ok: true, updatedAt });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/sync",
};
