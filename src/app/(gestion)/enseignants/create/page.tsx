import type { Metadata } from "next";
import { ChampsEnseignant } from "@/components/champs-enseignant";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { actionCreerEnseignant } from "../actions";

export const metadata: Metadata = { title: "Nouvel enseignant" };

export default async function NouvelEnseignant() {
  await exigerRole(ADMINS);
  return (
    <div className="max-w-2xl">
      <Retour href="/enseignants">Retour à la liste</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-6">Nouvel enseignant</h1>
      <Formulaire action={actionCreerEnseignant} className="bg-white rounded-xl shadow p-6 space-y-4">
        <ChampsEnseignant />
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg">Enregistrer</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
