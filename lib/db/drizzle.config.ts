import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

const resolvedUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!resolvedUrl) {
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^DATABASE_URL=(.*)$/m);
    if (match) {
      process.env.DATABASE_URL = match[1].trim();
    }
  } catch (err) {
    // silently fail and let the error below trigger
  }
}

const finalUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!finalUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: finalUrl,
    ssl: true,
  },
});


