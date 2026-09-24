import { notFound } from "next/navigation";
import { contexte } from "@/lib/auth/current";
import { NotFoundError } from "@/lib/errors";
import { telechargement } from "@/lib/http";
import type { Ctx } from "@/lib/context";
import { ADMINS, type Role } from "@/lib/roles";

/** Génère un PDF (réservé par défaut aux administrateurs) et le renvoie en téléchargement. */
export async function reponsePdf(
  route: string,
  generer: (ctx: Ctx) => Promise<{ contenu: Buffer; nom: string }>,
  roles: readonly Role[] = ADMINS,
) {
  const ctx = await contexte(roles, route);
  try {
    const { contenu, nom } = await generer(ctx);
    return telechargement(contenu, nom, "application/pdf");
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export function id(valeur: string): number {
  const n = Number(valeur);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}
