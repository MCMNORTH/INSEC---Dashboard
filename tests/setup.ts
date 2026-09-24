import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { closeDb, getDb } from "@/db";
import { definirEnvoyeurDeTest } from "@/lib/mail";
import { seedReferentiel } from "@/lib/seed";
import { boiteMail } from "./aide";

beforeEach(async () => {
  const db = getDb();
  const tables = await db.execute(
    sql`SELECT string_agg(format('%I', tablename), ', ') AS liste FROM pg_tables WHERE schemaname = 'public'`,
  );
  const liste = (tables.rows[0] as { liste: string }).liste;
  await db.execute(sql.raw(`TRUNCATE ${liste} RESTART IDENTITY CASCADE`));
  await seedReferentiel(db);
  boiteMail.length = 0;
  definirEnvoyeurDeTest(async (n) => {
    boiteMail.push(n);
  });
});

afterAll(async () => {
  await closeDb();
});
