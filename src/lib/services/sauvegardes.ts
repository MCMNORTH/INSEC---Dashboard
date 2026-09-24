/**
 * Sauvegardes vérifiées : export complet des tables PostgreSQL (JSON) et des pièces administratives
 * dans une archive ZIP avec manifeste et empreintes SHA-256, et restauration contrôlée.
 */
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { Db } from "@/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { horodatage } from "@/lib/format";
import { getStockage, type Stockage } from "@/lib/storage";

/** Tables sauvegardées, dans l'ordre des dépendances (clé primaire entre parenthèses). */
export const TABLES: [string, string][] = [
  ["annees_academiques", "id"],
  ["formations", "id"],
  ["ues", "id"],
  ["etudiants", "id_etudiant"],
  ["enseignants", "id"],
  ["users", "id"],
  ["inscriptions", "id"],
  ["inscription_ue", "id"],
  ["versements", "id"],
  ["echeances", "id"],
  ["affectation_enseignant", "id"],
  ["examens", "id"],
  ["resultats_examens", "id"],
  ["pieces_administratives", "id"],
  ["candidatures", "id"],
  ["journal_emails", "id"],
  ["alertes", "id"],
  ["journal_audit", "id"],
];

const PREFIXE = "backups/";
const NOM_VALIDE = /^insec-[A-Za-z0-9-]+\.zip$/;

export type ResumeSauvegarde = {
  nom: string;
  taille: number;
  cree_le: string;
  motif: string;
  documents: number;
  integrite: boolean;
  erreur: string | null;
};

type Manifeste = {
  version: 2;
  application: string;
  cree_le: string;
  motif: string;
  donnees: string;
  donnees_sha256: string;
  tables: Record<string, number>;
  documents: { chemin: string; taille: number; sha256: string }[];
};

const sha256 = (octets: Uint8Array) => createHash("sha256").update(octets).digest("hex");

function resoudre(nom: string): string {
  if (!NOM_VALIDE.test(nom)) throw new NotFoundError("Sauvegarde introuvable.");
  return `${PREFIXE}${nom}`;
}

