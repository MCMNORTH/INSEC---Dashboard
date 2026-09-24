import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { inscriptions, versements } from "@/db/schema";
import { montantEnRetard, montantNet, soldeRestant, statutPaiement } from "@/lib/domain/calculs";
import { anneeMois } from "@/lib/format";
import { ajouterEcheance, ajouterVersement, modifierSituation } from "@/lib/services/finances";
import { boiteMail, creerUtilisateur, ctx, etudiantInscrit } from "../aide";

async function recharger(id: number) {
  return (await getDb().query.inscriptions.findFirst({
    where: eq(inscriptions.id, id),
    with: { versements: true, echeances: true },
  }))!;
}

describe("Suivi financier", () => {
  it("calcule remise, versement et solde par inscription, et numérote le reçu", async () => {
    const admin = await creerUtilisateur("admin");
    const { inscription } = await etudiantInscrit();
    await modifierSituation(ctx(admin), inscription.id, { montant_du: "100000", montant_remise: "10000", note_financiere: "Remise direction" });
    await ajouterVersement(ctx(admin), inscription.id, {
      montant: "30000",
      date_versement: "2026-09-20",
      statut: "Validée",
      mode_paiement: "Virement",
      reference: "VIR-42",
    });
    const i = await recharger(inscription.id);
    expect(montantNet(i)).toBe(90000);
    expect(soldeRestant(i)).toBe(60000);
    expect(statutPaiement(i)).toBe("Partiel");
    expect(i.versements[0].numeroRecu).toBe(`REC-${anneeMois()}-000001`);
    expect(boiteMail.map((m) => m.type)).toEqual(["Paiement"]);
  });

  it("un versement en attente ne compte pas comme payé", async () => {
    const { inscription } = await etudiantInscrit();
    await getDb().update(inscriptions).set({ montantDu: 50000 }).where(eq(inscriptions.id, inscription.id));
    await getDb().insert(versements).values({ inscriptionId: inscription.id, montant: 50000, dateVersement: "2026-09-20", statut: "En attente" });
    const i = await recharger(inscription.id);
    expect(soldeRestant(i)).toBe(50000);
    expect(statutPaiement(i)).toBe("Impayé");
  });

  it("signale une échéance dépassée", async () => {
    const admin = await creerUtilisateur("finance");
    const { inscription } = await etudiantInscrit();
    await getDb().update(inscriptions).set({ montantDu: 100000 }).where(eq(inscriptions.id, inscription.id));
    await ajouterEcheance(ctx(admin), inscription.id, { libelle: "Première tranche", montant: "40000", date_echeance: "2025-01-01" });
    await ajouterEcheance(ctx(admin), inscription.id, { libelle: "Deuxième tranche", montant: "40000", date_echeance: "2099-01-01" });
    expect(montantEnRetard(await recharger(inscription.id))).toBe(40000);
  });

  it("rattache le versement uniquement à l’inscription visée", async () => {
    const admin = await creerUtilisateur("admin");
    const { inscription } = await etudiantInscrit();
    const autre = await etudiantInscrit("oumar@example.com");
    await ajouterVersement(ctx(admin), inscription.id, { montant: "1000", date_versement: "2026-09-20", statut: "Validée", mode_paiement: "Espèces" });
    expect((await recharger(inscription.id)).versements).toHaveLength(1);
    expect((await recharger(autre.inscription.id)).versements).toHaveLength(0);
  });

  it("refuse une remise supérieure au montant brut et un montant nul", async () => {
    const admin = await creerUtilisateur("admin");
    const { inscription } = await etudiantInscrit();
    await expect(modifierSituation(ctx(admin), inscription.id, { montant_du: "1000", montant_remise: "2000" })).rejects.toThrow(
      "La remise ne peut pas dépasser le montant brut.",
    );
    await expect(
      ajouterVersement(ctx(admin), inscription.id, { montant: "0", date_versement: "2026-09-20", statut: "Validée", mode_paiement: "Espèces" }),
    ).rejects.toThrow();
  });
});
