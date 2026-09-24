import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** Transaction ou connexion : les services acceptent l'un ou l'autre. */
export type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

const globalForDb = globalThis as unknown as { insecPool?: Pool; insecDb?: Db };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL n’est pas configurée.");
  }
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    // Neon et la plupart des hébergeurs imposent TLS ; en local ce n'est pas nécessaire.
    ssl: local || connectionString.includes("sslmode=disable") ? undefined : { rejectUnauthorized: true },
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
}

export function getDb(): Db {
  if (!globalForDb.insecDb) {
    globalForDb.insecPool = createPool();
    globalForDb.insecDb = drizzle(globalForDb.insecPool, { schema });
  }
  return globalForDb.insecDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.insecPool?.end();
  globalForDb.insecPool = undefined;
  globalForDb.insecDb = undefined;
}

export { schema };
