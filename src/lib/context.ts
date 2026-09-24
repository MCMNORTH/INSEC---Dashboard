import type { Db } from "@/db";

export type Acteur = { id: number; name: string; role: string };

/**
 * Contexte d'exécution d'un service : connexion, utilisateur connecté et métadonnées de la requête
 * (utilisées par le journal d'audit).
 */
export type Ctx = {
  db: Db;
  user: Acteur | null;
  ip?: string | null;
  userAgent?: string | null;
  route?: string | null;
};
