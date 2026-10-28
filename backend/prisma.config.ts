import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/prisma/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl(),
  },
});
