import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: "postgresql://postgres.syegehgefqrlflmoxoyg:6j53flH5YIwj51eQ@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  },
  verbose: true,
  strict: true,
});
