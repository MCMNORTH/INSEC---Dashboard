import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";
import { hacher } from "../../src/lib/auth/password";
import { seedReferentiel } from "../../src/lib/seed";

export const MOT_DE_PASSE = "motdepasse-e2e";

/** Base e2e neuve : référentiel, un compte par rôle et un étudiant/enseignant rattachés. */
export default async function setup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:5432/insec_e2e";
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  await client.end();

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  await seedReferentiel(db);
  const [etudiant] = await db
    .insert(schema.etudiants)
    .values({ nom: "Ould Ahmed", prenom: "Sidi", email: "sidi@example.com", statutEtudiant: "Actif" })
    .returning();
  const [enseignant] = await db
    .insert(schema.enseignants)
    .values({ nom: "Kane", prenom: "Fatou", specialite: "Comptabilité", email: "fatou.kane@example.com" })
    .returning();
  const hash = await hacher(MOT_DE_PASSE);
  await db.insert(schema.users).values([
    { name: "Direction", email: "super@insec.test", password: hash, role: "super_admin" },
    { name: "Scolarité", email: "admin@insec.test", password: hash, role: "admin" },
    { name: "Comptable", email: "finance@insec.test", password: hash, role: "finance" },
    { name: "Sidi", email: "etudiant@insec.test", password: hash, role: "etudiant", etudiantId: etudiant.id },
    { name: "Fatou Kane", email: "enseignant@insec.test", password: hash, role: "enseignant", enseignantId: enseignant.id },
    { name: "Ancien", email: "desactive@insec.test", password: hash, role: "admin", active: false },
  ]);
  await pool.end();
}
