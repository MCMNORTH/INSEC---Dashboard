/**
 * Crée (ou réactive) le premier super-administrateur.
 *
 *   npm run admin:create -- --email=direction@insec.mr --name="Direction INSEC"
 *
 * Le mot de passe est demandé au clavier (ou lu dans ADMIN_PASSWORD) pour ne pas apparaître
 * dans l'historique du terminal.
 */
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { users } from "../src/db/schema";
import { hacher } from "../src/lib/auth/password";

function arg(nom: string): string | undefined {
  const brut = process.argv.find((a) => a.startsWith(`--${nom}=`));
  return brut?.slice(nom.length + 3);
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name") ?? "Super administrateur";
  if (!email) throw new Error("Précisez --email=adresse@domaine");

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Mot de passe (12 caractères minimum) : ");
    rl.close();
  }
  if (!password || password.length < 12) throw new Error("Le mot de passe doit contenir au moins 12 caractères.");

  const db = getDb();
  const [existant] = await db.select().from(users).where(eq(users.email, email));
  const valeurs = { name, email, password: await hacher(password), role: "super_admin", active: true, emailVerifiedAt: new Date() };
  if (existant) {
    await db
      .update(users)
      .set({ ...valeurs, sessionVersion: existant.sessionVersion + 1 })
      .where(eq(users.id, existant.id));
    console.log(`Compte ${email} mis à jour en super administrateur.`);
  } else {
    await db.insert(users).values(valeurs);
    console.log(`Super administrateur ${email} créé.`);
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
