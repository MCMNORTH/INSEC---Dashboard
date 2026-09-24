"use server";

import { redirect } from "next/navigation";
import { type EtatFormulaire, lireFormulaire, tenter } from "@/lib/actions";
import { contextePublic } from "@/lib/auth/current";
import { deposerCandidature } from "@/lib/services/candidatures";

export async function actionDeposer(_: EtatFormulaire, fd: FormData): Promise<EtatFormulaire> {
  const donnees = lireFormulaire(fd);
  // Champ piège invisible : les robots le remplissent, les humains non.
  if (typeof donnees.site_web === "string" && donnees.site_web !== "") return { erreurs: ["Envoi refusé."] };
  if (donnees.consentement !== "on") {
    return { erreurs: ["Vous devez certifier l’exactitude des informations transmises."] };
  }
  const ctx = await contextePublic("candidatures.store");
  const res = await tenter(() => deposerCandidature(ctx, donnees));
  if (!res.ok) return res.etat;
  redirect(`/admission/confirmation/${encodeURIComponent(res.valeur)}`);
}
