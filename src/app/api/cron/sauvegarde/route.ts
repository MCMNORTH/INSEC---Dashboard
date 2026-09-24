import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { auditManuel } from "@/lib/audit";
import { creerSauvegarde, purgerSauvegardes } from "@/lib/services/sauvegardes";

export const maxDuration = 300;

function autorise(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const recu = Buffer.from(request.headers.get("authorization") ?? "");
  const attendu = Buffer.from(`Bearer ${secret}`);
  return recu.length === attendu.length && timingSafeEqual(recu, attendu);
}

/**
 * Sauvegarde quotidienne déclenchée par Vercel Cron (voir vercel.json),
 * puis suppression des archives de plus de 30 jours.
 */
export async function GET(request: Request) {
  if (!autorise(request)) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const db = getDb();
  const sauvegarde = await creerSauvegarde(db, "Planifiée");
  const supprimees = await purgerSauvegardes(db, Number(process.env.BACKUP_RETENTION_DAYS ?? 30));
  await auditManuel(db, { db, user: null, route: "cron.sauvegarde" }, "backup", `Sauvegarde planifiée ${sauvegarde.nom}`, null, {
    supprimées: supprimees,
  });
  return Response.json({ status: "ok", sauvegarde: sauvegarde.nom, supprimees });
}
