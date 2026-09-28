import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset";
process.env.DATABASE_URL ??= databaseUrl;

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
