import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CarteAuth, boutonAuth, champAuth } from "@/components/carte-auth";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { utilisateurCourant } from "@/lib/auth/current";
import { homeFor } from "@/lib/roles";
import { connexion } from "./actions";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: PageProps<"/login">) {
  const user = await utilisateurCourant();
  if (user) redirect(homeFor(user.role));
  const { next } = await searchParams;
  return (
    <CarteAuth titre="Connexion" sousTitre="Entrez vos identifiants pour continuer">
      <Flash className="mb-3" />
      <Formulaire action={connexion} className="space-y-3">
        {typeof next === "string" && <input type="hidden" name="next" value={next} />}
        <label className="block text-sm text-gray-600">
          Adresse e-mail
          <input type="email" name="email" required autoFocus autoComplete="username" className={`${champAuth} mt-1`} />
        </label>
        <label className="block text-sm text-gray-600">
          Mot de passe
          <input type="password" name="password" required autoComplete="current-password" className={`${champAuth} mt-1`} />
        </label>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-insec hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <BoutonEnvoi className={boutonAuth}>Se connecter</BoutonEnvoi>
        <Link href="/admission" className="block w-full text-center border border-gray-400 text-gray-600 hover:bg-gray-50 py-2.5 rounded-lg">
          Déposer une candidature
        </Link>
      </Formulaire>
    </CarteAuth>
  );
}
