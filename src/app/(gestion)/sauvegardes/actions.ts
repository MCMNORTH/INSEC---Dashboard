"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { users } from "@/db/schema";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { auditManuel } from "@/lib/audit";
import { contexte } from "@/lib/auth/current";
import { verifier } from "@/lib/auth/password";
import { ValidationError } from "@/lib/errors";
import { SUPER_ADMIN } from "@/lib/roles";
import { creerSauvegarde, restaurerSauvegarde, verifierSauvegarde } from "@/lib/services/sauvegardes";

export async function actionCreerSauvegarde() {
  const ctx = await contexte(SUPER_ADMIN, "backups.store");
  const res = await tenter(async () => {
    const s = await creerSauvegarde(ctx.db, "Manuelle");
    await auditManuel(ctx.db, ctx, "backup", `Création de la sauvegarde ${s.nom}`);
  });
  await flash(res.ok ? "succes" : "erreur", res.ok ? "Sauvegarde créée et vérifiée." : res.etat.erreurs[0]);
  redirect("/sauvegardes");
}

export async function actionVerifierSauvegarde(fd: FormData) {
  const ctx = await contexte(SUPER_ADMIN, "backups.verify");
  const nom = String(fd.get("nom") ?? "");
  const res = await tenter(() => verifierSauvegarde(ctx.db, nom));
  if (!res.ok) {
    await flash("erreur", res.etat.erreurs[0]);
  } else {
    await auditManuel(ctx.db, ctx, "backup_verify", `Contrôle de la sauvegarde ${nom}`, null, { intégrité: res.valeur.integrite });
    await flash(res.valeur.integrite ? "succes" : "erreur", res.valeur.integrite ? "Intégrité confirmée." : "La sauvegarde est corrompue.");
  }
  redirect("/sauvegardes");
}

/** Restauration : mot de passe du compte et saisie explicite de « RESTAURER » obligatoires. */
export async function actionRestaurer(nom: string, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(SUPER_ADMIN, "backups.restore");
  const d = lireFormulaire(fd);
  const res = await tenter(async () => {
    if (d.confirmation !== "RESTAURER") throw new ValidationError(["Tapez RESTAURER pour confirmer."]);
    const [moi] = await ctx.db.select().from(users).where(eq(users.id, ctx.user.id));
    if (!moi || !(await verifier(String(d.password ?? ""), moi.password))) throw new ValidationError(["Mot de passe incorrect."]);
    await restaurerSauvegarde(ctx.db, nom);
  });
  if (!res.ok) return res.etat;
  // L'auteur n'existe peut-être plus dans les données restaurées : on n'y rattache le journal que s'il existe.
  const [existe] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.id, ctx.user.id));
  await auditManuel(ctx.db, existe ? ctx : { ...ctx, user: null }, "restore", `Restauration depuis ${nom} par ${ctx.user.name}`);
  await flash("succes", "Restauration terminée. Une sauvegarde de précaution a été créée.");
  redirect("/sauvegardes");
}
