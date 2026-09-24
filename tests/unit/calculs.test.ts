import { describe, expect, it } from "vitest";
import { creditsValides, montantEnRetard, pourcentage, resultatValide, situation } from "@/lib/domain/calculs";
import { anneeCourante, depuisDateTimeLocal, formatMru, formatNote, versDateTimeLocal } from "@/lib/format";
import { cheminInterne } from "@/lib/roles";

describe("Calculs financiers", () => {
  const base = { montantDu: 100000, montantRemise: 10000, versements: [], echeances: [] };

  it("soldé quand le net est nul, partiel ou impayé sinon", () => {
    expect(situation({ ...base, montantRemise: 100000 }).statutPaiement).toBe("Soldé");
    expect(situation({ ...base, versements: [{ montant: 90000, statut: "Validée" }] }).statutPaiement).toBe("Soldé");
    expect(situation({ ...base, versements: [{ montant: 1, statut: "Validée" }] }).statutPaiement).toBe("Partiel");
    expect(situation({ ...base, versements: [{ montant: 90000, statut: "Rejetée" }] }).statutPaiement).toBe("Impayé");
  });

  it("le retard est plafonné au montant net et diminue avec les versements", () => {
    const i = {
      ...base,
      echeances: [
        { montant: 80000, dateEcheance: "2026-01-01" },
        { montant: 80000, dateEcheance: "2026-02-01" },
        { montant: 10000, dateEcheance: "2026-12-01" },
      ],
      versements: [{ montant: 20000, statut: "Validée" }],
    };
    expect(montantEnRetard(i, "2026-06-01")).toBe(70000);
    // Une échéance du jour même n'est pas encore en retard.
    expect(montantEnRetard({ ...i, versements: [] }, "2026-01-01")).toBe(0);
  });
});

describe("Calculs académiques", () => {
  it("valide une UE seulement si présent et note ≥ seuil, sans compter deux fois la même UE", () => {
    const examen = { seuilValidation: 10, ue: { id: 1, credits: 14 } };
    expect(resultatValide({ presence: "Présent", note: 10 }, examen)).toBe(true);
    expect(resultatValide({ presence: "Absent", note: 15 }, examen)).toBe(false);
    expect(resultatValide({ presence: "Présent", note: null }, examen)).toBe(false);
    expect(
      creditsValides([
        { presence: "Présent", note: 12, examen },
        { presence: "Présent", note: 14, examen },
        { presence: "Présent", note: 9, examen: { seuilValidation: 10, ue: { id: 2, credits: 12 } } },
      ]),
    ).toBe(14);
    expect(pourcentage(1, 3)).toBe(33.3);
    expect(pourcentage(1, 0)).toBe(0);
  });
});

describe("Mise en forme", () => {
  it("formate les montants et les notes comme l’ancienne application", () => {
    expect(formatMru(1234567)).toBe("1 234 567 MRU");
    expect(formatNote(12.5)).toBe("12.5");
    expect(formatNote(20)).toBe("20");
  });

  it("convertit l’heure locale saisie en instant et inversement", () => {
    const d = depuisDateTimeLocal("2026-10-05T09:30")!;
    expect(versDateTimeLocal(d)).toBe("2026-10-05T09:30");
    expect(depuisDateTimeLocal("pas une date")).toBeNull();
  });
});

describe("Redirections", () => {
  it("n’accepte que des chemins internes", () => {
    expect(cheminInterne("/finances?etudiant=2", "/x")).toBe("/finances?etudiant=2");
    for (const mauvais of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "/a\nb", 42, null]) {
      expect(cheminInterne(mauvais, "/x")).toBe("/x");
    }
  });
});

describe("Année académique en cours", () => {
  const annees = [{ id: 3, libelle: "2027-2028" }, { id: 2, libelle: "2026-2027" }, { id: 1, libelle: "2025-2026" }];
  it("bascule à la rentrée de septembre", () => {
    expect(anneeCourante(annees, new Date("2026-09-24T12:00:00Z"))?.id).toBe(2);
    expect(anneeCourante(annees, new Date("2026-08-31T12:00:00Z"))?.id).toBe(1);
    expect(anneeCourante(annees, new Date("2035-01-01T12:00:00Z"))?.id).toBe(3);
  });
});
