/**
 * Migration des données de l'ancienne application Laravel (SQLite) vers PostgreSQL.
 *
 *   npm run import:laravel -- --sqlite=/chemin/database.sqlite --storage=/chemin/storage/app
 *
 * - Les identifiants sont conservés (les liens, reçus et références restent valides).
 * - Les mots de passe bcrypt existants continuent de fonctionner.
 * - Les pièces administratives (storage/app/dossiers) sont copiées vers le stockage configuré.
 * - La base cible doit être vide (migrations appliquées, sans `db:seed`) ; --remplacer la vide d'abord.
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";
import { TABLES } from "../src/lib/services/sauvegardes";
import { getStockage } from "../src/lib/storage";

function arg(nom: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
}

type Colonne = { nom: string; type: string };

/** Convertit une valeur SQLite vers le type PostgreSQL de la colonne cible. */
export function convertir(valeur: unknown, type: string): unknown {
  if (valeur === null || valeur === undefined) return null;
  switch (type) {
    case "boolean":
      return valeur === 1 || valeur === "1" || valeur === true;
    case "date":
      return String(valeur).slice(0, 10);
    case "timestamp with time zone": {
      // Laravel stockait les dates en UTC au format "YYYY-MM-DD HH:MM:SS".
      const s = String(valeur).trim();
      return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
    }
    case "jsonb":
      if (typeof valeur === "string") {
        try {
          return JSON.parse(valeur);
        } catch {
          return null;
        }
      }
      return valeur;
    case "integer":
    case "smallint":
    case "bigint":
      return Math.round(Number(valeur));
    case "numeric":
      return Number(valeur);
    default:
      return typeof valeur === "string" ? valeur : String(valeur);
  }
}

function mimeDe(chemin: string): string {
  if (chemin.endsWith(".pdf")) return "application/pdf";
  if (chemin.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

async function main() {
  const fichier = arg("sqlite");
  const storage = arg("storage");
  const remplacer = process.argv.includes("--remplacer");
  if (!fichier || !existsSync(fichier)) throw new Error("Précisez --sqlite=/chemin/vers/database.sqlite");

  const source = new Database(fichier, { readonly: true, fileMustExist: true });
  const db = getDb();

  const tablesSource = new Set(
    (source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name),
  );

  const colonnesCible = new Map<string, Colonne[]>();
  for (const [table] of TABLES) {
    const res = await db.execute(
      sql`SELECT column_name AS nom, data_type AS type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table}`,
    );
    colonnesCible.set(table, res.rows as Colonne[]);
  }

  if (!remplacer) {
    for (const [table] of TABLES) {
      const res = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${table}"`));
      if ((res.rows[0] as { n: number }).n > 0) {
        throw new Error(`La table ${table} n’est pas vide. Utilisez une base neuve ou ajoutez --remplacer.`);
      }
    }
  }

  const bilan: Record<string, number> = {};
  await db.transaction(async (tx) => {
    if (remplacer) await tx.execute(sql.raw(`TRUNCATE ${TABLES.map(([t]) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
    for (const [table, pk] of TABLES) {
      if (!tablesSource.has(table)) {
        bilan[table] = 0;
        continue;
      }
      const cibles = colonnesCible.get(table)!;
      const lignes = source.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      const converties = lignes.map((ligne) => {
        const out: Record<string, unknown> = {};
        for (const c of cibles) if (c.nom in ligne) out[c.nom] = convertir(ligne[c.nom], c.type);
        return out;
      });
      // Seules les colonnes présentes dans l'ancienne base sont insérées : les autres prennent leur valeur par défaut.
      const colonnes = cibles.filter((c) => lignes.length && c.nom in lignes[0]).map((c) => sql.identifier(c.nom));
      for (let i = 0; i < converties.length; i += 500) {
        const lot = JSON.stringify(converties.slice(i, i + 500));
        await tx.execute(
          sql`INSERT INTO ${sql.identifier(table)} (${sql.join(colonnes, sql`, `)}) SELECT ${sql.join(colonnes, sql`, `)} FROM json_populate_recordset(NULL::${sql.identifier(table)}, ${lot}::json)`,
        );
      }
      await tx.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('"${table}"', '${pk}'), coalesce(max("${pk}"), 1), max("${pk}") IS NOT NULL) FROM "${table}"`,
        ),
      );
      bilan[table] = converties.length;
    }
  });
  console.table(bilan);

  if (storage) {
    const stockage = getStockage(db);
    const pieces = tablesSource.has("pieces_administratives")
      ? (source.prepare("SELECT chemin FROM pieces_administratives").all() as { chemin: string }[])
      : [];
    let copies = 0;
    const manquants: string[] = [];
    for (const { chemin } of pieces) {
      const local = path.join(storage, chemin);
      if (!chemin.startsWith("dossiers/") || chemin.includes("..") || !existsSync(local)) {
        manquants.push(chemin);
        continue;
      }
      await stockage.ecrire(chemin, readFileSync(local), mimeDe(chemin));
      copies++;
    }
    console.log(`Pièces copiées : ${copies}.${manquants.length ? ` Introuvables : ${manquants.join(", ")}` : ""}`);
  } else {
    console.log("Aucun dossier --storage fourni : les fichiers des pièces administratives n’ont pas été copiés.");
  }
  source.close();
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
