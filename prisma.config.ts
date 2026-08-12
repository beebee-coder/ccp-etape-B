import { defineConfig } from "prisma/config";
import path from "path";

export default defineConfig({
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
