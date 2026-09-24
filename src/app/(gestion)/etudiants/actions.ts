"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import {
  ajouterInscription,
  creerEtudiant,
  modifierEtudiant,
  modifierInscription,
  supprimerEtudiant,
} from "@/lib/services/etudiants";

export async function actionCreerEtudiant(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "etudiants.store");
  const res = await tenter(() => creerEtudiant(ctx, lireFormulaire(fd, ["ue_ids"])));
  if (!res.ok) return res.etat;
  await flash("succes", "Étudiant et première inscription enregistrés.");
  redirect(`/etudiants/${res.valeur}`);
}

export async function actionModifierEtudiant(id: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "etudiants.update");
  const res = await tenter(() => modifierEtudiant(ctx, id, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Identité mise à jour sans modifier l’historique.");
  redirect(`/etudiants/${id}`);
}

export async function actionSupprimerEtudiant(fd: FormData) {
  const ctx = await contexte(ADMINS, "etudiants.destroy");
  const res = await tenter(() => supprimerEtudiant(ctx, Number(fd.get("id"))));
  await flash(res.ok ? "succes" : "erreur", res.ok ? "Étudiant supprimé." : res.etat.erreurs[0]);
  redirect("/etudiants");
}

export async function actionAjouterInscription(etudiantId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "etudiants.inscriptions.store");
  const res = await tenter(() => ajouterInscription(ctx, etudiantId, lireFormulaire(fd, ["ue_ids"])));
  if (!res.ok) return res.etat;
  await flash("succes", "Nouvelle inscription ajoutée ; l’historique précédent est conservé.");
  redirect(`/etudiants/${etudiantId}`);
}

export async function actionModifierInscription(inscriptionId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "inscriptions.update");
  const res = await tenter(() => modifierInscription(ctx, inscriptionId, lireFormulaire(fd, ["ue_ids"])));
  if (!res.ok) return res.etat;
  await flash("succes", "Inscription mise à jour.");
  redirect(`/etudiants/${res.valeur}`);
}
