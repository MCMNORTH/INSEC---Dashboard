"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import {
  affecterUe,
  creerEnseignant,
  modifierEnseignant,
  retirerAffectation,
  supprimerEnseignant,
} from "@/lib/services/enseignants";

export async function actionCreerEnseignant(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "enseignants.store");
  const res = await tenter(() => creerEnseignant(ctx, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Enseignant ajouté avec succès.");
  redirect("/enseignants");
}

export async function actionModifierEnseignant(id: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "enseignants.update");
  const res = await tenter(() => modifierEnseignant(ctx, id, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Enseignant modifié avec succès.");
  redirect("/enseignants");
}

export async function actionSupprimerEnseignant(fd: FormData) {
  const ctx = await contexte(ADMINS, "enseignants.destroy");
  const res = await tenter(() => supprimerEnseignant(ctx, Number(fd.get("id"))));
  await flash(res.ok ? "succes" : "erreur", res.ok ? "Enseignant supprimé avec succès." : res.etat.erreurs[0]);
  redirect("/enseignants");
}

export async function actionAffecter(id: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "enseignants.affectations.store");
  const res = await tenter(() => affecterUe(ctx, id, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "UE affectée avec succès.");
  redirect(`/enseignants/${id}`);
}

export async function actionRetirer(fd: FormData) {
  const ctx = await contexte(ADMINS, "affectations.destroy");
  const res = await tenter(() => retirerAffectation(ctx, Number(fd.get("id"))));
  if (!res.ok) {
    await flash("erreur", res.etat.erreurs[0]);
    redirect("/enseignants");
  }
  await flash("succes", "Affectation retirée avec succès.");
  redirect(`/enseignants/${res.valeur}`);
}
