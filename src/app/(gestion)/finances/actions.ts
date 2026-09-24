"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { FINANCE } from "@/lib/roles";
import { ajouterEcheance, ajouterVersement, modifierSituation } from "@/lib/services/finances";

function retour(inscription: { id: number; idEtudiant: number }) {
  return `/finances?etudiant=${inscription.idEtudiant}&inscription=${inscription.id}`;
}

export async function actionSituation(inscriptionId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(FINANCE, "finances.inscriptions.update");
  const res = await tenter(() => modifierSituation(ctx, inscriptionId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Situation financière mise à jour.");
  redirect(retour(res.valeur));
}

export async function actionVersement(inscriptionId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(FINANCE, "finances.versements.store");
  const res = await tenter(() => ajouterVersement(ctx, inscriptionId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", `Versement enregistré avec le reçu ${res.valeur.versement.numeroRecu}.`);
  redirect(retour(res.valeur.inscription));
}

export async function actionEcheance(inscriptionId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(FINANCE, "finances.echeances.store");
  const res = await tenter(() => ajouterEcheance(ctx, inscriptionId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Échéance ajoutée.");
  redirect(retour(res.valeur));
}
