import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: "../../.env" });
config({ path: "../../.env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://project_template:project_template@localhost:55432/project_template?schema=public"
  }
});
