import type { Metadata } from "next";
import Link from "next/link";
import { CarteAuth, boutonAuth, champAuth } from "@/components/carte-auth";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { envoyerCode } from "../login/actions";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function PageMotDePasseOublie() {
  return (
    <CarteAuth titre="Mot de passe oublié" sousTitre="Nous vous enverrons un code de vérification par e-mail.">
      <Formulaire action={envoyerCode} className="space-y-3">
        <label className="block text-sm text-gray-600">
          Adresse e-mail
          <input type="email" name="email" required autoFocus className={`${champAuth} mt-1`} />
        </label>
        <BoutonEnvoi className={boutonAuth}>Envoyer le code</BoutonEnvoi>
        <Link href="/login" className="block text-center text-sm text-insec hover:underline">
          Retour à la connexion
        </Link>
      </Formulaire>
    </CarteAuth>
  );
}
