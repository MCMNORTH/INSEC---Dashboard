"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { flash, tenter } from "@/lib/actions";
import { exigerConnexion } from "@/lib/auth/current";
import { cheminInterne } from "@/lib/roles";
import { archiverAlerte, lireAlerte, toutLire } from "@/lib/services/alertes";

/** Marque l'alerte comme lue puis ouvre son lien (uniquement un lien interne). */
export async function actionLire(fd: FormData) {
  const user = await exigerConnexion();
  const res = await tenter(() => lireAlerte(getDb(), user.id, Number(fd.get("id"))));
  if (!res.ok) {
    await flash("erreur", res.etat.erreurs[0]);
    redirect("/alertes");
  }
  redirect(cheminInterne(res.valeur, "/alertes"));
}

export async function actionArchiver(fd: FormData) {
  const user = await exigerConnexion();
  const res = await tenter(() => archiverAlerte(getDb(), user.id, Number(fd.get("id"))));
  await flash(res.ok ? "succes" : "erreur", res.ok ? "Alerte archivée." : res.etat.erreurs[0]);
  redirect("/alertes");
}

export async function actionToutLire() {
  const user = await exigerConnexion();
  await toutLire(getDb(), user.id);
  await flash("succes", "Toutes les alertes ont été marquées comme lues.");
  redirect("/alertes");
}
