import type { Metadata } from "next";
import { CarteAuth, boutonAuth, champAuth } from "@/components/carte-auth";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { param } from "@/components/ui";
import { nouveauMotDePasse } from "../login/actions";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function PageNouveauMotDePasse({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  return (
    <CarteAuth titre="Nouveau mot de passe" sousTitre="Choisissez un mot de passe d’au moins 8 caractères.">
      <Formulaire action={nouveauMotDePasse} className="space-y-3">
        <input type="hidden" name="email" value={param(sp.email) ?? ""} />
        <input type="hidden" name="code" value={param(sp.code) ?? ""} />
        <label className="block text-sm text-gray-600">
          Nouveau mot de passe
          <input type="password" name="password" required minLength={8} autoComplete="new-password" className={`${champAuth} mt-1`} />
        </label>
        <label className="block text-sm text-gray-600">
          Confirmer le mot de passe
          <input type="password" name="password_confirmation" required minLength={8} autoComplete="new-password" className={`${champAuth} mt-1`} />
        </label>
        <BoutonEnvoi className={boutonAuth}>Réinitialiser le mot de passe</BoutonEnvoi>
      </Formulaire>
    </CarteAuth>
  );
}
