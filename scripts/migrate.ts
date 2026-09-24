/** Applique les migrations SQL du dossier drizzle/ (lancé automatiquement par `vercel-build`). */
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "../src/db";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL n’est pas configurée : migrations ignorées.");
    process.exit(process.env.VERCEL ? 1 : 0);
  }
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées.");
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
