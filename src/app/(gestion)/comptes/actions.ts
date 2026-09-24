"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { basculerCompte, creerCompte } from "@/lib/services/comptes";

export async function actionCreerCompte(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "comptes.store");
  const res = await tenter(() => creerCompte(ctx, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Compte utilisateur créé.");
  redirect("/comptes");
}

export async function actionBasculer(fd: FormData) {
  const ctx = await contexte(ADMINS, "comptes.toggle");
  const res = await tenter(() => basculerCompte(ctx, Number(fd.get("id"))));
  if (res.ok) await flash("succes", res.valeur ? "Compte activé." : "Compte désactivé.");
  else await flash("erreur", res.etat.erreurs[0]);
  redirect("/comptes");
}
