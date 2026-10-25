import { pgTable, text, jsonb, bigint, timestamp } from "drizzle-orm/pg-core";

// One row per synced workspace. The id is a random, unguessable sync key
// generated on the device and shared to link additional devices.
export const workspaces = pgTable("workspaces", {
  id: text().primaryKey(),
  data: jsonb().notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
