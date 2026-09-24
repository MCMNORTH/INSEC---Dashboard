import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { etudiants, inscriptions } from "@/db/schema";

/**
 * Dossier complet d'un étudiant : inscriptions (plus récentes d'abord) avec diplôme, année, UE,
 * versements, échéances et résultats d'examens.
 */
export async function dossierEtudiant(id: number) {
  const etudiant = await getDb().query.etudiants.findFirst({
    where: eq(etudiants.id, id),
    with: {
      inscriptions: {
        orderBy: [desc(inscriptions.createdAt), desc(inscriptions.id)],
        with: {
          formation: true,
          annee: true,
          versements: true,
          echeances: true,
          inscriptionUes: { with: { ue: true } },
          resultats: { with: { examen: { with: { ue: true } } } },
        },
      },
    },
  });
  if (!etudiant) return null;
  return {
    ...etudiant,
    inscriptions: etudiant.inscriptions.map((i) => ({
      ...i,
      ues: i.inscriptionUes.map((iu) => iu.ue).sort((a, b) => a.ordre - b.ordre || a.id - b.id),
    })),
  };
}

export type DossierEtudiant = NonNullable<Awaited<ReturnType<typeof dossierEtudiant>>>;


/** Convocations futures (hors examens annulés), de la plus proche à la plus lointaine. */
export function examensAVenir<T extends { examen: { dateExamen: Date; statut: string } }>(resultats: T[], maintenant = new Date()): T[] {
  return resultats
    .filter((r) => r.examen.dateExamen > maintenant && r.examen.statut !== "Annulé")
    .sort((a, b) => a.examen.dateExamen.getTime() - b.examen.dateExamen.getTime());
}
