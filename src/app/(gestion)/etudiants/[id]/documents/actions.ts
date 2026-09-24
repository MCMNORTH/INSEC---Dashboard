"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, flash, lireFormulaire, tenter } from "@/lib/actions";
import { contexte } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { deposerPiece, modifierPiece } from "@/lib/services/documents";

export async function actionDeposerPiece(etudiantId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "etudiants.documents.store");
  const res = await tenter(() => deposerPiece(ctx, etudiantId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Pièce ajoutée au dossier.");
  redirect(`/etudiants/${etudiantId}/documents`);
}

export async function actionModifierPiece(pieceId: number, _: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const ctx = await contexte(ADMINS, "documents.update");
  const res = await tenter(() => modifierPiece(ctx, pieceId, lireFormulaire(fd)));
  if (!res.ok) return res.etat;
  await flash("succes", "Statut de la pièce mis à jour.");
  redirect(`/etudiants/${res.valeur}/documents`);
}
