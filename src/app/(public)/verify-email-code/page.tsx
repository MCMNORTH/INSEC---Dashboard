import type { Metadata } from "next";
import Link from "next/link";
import { CarteAuth, boutonAuth, champAuth } from "@/components/carte-auth";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { param } from "@/components/ui";
import { controlerCode } from "../login/actions";

export const metadata: Metadata = { title: "Code de vérification" };

export default async function PageCode({ searchParams }: PageProps<"/verify-email-code">) {
  const email = param((await searchParams).email) ?? "";
  return (
    <CarteAuth titre="Vérification" sousTitre="Saisissez le code à 6 chiffres reçu par e-mail. Il expire au bout de 15 minutes.">
      <Flash className="mb-3" />
      <Formulaire action={controlerCode} className="space-y-3">
        <label className="block text-sm text-gray-600">
          Adresse e-mail
          <input type="email" name="email" defaultValue={email} required className={`${champAuth} mt-1`} />
        </label>
        <label className="block text-sm text-gray-600">
          Code de vérification
          <input
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            autoComplete="one-time-code"
            className={`${champAuth} mt-1 tracking-[0.5em] font-mono text-lg`}
          />
        </label>
        <BoutonEnvoi className={boutonAuth}>Vérifier le code</BoutonEnvoi>
        <Link href="/forgot-password" className="block text-center text-sm text-insec hover:underline">
          Recevoir un nouveau code
        </Link>
      </Formulaire>
    </CarteAuth>
  );
}
