import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL no está definida (revisa .env)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  schemaFilter: ["public"],
  dbCredentials: { url },
  // Verbose para ver el SQL de generate/migrate.
  verbose: true,
  strict: true,
});
