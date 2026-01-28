import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Create the connection
// const connectionString = process.env.DATABASE_URL!;

// if (!connectionString) {
//   throw new Error("DATABASE_URL environment variable is not set");
// }

// For query purposes
const queryClient = postgres(
  "postgresql://postgres.syegehgefqrlflmoxoyg:6j53flH5YIwj51eQ@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
);

// Create drizzle instance with schema
export const db = drizzle(queryClient, { schema });

// Export schema for use in other packages
export { schema };

// Type exports
export type Database = typeof db;
