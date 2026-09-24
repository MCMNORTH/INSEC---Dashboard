import type { Metadata } from "next";
import { ChampsInscription } from "@/components/champs-inscription";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { aujourdhui } from "@/lib/format";
import { anneesRecentes, formationsAvecUes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";
import { STATUTS_ETUDIANT } from "@/lib/validation";
import { actionCreerEtudiant } from "../actions";

export const metadata: Metadata = { title: "Nouvel étudiant" };

export default async function NouvelEtudiant() {
  await exigerRole(ADMINS);
  const [formations, annees] = await Promise.all([formationsAvecUes(), anneesRecentes()]);
  return (
    <div className="max-w-4xl">
      <Retour href="/etudiants">Retour</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-6">Nouvel étudiant et première inscription</h1>
      <Formulaire action={actionCreerEtudiant} className="bg-white rounded-xl shadow p-6 space-y-5">
        <h2 className="font-semibold text-insec">Identité</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-600">
            Nom
            <input name="nom" required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Prénom
            <input name="prenom" required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            E-mail
            <input type="email" name="email" required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Téléphone
            <input name="telephone" className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Statut étudiant
            <select name="statut_etudiant" defaultValue="Actif" className="w-full rounded-lg mt-1">
              {STATUTS_ETUDIANT.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <h2 className="font-semibold text-insec border-t pt-5">Inscription académique</h2>
        <ChampsInscription formations={formations} annees={annees} afficherStatut={false} aujourdhui={aujourdhui()} />
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg">Enregistrer</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
