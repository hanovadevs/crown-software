import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  crownPool?: Pool;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const isRemote = !connectionString.includes("localhost") && !connectionString.includes("127.0.0.1");

  return new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = globalForDb.crownPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.crownPool = pool;
}

export const db = drizzle(pool, { schema });
