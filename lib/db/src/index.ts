import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  try {
    const envPath = path.resolve(__dirname, "../../../.env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^DATABASE_URL=(.*)$/m);
    if (match) {
      process.env.DATABASE_URL = match[1].trim();
    }
  } catch (err) {
    // ignore
  }
}

const resolvedUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

const { Pool } = pg;

if (!resolvedUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: resolvedUrl, ssl: { rejectUnauthorized: false } });
export const db = drizzle(pool, { schema });

export * from "./schema";
