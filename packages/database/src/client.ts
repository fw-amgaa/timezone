import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Cache the database connection in development to prevent multiple connections
const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

function createDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const queryClient = postgres(connectionString);
  return drizzle(queryClient, { schema });
}

// Lazy initialization - only create DB when actually accessed
// This allows the build to succeed without DATABASE_URL
function getDb() {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}

// Export a proxy that lazily initializes the db connection
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop: string | symbol) {
    const actualDb = getDb();
    const value = actualDb[prop as keyof typeof actualDb];
    if (typeof value === "function") {
      return value.bind(actualDb);
    }
    return value;
  },
});

// Export schema for use in other packages
export { schema };

// Type exports
export type Database = typeof db;
