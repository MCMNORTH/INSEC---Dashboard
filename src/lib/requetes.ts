import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { anneesAcademiques, formations, ues } from "@/db/schema";

/** Années académiques, la plus récente en premier. */
export async function anneesRecentes() {
  return getDb().select().from(anneesAcademiques).orderBy(desc(anneesAcademiques.libelle));
}

/** Diplômes actifs avec leurs UE ordonnées (pour les formulaires d'inscription). */
export async function formationsAvecUes() {
  return getDb().query.formations.findMany({
    where: eq(formations.active, true),
    orderBy: asc(formations.nom),
    with: { ues: { orderBy: [asc(ues.anneeParcours), asc(ues.ordre)] } },
  });
}
