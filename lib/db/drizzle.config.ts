import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

if (!process.env.DATABASE_URL) {
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});