async function exporterTables(db: Db): Promise<{ donnees: Record<string, unknown[]>; compte: Record<string, number> }> {
  const donnees: Record<string, unknown[]> = {};
  const compte: Record<string, number> = {};
  await db.transaction(
    async (tx) => {
      for (const [table, pk] of TABLES) {
        const res = await tx.execute(
          sql.raw(`SELECT coalesce(json_agg(t ORDER BY t."${pk}"), '[]'::json) AS lignes FROM "${table}" t`),
        );
        const lignes = (res.rows[0] as { lignes: unknown[] }).lignes;
        donnees[table] = lignes;
        compte[table] = lignes.length;
      }
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return { donnees, compte };
}

/** Inspecte une archive ; en mode profond, recalcule toutes les empreintes. */
export function inspecterArchive(nom: string, octets: Uint8Array, profond = true): ResumeSauvegarde & { manifeste: Manifeste | null } {
  let manifeste: Manifeste | null = null;
  let integrite = false;
  let erreur: string | null = null;
  try {
    const fichiers = unzipSync(octets);
    manifeste = fichiers["manifest.json"] ? (JSON.parse(strFromU8(fichiers["manifest.json"])) as Manifeste) : null;
    if (!manifeste || !fichiers[manifeste.donnees]) {
      erreur = "Manifeste ou données absents.";
    } else {
      integrite = true;
      if (profond) {
        integrite = sha256(fichiers[manifeste.donnees]) === manifeste.donnees_sha256;
        for (const d of manifeste.documents) {
          const c = fichiers[`documents/${d.chemin}`];
          if (!c || sha256(c) !== d.sha256) {
            integrite = false;
            break;
          }
        }
      }
    }
  } catch {
    erreur = "Archive illisible.";
  }
  return {
    nom,
    taille: octets.length,
    cree_le: manifeste?.cree_le ?? new Date(0).toISOString(),
    motif: manifeste?.motif ?? "Inconnu",
    documents: manifeste?.documents.length ?? 0,
    integrite,
    erreur,
    manifeste,
  };
}

function sansManifeste(r: ResumeSauvegarde & { manifeste: unknown }): ResumeSauvegarde {
  return { nom: r.nom, taille: r.taille, cree_le: r.cree_le, motif: r.motif, documents: r.documents, integrite: r.integrite, erreur: r.erreur };
}

export async function creerSauvegarde(db: Db, motif = "Manuelle", stockage: Stockage = getStockage(db)): Promise<ResumeSauvegarde> {
  const nom = `insec-${horodatage()}-${randomBytes(3).toString("hex")}.zip`;
  const { donnees, compte } = await exporterTables(db);
  const json = strToU8(JSON.stringify(donnees));

  const zip: Zippable = { "data.json": json };
  const documents: Manifeste["documents"] = [];
  for (const objet of await stockage.lister("dossiers/")) {
    const contenu = await stockage.lire(objet.chemin);
    if (!contenu) continue;
    zip[`documents/${objet.chemin}`] = contenu;
    documents.push({ chemin: objet.chemin, taille: contenu.length, sha256: sha256(contenu) });
  }
  const manifeste: Manifeste = {
    version: 2,
    application: "INSEC Dashboard",
    cree_le: new Date().toISOString(),
    motif,
    donnees: "data.json",
    donnees_sha256: sha256(json),
    tables: compte,
    documents,
  };
  zip["manifest.json"] = strToU8(JSON.stringify(manifeste, null, 2));
  const archive = zipSync(zip, { level: 6 });

  const controle = inspecterArchive(nom, archive);
  if (!controle.integrite) throw new AppError("Le contrôle d’intégrité de la sauvegarde a échoué.");

  await stockage.ecrire(resoudre(nom), archive, "application/zip");
  const resume = sansManifeste(controle);
  await stockage.ecrire(`${PREFIXE}${nom}.json`, strToU8(JSON.stringify(resume)), "application/json");
  return resume;
}

export async function listerSauvegardes(db: Db, stockage: Stockage = getStockage(db)): Promise<ResumeSauvegarde[]> {
  const objets = await stockage.lister(PREFIXE);
  const resumes: ResumeSauvegarde[] = [];
  for (const o of objets.filter((o) => o.chemin.endsWith(".zip.json"))) {
    const contenu = await stockage.lire(o.chemin);
    if (contenu) resumes.push(JSON.parse(strFromU8(contenu)) as ResumeSauvegarde);
  }
  return resumes.sort((a, b) => b.cree_le.localeCompare(a.cree_le));
}

export async function lireSauvegarde(db: Db, nom: string, stockage: Stockage = getStockage(db)): Promise<Uint8Array> {
  const octets = await stockage.lire(resoudre(nom));
  if (!octets) throw new NotFoundError("Sauvegarde introuvable.");
  return octets;
}

export async function verifierSauvegarde(db: Db, nom: string, stockage: Stockage = getStockage(db)) {
  return sansManifeste(inspecterArchive(nom, await lireSauvegarde(db, nom, stockage)));
}

/**
 * Restaure une archive : sauvegarde de précaution, remplacement complet des tables dans une
 * transaction, puis réécriture des pièces administratives.
 */
export async function restaurerSauvegarde(db: Db, nom: string, stockage: Stockage = getStockage(db)) {
  const octets = await lireSauvegarde(db, nom, stockage);
  const controle = inspecterArchive(nom, octets);
  if (!controle.integrite || !controle.manifeste) throw new AppError("Archive invalide ou corrompue.");
  const fichiers = unzipSync(octets);
  const donnees = JSON.parse(strFromU8(fichiers[controle.manifeste.donnees])) as Record<string, unknown[]>;

  await creerSauvegarde(db, "Sauvegarde automatique avant restauration", stockage);

  await db.transaction(async (tx) => {
    const liste = TABLES.map(([t]) => `"${t}"`).join(", ");
    await tx.execute(sql.raw(`TRUNCATE ${liste} RESTART IDENTITY CASCADE`));
    for (const [table, pk] of TABLES) {
      const lignes = donnees[table] ?? [];
      // Insertion par lots pour rester sous la taille maximale d'un paramètre.
      for (let i = 0; i < lignes.length; i += 1000) {
        const lot = JSON.stringify(lignes.slice(i, i + 1000));
        await tx.execute(
          sql`INSERT INTO ${sql.identifier(table)} SELECT * FROM json_populate_recordset(NULL::${sql.identifier(table)}, ${lot}::json)`,
        );
      }
      await tx.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('"${table}"', '${pk}'), coalesce(max("${pk}"), 1), max("${pk}") IS NOT NULL) FROM "${table}"`,
        ),
      );
    }
  });

  for (const d of controle.manifeste.documents) {
    const contenu = fichiers[`documents/${d.chemin}`];
    if (contenu && d.chemin.startsWith("dossiers/")) {
      await stockage.ecrire(d.chemin, contenu, d.chemin.endsWith(".pdf") ? "application/pdf" : d.chemin.endsWith(".png") ? "image/png" : "image/jpeg");
    }
  }
}

/** Supprime les archives plus anciennes que `jours` jours. */
export async function purgerSauvegardes(db: Db, jours = 30, stockage: Stockage = getStockage(db)): Promise<number> {
  const limite = Date.now() - Math.max(1, jours) * 86_400_000;
  let supprimes = 0;
  for (const s of await listerSauvegardes(db, stockage)) {
    if (new Date(s.cree_le).getTime() < limite) {
      await stockage.supprimer(`${PREFIXE}${s.nom}`);
      await stockage.supprimer(`${PREFIXE}${s.nom}.json`);
      supprimes++;
    }
  }
  return supprimes;
}

export async function derniereSauvegarde(db: Db, stockage: Stockage = getStockage(db)): Promise<ResumeSauvegarde | null> {
  return (await listerSauvegardes(db, stockage))[0] ?? null;
}
