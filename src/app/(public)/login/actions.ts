"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { adresseIp } from "@/lib/auth/current";
import { COOKIE_SESSION, optionsCookie, signerSession } from "@/lib/auth/token";
import { cheminInterne, homeFor } from "@/lib/roles";
import { authentifier, demanderCode, reinitialiser, verifierCode } from "@/lib/services/auth";

export async function connexion(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const donnees = lireFormulaire(fd);
  const res = await tenter(async () => authentifier(getDb(), donnees, await adresseIp()));
  if (!res.ok) return res.etat;
  const user = res.valeur;
  (await cookies()).set(COOKIE_SESSION, await signerSession(user.id, user.sessionVersion), optionsCookie());
  redirect(cheminInterne(donnees.next, homeFor(user.role)));
}

export async function deconnexion() {
  (await cookies()).delete(COOKIE_SESSION);
  redirect("/login");
}

export async function envoyerCode(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const res = await tenter(() => demanderCode(getDb(), lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Si un compte actif correspond à cette adresse, un code de vérification vient d’y être envoyé.");
  redirect(`/verify-email-code?email=${encodeURIComponent(res.valeur)}`);
}

export async function controlerCode(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const d = lireFormulaire(fd);
  const res = await tenter(() => verifierCode(getDb(), String(d.email ?? ""), String(d.code ?? "")));
  if (!res.ok) return res.etat;
  redirect(`/reset-password?email=${encodeURIComponent(String(d.email))}&code=${encodeURIComponent(String(d.code))}`);
}

export async function nouveauMotDePasse(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const res = await tenter(() => reinitialiser(getDb(), lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Votre mot de passe a été réinitialisé avec succès.");
  redirect("/login");
}
