/**
 * Règles de calcul métier (reprises à l'identique des accesseurs Eloquent de l'ancienne application).
 */
import { aujourdhui } from "@/lib/format";

export type VersementCalc = { montant: number; statut: string };
export type EcheanceCalc = { montant: number; dateEcheance: string };
export type InscriptionCalc = {
  montantDu: number;
  montantRemise: number;
  versements: VersementCalc[];
  echeances?: EcheanceCalc[];
};

export type StatutPaiement = "Soldé" | "Partiel" | "Impayé";

export function montantNet(i: Pick<InscriptionCalc, "montantDu" | "montantRemise">): number {
  return Math.max(i.montantDu - i.montantRemise, 0);
}

/** Seuls les versements validés comptent comme payés. */
export function totalVerse(i: Pick<InscriptionCalc, "versements">): number {
  return i.versements.filter((v) => v.statut === "Validée").reduce((s, v) => s + v.montant, 0);
}

export function soldeRestant(i: InscriptionCalc): number {
  return Math.max(montantNet(i) - totalVerse(i), 0);
}

export function statutPaiement(i: InscriptionCalc): StatutPaiement {
  const net = montantNet(i);
  const verse = totalVerse(i);
  if (net <= 0) return "Soldé";
  if (verse >= net) return "Soldé";
  if (verse > 0) return "Partiel";
  return "Impayé";
}

/** Montant des échéances passées (strictement avant aujourd'hui) non couvert par les versements validés. */
export function montantEnRetard(i: InscriptionCalc, today = aujourdhui()): number {
  const exigible = (i.echeances ?? [])
    .filter((e) => e.dateEcheance < today)
    .reduce((s, e) => s + e.montant, 0);
  return Math.max(Math.min(exigible, montantNet(i)) - totalVerse(i), 0);
}

export function situation(i: InscriptionCalc, today = aujourdhui()) {
  return {
    montantNet: montantNet(i),
    totalVerse: totalVerse(i),
    soldeRestant: soldeRestant(i),
    statutPaiement: statutPaiement(i),
    montantEnRetard: montantEnRetard(i, today),
  };
}

/* ----------------------------- Académique ----------------------------- */

export type ResultatCalc = { presence: string; note: number | null };

/** Une UE est validée si l'étudiant était présent et que sa note atteint le seuil de l'examen. */
export function resultatValide(r: ResultatCalc, examen: { seuilValidation: number }): boolean {
  return r.presence === "Présent" && r.note !== null && r.note >= examen.seuilValidation;
}

/** Crédits validés : somme des crédits des UE distinctes dont au moins un résultat est validant. */
export function creditsValides(
  resultats: (ResultatCalc & { examen: { seuilValidation: number; ue: { id: number; credits: number } | null } | null })[],
): number {
  const ues = new Map<number, number>();
  for (const r of resultats) {
    if (r.examen?.ue && resultatValide(r, r.examen)) ues.set(r.examen.ue.id, r.examen.ue.credits);
  }
  return [...ues.values()].reduce((s, c) => s + c, 0);
}

export function pourcentage(numerateur: number, denominateur: number, decimales = 1): number {
  if (denominateur <= 0) return 0;
  const f = 10 ** decimales;
  return Math.round((numerateur / denominateur) * 100 * f) / f;
}
