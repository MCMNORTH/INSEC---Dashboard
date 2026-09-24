import { auditManuel } from "@/lib/audit";
import { contexte } from "@/lib/auth/current";
import type { Db } from "@/db";
import { aujourdhui } from "@/lib/format";
import { telechargement } from "@/lib/http";
import { ADMINS } from "@/lib/roles";
import { MIME_XLSX } from "@/lib/services/excel";

/** Export Excel réservé aux administrateurs, tracé dans le journal d'audit. */
export async function reponseExcel(route: string, description: string, nom: string, generer: (db: Db) => Promise<Buffer>) {
  const ctx = await contexte(ADMINS, route);
  const contenu = await generer(ctx.db);
  await auditManuel(ctx.db, ctx, "export", description);
  return telechargement(contenu, nom.replace("{date}", aujourdhui().replaceAll("-", "")), MIME_XLSX);
}
