import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { getStockage } from "@/lib/storage";
import { derniereSauvegarde } from "./sauvegardes";

type Statut = "ok" | "warning" | "failed";
type Controle = { status: Statut; message: string };

const check = (ok: boolean, succes: string, echec: string): Controle =>
  ok ? { status: "ok", message: succes } : { status: "failed", message: echec };

/** Contrôles de disponibilité ; seule une dépendance critique défaillante renvoie « failed ». */
export async function verifierDisponibilite(db: Db) {
  const checks: Record<string, Controle> = {};
  const secret = process.env.AUTH_SECRET ?? "";
  checks.application_key = check(secret.length >= 32, "Clé de session configurée", "AUTH_SECRET est absente ou trop courte.");

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = check(true, "Connexion à la base disponible", "");
  } catch {
    checks.database = check(false, "", "Base de données indisponible.");
  }

  const sonde = `sante/.sonde-${randomBytes(4).toString("hex")}`;
  try {
    const stockage = getStockage(db);
    await stockage.ecrire(sonde, new TextEncoder().encode("ok"), "text/plain");
    await stockage.supprimer(sonde);
    checks.storage = check(true, "Stockage accessible en écriture", "");
  } catch {
    checks.storage = check(false, "", "Le stockage des fichiers n’est pas accessible en écriture.");
  }

  try {
    const derniere = checks.database.status === "ok" ? await derniereSauvegarde(db) : null;
    if (!derniere) checks.backup = { status: "warning", message: "Aucune sauvegarde disponible." };
    else {
      const heures = (Date.now() - new Date(derniere.cree_le).getTime()) / 3_600_000;
      checks.backup =
        heures <= 48
          ? { status: "ok", message: "Dernière sauvegarde récente." }
          : { status: "warning", message: "La dernière sauvegarde date de plus de 48 heures." };
    }
  } catch {
    checks.backup = { status: "warning", message: "Impossible de lister les sauvegardes." };
  }

  const valeurs = Object.values(checks);
  const status: Statut = valeurs.some((c) => c.status === "failed")
    ? "failed"
    : valeurs.some((c) => c.status === "warning")
      ? "warning"
      : "ok";
  return { status, checks, checked_at: new Date().toISOString() };
}
