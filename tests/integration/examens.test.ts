import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { inscriptionUe, inscriptions, resultatsExamens } from "@/db/schema";
import { creditsValides } from "@/lib/domain/calculs";
import { versDateTimeLocal } from "@/lib/format";
import { envoyerPlusieurs } from "@/lib/mail";
import { planifierExamen, saisirResultat } from "@/lib/services/examens";
import { boiteMail, creerUtilisateur, ctx, etudiantInscrit, premiereAnnee, uesDe } from "../aide";

async function examenPour(ueId: number, extra: Record<string, unknown> = {}) {
  const admin = await creerUtilisateur("admin");
  const a = await premiereAnnee();
  const res = await planifierExamen(ctx(admin), {
    ue_id: String(ueId),
    annee_academique_id: String(a.id),
    session: "Normale",
    date_examen: versDateTimeLocal(new Date(Date.now() + 3 * 86_400_000)),
    salle: "A1",
    note_sur: "20",
    seuil_validation: "10",
    statut: "Planifié",
    ...extra,
  });
  return { admin, ...res };
}

describe("Examens et résultats", () => {
  it("convoque automatiquement les seuls étudiants inscrits à l’UE pour l’année", async () => {
    const [ue1, ue2] = await uesDe("DGC", 1);
    const inscritUe = await etudiantInscrit("a@example.com");
    const autreUe = await etudiantInscrit("b@example.com");
    await getDb().insert(inscriptionUe).values([
      { inscriptionId: inscritUe.inscription.id, ueId: ue1.id },
      { inscriptionId: autreUe.inscription.id, ueId: ue2.id },
    ]);
    const { id, convocations } = await examenPour(ue1.id);
    const resultats = await getDb().select().from(resultatsExamens).where(eq(resultatsExamens.examenId, id));
    expect(resultats.map((r) => r.inscriptionId)).toEqual([inscritUe.inscription.id]);
    expect(convocations).toHaveLength(1);
    await envoyerPlusieurs(getDb(), convocations);
    expect(boiteMail.map((m) => m.email)).toEqual(["a@example.com"]);
  });

  it("une note au-dessus du seuil valide l’UE et ses crédits", async () => {
    const [ue1] = await uesDe("DGC", 1);
    const { inscription } = await etudiantInscrit();
    await getDb().insert(inscriptionUe).values({ inscriptionId: inscription.id, ueId: ue1.id });
    const { admin, id } = await examenPour(ue1.id);
    const [r] = await getDb().select().from(resultatsExamens).where(eq(resultatsExamens.examenId, id));
    await saisirResultat(ctx(admin), id, r.id, { presence: "Présent", note: "12,5", commentaire: "" });
    const i = await getDb().query.inscriptions.findFirst({
      where: eq(inscriptions.id, inscription.id),
      with: { resultats: { with: { examen: { with: { ue: true } } } } },
    });
    expect(i!.resultats[0].note).toBe(12.5);
    expect(creditsValides(i!.resultats)).toBe(ue1.credits);
    expect(boiteMail.at(-1)?.details?.Décision).toBe("Validée");
  });

  it("refuse une note supérieure au maximum ou un présent sans note ; efface la note d’un absent", async () => {
    const [ue1] = await uesDe("DGC", 1);
    const { inscription } = await etudiantInscrit();
    await getDb().insert(inscriptionUe).values({ inscriptionId: inscription.id, ueId: ue1.id });
    const { admin, id } = await examenPour(ue1.id);
    const [r] = await getDb().select().from(resultatsExamens).where(eq(resultatsExamens.examenId, id));
    await expect(saisirResultat(ctx(admin), id, r.id, { presence: "Présent", note: "21" })).rejects.toThrow("ne peut pas dépasser 20");
    await expect(saisirResultat(ctx(admin), id, r.id, { presence: "Présent", note: "" })).rejects.toThrow("obligatoire");
    await saisirResultat(ctx(admin), id, r.id, { presence: "Absent", note: "15" });
    const [apres] = await getDb().select().from(resultatsExamens).where(eq(resultatsExamens.id, r.id));
    expect(apres.presence).toBe("Absent");
    expect(apres.note).toBeNull();
  });

  it("refuse un résultat qui n’appartient pas à l’examen et un seuil supérieur au maximum", async () => {
    const [ue1] = await uesDe("DGC", 1);
    const { inscription } = await etudiantInscrit();
    await getDb().insert(inscriptionUe).values({ inscriptionId: inscription.id, ueId: ue1.id });
    const { admin, id } = await examenPour(ue1.id);
    const autre = await examenPour(ue1.id);
    const [r] = await getDb().select().from(resultatsExamens).where(eq(resultatsExamens.examenId, id));
    await expect(saisirResultat(ctx(admin), autre.id, r.id, { presence: "Présent", note: "10" })).rejects.toThrow("introuvable");
    await expect(examenPour(ue1.id, { note_sur: "20", seuil_validation: "25" })).rejects.toThrow("seuil");
  });
});
