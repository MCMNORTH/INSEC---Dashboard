import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { etudiants, inscriptionUe, inscriptions, versements } from "@/db/schema";
import { AppError, ValidationError } from "@/lib/errors";
import { ajouterInscription, creerEtudiant, modifierEtudiant, supprimerEtudiant } from "@/lib/services/etudiants";
import { creerUtilisateur, ctx, etudiantInscrit, formation, premiereAnnee, uesDe } from "../aide";

async function donneesEtudiant(extra: Record<string, unknown> = {}) {
  const f = await formation("DGC");
  const a = await premiereAnnee();
  const ues = await uesDe("DGC", 1);
  return {
    nom: "Diallo",
    prenom: "Awa",
    email: "Awa.Diallo@Example.com",
    telephone: "22000000",
    statut_etudiant: "Actif",
    formation_id: String(f.id),
    annee_academique_id: String(a.id),
    annee_parcours: "1",
    date_inscription: "2026-09-20",
    numero_inscription_intec: "",
    ue_ids: ues.slice(0, 2).map((u) => String(u.id)),
    ...extra,
  };
}

describe("Étudiants et inscriptions", () => {
  it("crée un étudiant avec des UE compatibles et normalise l’e-mail", async () => {
    const admin = await creerUtilisateur("admin");
    const id = await creerEtudiant(ctx(admin), await donneesEtudiant());
    const [e] = await getDb().select().from(etudiants).where(eq(etudiants.id, id));
    expect(e.email).toBe("awa.diallo@example.com");
    const [i] = await getDb().select().from(inscriptions).where(eq(inscriptions.idEtudiant, id));
    expect(i.statut).toBe("active");
    expect(i.numeroInscriptionIntec).toBeNull();
    const liens = await getDb().select().from(inscriptionUe).where(eq(inscriptionUe.inscriptionId, i.id));
    expect(liens).toHaveLength(2);
  });

  it("refuse une UE qui n’appartient pas au diplôme ou à l’année choisis", async () => {
    const admin = await creerUtilisateur("admin");
    const ueAnnee2 = (await uesDe("DGC", 2))[0];
    await expect(creerEtudiant(ctx(admin), await donneesEtudiant({ ue_ids: [String(ueAnnee2.id)] }))).rejects.toThrow(
      "Les UE choisies doivent appartenir au diplôme et à l’année de parcours sélectionnés.",
    );
    const ueDsgc = (await uesDe("DSGC", 1))[0];
    await expect(creerEtudiant(ctx(admin), await donneesEtudiant({ ue_ids: [String(ueDsgc.id)] }))).rejects.toBeInstanceOf(ValidationError);
    await expect(creerEtudiant(ctx(admin), await donneesEtudiant({ annee_parcours: "4" }))).rejects.toBeInstanceOf(ValidationError);
    expect(await getDb().select().from(etudiants)).toHaveLength(0);
  });

  it("exige au moins une UE et refuse un e-mail déjà utilisé", async () => {
    const admin = await creerUtilisateur("admin");
    await expect(creerEtudiant(ctx(admin), await donneesEtudiant({ ue_ids: [] }))).rejects.toThrow("Sélectionnez au moins une UE.");
    await creerEtudiant(ctx(admin), await donneesEtudiant());
    await expect(creerEtudiant(ctx(admin), await donneesEtudiant())).rejects.toThrow("déjà utilisée");
  });

  it("une seconde inscription conserve la première", async () => {
    const admin = await creerUtilisateur("admin");
    const id = await creerEtudiant(ctx(admin), await donneesEtudiant());
    const f = await formation("DGC");
    const annees = await getDb().query.anneesAcademiques.findMany();
    const ues2 = await uesDe("DGC", 2);
    await ajouterInscription(ctx(admin), id, {
      formation_id: f.id,
      annee_academique_id: annees[1].id,
      annee_parcours: 2,
      date_inscription: "2027-09-20",
      statut: "active",
      ue_ids: ues2.map((u) => u.id),
    });
    const toutes = await getDb().select().from(inscriptions).where(eq(inscriptions.idEtudiant, id));
    expect(toutes).toHaveLength(2);
    expect(toutes.map((i) => i.anneeParcours).sort()).toEqual([1, 2]);
  });

  it("la mise à jour de l’identité ne touche pas aux inscriptions", async () => {
    const admin = await creerUtilisateur("admin");
    const id = await creerEtudiant(ctx(admin), await donneesEtudiant());
    const [avant] = await getDb().select().from(inscriptions).where(eq(inscriptions.idEtudiant, id));
    await modifierEtudiant(ctx(admin), id, {
      nom: "Diallo",
      prenom: "Awa Marie",
      email: "awa.diallo@example.com",
      telephone: "",
      statut_etudiant: "Suspendu",
    });
    const [e] = await getDb().select().from(etudiants).where(eq(etudiants.id, id));
    expect(e.prenom).toBe("Awa Marie");
    expect(e.telephone).toBeNull();
    const [apres] = await getDb().select().from(inscriptions).where(eq(inscriptions.idEtudiant, id));
    expect(apres).toEqual(avant);
  });

  it("refuse la suppression d’un étudiant qui a un historique financier", async () => {
    const admin = await creerUtilisateur("admin");
    const { etudiant, inscription } = await etudiantInscrit();
    await getDb().insert(versements).values({ inscriptionId: inscription.id, montant: 1000, dateVersement: "2026-09-01", statut: "En attente" });
    await expect(supprimerEtudiant(ctx(admin), etudiant.id)).rejects.toBeInstanceOf(AppError);

    const autre = await etudiantInscrit("autre@example.com");
    await supprimerEtudiant(ctx(admin), autre.etudiant.id);
    expect(await getDb().select().from(etudiants).where(eq(etudiants.id, autre.etudiant.id))).toHaveLength(0);
  });
});
