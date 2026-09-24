"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { convertirCandidature, deciderCandidature } from "@/lib/services/candidatures";

export async function actionDecider(id: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "candidatures.update");
  const res = await tenter(() => deciderCandidature(ctx, id, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Décision enregistrée.");
  redirect(`/candidatures/${id}`);
}

export async function actionConvertir(id: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "candidatures.convertir");
  const res = await tenter(() => convertirCandidature(ctx, id, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Candidature convertie en étudiant et inscription créée.");
  redirect(`/etudiants/${res.valeur}`);
}
