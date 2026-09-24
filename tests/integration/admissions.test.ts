import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { candidatures, etudiants, inscriptionUe, inscriptions, journalEmails } from "@/db/schema";
import { convertirCandidature, deciderCandidature, deposerCandidature } from "@/lib/services/candidatures";
import { boiteMail, creerUtilisateur, ctx, formation, premiereAnnee, uesDe } from "../aide";

async function candidature(extra: Record<string, unknown> = {}) {
  const f = await formation("DGC");
  const a = await premiereAnnee();
  return deposerCandidature(ctx(null), {
    nom: "Sy",
    prenom: "Khadija",
    email: "khadija@example.com",
    telephone: "22112233",
    date_naissance: "2000-05-04",
    dernier_diplome: "Baccalauréat",
    formation_id: String(f.id),
    annee_academique_id: String(a.id),
    motivation: "",
    ...extra,
  });
}

describe("Admissions", () => {
  it("un candidat dépose une candidature publique et reçoit un e-mail journalisé", async () => {
    const reference = await candidature();
    expect(reference).toMatch(/^ADM-\d{6}-[A-Z0-9]{6}$/);
    const [c] = await getDb().select().from(candidatures);
    expect(c.statut).toBe("Nouvelle");
    expect(boiteMail[0].type).toBe("Candidature");
    const [journal] = await getDb().select().from(journalEmails);
    expect(journal.statut).toBe("Envoyé");
  });

  it("refuse un doublon (même e-mail, même année) et une date de naissance future", async () => {
    await candidature();
    await expect(candidature()).rejects.toThrow("Une candidature existe déjà");
    await expect(candidature({ email: "autre@example.com", date_naissance: "2999-01-01" })).rejects.toThrow("antérieure");
  });

  it("convertit une candidature admissible en étudiant inscrit avec les UE de l’année", async () => {
    const admin = await creerUtilisateur("admin");
    await candidature();
    const [c] = await getDb().select().from(candidatures);
    await deciderCandidature(ctx(admin), c.id, { statut: "Admissible", note_interne: "Dossier complet" });
    expect(boiteMail.at(-1)?.type).toBe("Admission");

    const etudiantId = await convertirCandidature(ctx(admin), c.id, {
      annee_parcours: "1",
      date_inscription: "2026-09-20",
      numero_inscription_intec: "INTEC-1",
      montant_du: "120000",
    });
    const [e] = await getDb().select().from(etudiants).where(eq(etudiants.id, etudiantId));
    expect(e.email).toBe("khadija@example.com");
    const [i] = await getDb().select().from(inscriptions).where(eq(inscriptions.idEtudiant, etudiantId));
    expect(i.montantDu).toBe(120000);
    const liens = await getDb().select().from(inscriptionUe).where(eq(inscriptionUe.inscriptionId, i.id));
    expect(liens).toHaveLength((await uesDe("DGC", 1)).length);
    const [apres] = await getDb().select().from(candidatures);
    expect(apres.statut).toBe("Inscrite");
    expect(apres.etudiantId).toBe(etudiantId);
    await expect(deciderCandidature(ctx(admin), c.id, { statut: "Rejetée" })).rejects.toThrow("déjà convertie");
  });

  it("une candidature non admissible ne peut pas être convertie", async () => {
    const admin = await creerUtilisateur("admin");
    await candidature();
    const [c] = await getDb().select().from(candidatures);
    await expect(
      convertirCandidature(ctx(admin), c.id, { annee_parcours: "1", date_inscription: "2026-09-20", montant_du: "0" }),
    ).rejects.toThrow("admissible");
    expect(await getDb().select().from(etudiants)).toHaveLength(0);
  });

  it("aucun e-mail n’est envoyé si la décision ne change pas le statut", async () => {
    const admin = await creerUtilisateur("admin");
    await candidature();
    const [c] = await getDb().select().from(candidatures);
    const avant = boiteMail.length;
    await deciderCandidature(ctx(admin), c.id, { statut: "Nouvelle", note_interne: "RAS" });
    expect(boiteMail.length).toBe(avant);
  });
});
