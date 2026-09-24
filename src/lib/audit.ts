/**
 * Journal d'audit : chaque création, modification ou suppression d'un objet métier est tracée,
 * avec l'utilisateur, l'adresse IP et les valeurs avant/après (sans jamais stocker de secret).
 */
import { eq, type InferSelectModel } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Tx } from "@/db";
import { journalAudit } from "@/db/schema";
import type { Ctx } from "@/lib/context";

const SENSIBLES = new Set([
  "password",
  "remember_token",
  "rememberToken",
  "two_factor_secret",
  "two_factor_recovery_codes",
  "api_token",
  "code_hash",
  "codeHash",
  "session_version",
  "sessionVersion",
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
]);

const LIBELLES: Record<string, string> = {
  created: "Création",
  updated: "Modification",
  deleted: "Suppression",
};

/** Convertit une clé camelCase en snake_case pour garder les libellés de colonnes de la base. */
function snake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function nettoyer(donnees: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(donnees)) {
    if (SENSIBLES.has(k) || v === undefined) continue;
    out[snake(k)] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

function vide(o: Record<string, unknown>): Record<string, unknown> | null {
  return Object.keys(o).length ? o : null;
}

async function enregistrer(
  tx: Tx,
  ctx: Ctx,
  action: string,
  modele: string | null,
  id: string | null,
  description: string,
  avant: Record<string, unknown>,
  apres: Record<string, unknown>,
) {
  await tx.insert(journalAudit).values({
    userId: ctx.user?.id ?? null,
    acteur: ctx.user?.name ?? null,
    action,
    modele,
    modeleId: id,
    description,
    avant: vide(nettoyer(avant)),
    apres: vide(nettoyer(apres)),
    adresseIp: ctx.ip?.slice(0, 45) ?? null,
    userAgent: ctx.userAgent?.slice(0, 1000) ?? null,
    route: ctx.route ?? null,
  });
}

export async function auditModele(
  tx: Tx,
  ctx: Ctx,
  modele: string,
  id: number | string,
  action: "created" | "updated" | "deleted",
  avant: Record<string, unknown> = {},
  apres: Record<string, unknown> = {},
) {
  const description = `${LIBELLES[action] ?? action} ${modele} #${id}`;
  await enregistrer(tx, ctx, action, modele, String(id), description, avant, apres);
}

/** Opération sensible hors CRUD : téléchargement, export, import, sauvegarde… */
export async function auditManuel(
  tx: Tx,
  ctx: Ctx,
  action: string,
  description: string,
  objet?: { modele: string; id: number | string } | null,
  details: Record<string, unknown> = {},
) {
  await enregistrer(
    tx,
    ctx,
    action,
    objet?.modele ?? null,
    objet ? String(objet.id) : null,
    description,
    {},
    details,
  );
}

/* ------------------------------------------------------------------ */
/* Opérations CRUD auditées                                            */
/* ------------------------------------------------------------------ */

type TableAvecId = PgTable & { id: PgColumn };

function egal(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a as Date).getTime() === new Date(b as Date).getTime();
  }
  if (typeof a === "object" && a !== null) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

export async function creer<T extends TableAvecId>(
  tx: Tx,
  ctx: Ctx,
  table: T,
  modele: string,
  values: T["$inferInsert"],
): Promise<InferSelectModel<T>> {
  const [row] = (await tx.insert(table).values(values).returning()) as InferSelectModel<T>[];
  const r = row as Record<string, unknown>;
  await auditModele(tx, ctx, modele, r.id as number, "created", {}, r);
  return row;
}

/**
 * Met à jour une ligne et n'enregistre que les champs réellement modifiés
 * (comme l'observateur Eloquent `updated`). Retourne la ligne à jour, ou null si elle n'existe pas.
 */
export async function modifier<T extends TableAvecId>(
  tx: Tx,
  ctx: Ctx,
  table: T,
  modele: string,
  id: number,
  values: Partial<T["$inferInsert"]>,
): Promise<InferSelectModel<T> | null> {
  const [avant] = (await tx.select().from(table as PgTable).where(eq(table.id, id)).for("update")) as Record<
    string,
    unknown
  >[];
  if (!avant) return null;
  const changements: Record<string, unknown> = {};
  const origine: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (v === undefined || k === "updatedAt") continue;
    if (!egal(avant[k], v)) {
      changements[k] = v;
      origine[k] = avant[k];
    }
  }
  if (Object.keys(changements).length === 0) return avant as InferSelectModel<T>;
  const [apres] = (await tx
    .update(table)
    .set(changements as never)
    .where(eq(table.id, id))
    .returning()) as InferSelectModel<T>[];
  await auditModele(tx, ctx, modele, id, "updated", origine, changements);
  return apres;
}

export async function supprimer<T extends TableAvecId>(
  tx: Tx,
  ctx: Ctx,
  table: T,
  modele: string,
  id: number,
): Promise<boolean> {
  const [row] = (await tx.delete(table).where(eq(table.id, id)).returning()) as Record<string, unknown>[];
  if (!row) return false;
  await auditModele(tx, ctx, modele, id, "deleted", row, {});
  return true;
}
