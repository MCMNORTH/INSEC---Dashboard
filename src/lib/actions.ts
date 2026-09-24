import "server-only";
import { cookies } from "next/headers";
import { AppError, ValidationError } from "@/lib/errors";

export type EtatFormulaire = { erreurs: string[]; ok?: string; donnees?: Record<string, unknown> };
export const ETAT_INITIAL: EtatFormulaire = { erreurs: [] };

export const COOKIE_FLASH = "insec_flash";

/** Message affiché une seule fois sur la page suivante (équivalent de ->with('status', …)). */
export async function flash(type: "succes" | "erreur", message: string) {
  (await cookies()).set(COOKIE_FLASH, encodeURIComponent(JSON.stringify({ type, message })), {
    path: "/",
    maxAge: 60,
    sameSite: "lax",
    httpOnly: false,
  });
}

/**
 * Exécute une opération métier et convertit les erreurs attendues en messages de formulaire.
 * Les autres exceptions (bugs, redirect(), forbidden()) sont propagées.
 */
export async function tenter<T>(fn: () => Promise<T>): Promise<{ ok: true; valeur: T } | { ok: false; etat: EtatFormulaire }> {
  try {
    return { ok: true, valeur: await fn() };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, etat: { erreurs: e.messages } };
    if (e instanceof AppError) return { ok: false, etat: { erreurs: [e.message] } };
    throw e;
  }
}

/** FormData → objet simple. Les champs répétés (ex. ue_ids) sont lus avec `multiples`. */
export function lireFormulaire(fd: FormData, multiples: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (multiples.includes(k)) continue;
    out[k] = typeof v === "string" ? v : v;
  }
  for (const k of multiples) out[k] = fd.getAll(k).filter((v) => typeof v === "string" && v !== "");
  return out;
}
