/** Référentiel initial : années académiques, diplômes DGC/DSGC et leurs UE (catalogue INTEC-CNAM). */
import { eq, or } from "drizzle-orm";
import type { Db } from "@/db";
import { anneesAcademiques, formations, ues } from "@/db/schema";

const ANNEES = ["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027", "2027-2028"];

const FORMATIONS = [
  {
    code: "DGC",
    nom: "DGC",
    libelle: "Diplôme de gestion et de comptabilité",
    dureeAnnees: 3,
    niveauDiplome: "Bac +3",
    creditsTotal: 180,
    active: true,
    sourceUrl: "https://intec.cnam.fr/presentation-du-diplome-de-gestion-et-de-comptabilite-dgc--1449587.kjsp",
    sourceVerifieeLe: "2026-09-20",
  },
  {
    code: "DSGC",
    nom: "DSGC",
    libelle: "Diplôme supérieur de gestion et de comptabilité",
    dureeAnnees: 2,
    niveauDiplome: "Bac +5",
    creditsTotal: 120,
    active: true,
    sourceUrl: "https://intec.cnam.fr/diplome-superieur-de-gestion-et-de-comptabilite-dsgc--200729.kjsp",
    sourceVerifieeLe: "2026-09-20",
  },
];

const CATALOGUE: Record<string, [string, string, number, number][]> = {
  DGC: [
    ["TEC111", "Fondamentaux du droit", 14, 1],
    ["TEC115", "Économie contemporaine", 14, 1],
    ["TEC118", "Système d'information de gestion", 14, 1],
    ["TEC119", "Comptabilité", 14, 1],
    ["TEC112", "Droit des sociétés et des groupements d’affaires", 14, 2],
    ["TEC116", "Finance d'entreprise", 14, 2],
    ["TEC117", "Management", 14, 2],
    ["TEC122", "Anglais des affaires", 14, 2],
    ["TEC113", "Droit social", 14, 3],
    ["TEC114", "Droit fiscal", 14, 3],
    ["TEC120", "Comptabilité approfondie", 14, 3],
    ["TEC121", "Contrôle de gestion", 14, 3],
    ["TEC123", "Communication professionnelle", 12, 3],
  ],
  DSGC: [
    ["TEC211", "Gestion juridique, fiscale et sociale", 20, 1],
    ["TEC212", "Finance", 15, 1],
    ["TEC213", "Contrôle de gestion et stratégie", 20, 1],
    ["TEC214", "Comptabilité et audit", 20, 2],
    ["TEC215", "Management des systèmes d'information", 15, 2],
    ["TEC217", "Mémoire professionnel", 15, 2],
    ["TEC218", "Anglais des affaires", 15, 2],
  ],
};

/** Idempotent : peut être relancé sans créer de doublons. */
export async function seedReferentiel(db: Db) {
  for (const libelle of ANNEES) {
    const [existe] = await db.select().from(anneesAcademiques).where(eq(anneesAcademiques.libelle, libelle));
    if (!existe) await db.insert(anneesAcademiques).values({ libelle });
  }
  for (const f of FORMATIONS) {
    const [existe] = await db
      .select()
      .from(formations)
      .where(or(eq(formations.code, f.code), eq(formations.nom, f.nom)));
    if (existe) await db.update(formations).set(f).where(eq(formations.id, existe.id));
    else await db.insert(formations).values(f);
  }
  for (const [code, liste] of Object.entries(CATALOGUE)) {
    const [formation] = await db.select().from(formations).where(eq(formations.code, code));
    for (const [index, [codeUe, libelle, credits, annee]] of liste.entries()) {
      const valeurs = {
        formationId: formation.id,
        code: codeUe,
        libelle,
        credits,
        anneeParcours: annee,
        ordre: index + 1,
        active: true,
      };
      const [existe] = await db.select().from(ues).where(eq(ues.code, codeUe));
      if (existe) await db.update(ues).set(valeurs).where(eq(ues.id, existe.id));
      else await db.insert(ues).values(valeurs);
    }
  }
}
