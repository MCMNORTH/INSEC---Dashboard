"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { envoyerPlusieurs } from "@/lib/mail";
import { ADMINS } from "@/lib/roles";
import { planifierExamen, saisirResultat } from "@/lib/services/examens";

export async function actionPlanifier(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "examens.store");
  const res = await tenter(() => planifierExamen(ctx, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  const { id, convocations } = res.valeur;
  // Les convocations partent après la réponse pour ne pas faire attendre l'utilisateur.
  after(() => envoyerPlusieurs(ctx.db, convocations));
  await flash("succes", `Examen créé ; ${convocations.length} étudiant(s) éligible(s) convoqué(s).`);
  redirect(`/examens/${id}`);
}

export async function actionResultat(examenId: number, resultatId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "examens.resultats.update");
  const res = await tenter(() => saisirResultat(ctx, examenId, resultatId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Résultat enregistré.");
  redirect(`/examens/${examenId}`);
}
