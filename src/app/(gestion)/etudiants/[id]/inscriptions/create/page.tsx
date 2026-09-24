import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { etudiants } from "@/db/schema";
import { ChampsInscription } from "@/components/champs-inscription";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { aujourdhui } from "@/lib/format";
import { anneesRecentes, formationsAvecUes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";
import { actionAjouterInscription } from "../../../actions";

export const metadata: Metadata = { title: "Nouvelle inscription" };

export default async function NouvelleInscription({ params }: PageProps<"/etudiants/[id]/inscriptions/create">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const [etudiant] = id ? await getDb().select().from(etudiants).where(eq(etudiants.id, id)) : [];
  if (!etudiant) notFound();
  const [formations, annees] = await Promise.all([formationsAvecUes(), anneesRecentes()]);
  return (
    <div className="max-w-4xl">
      <Retour href={`/etudiants/${etudiant.id}`}>Retour à la fiche</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-1">Nouvelle inscription</h1>
      <p className="text-gray-600 mb-6">
        {etudiant.prenom} {etudiant.nom}
      </p>
      <Formulaire action={actionAjouterInscription.bind(null, etudiant.id)} erreurs="premiere" className="bg-white rounded-xl shadow p-6 space-y-5">
        <ChampsInscription formations={formations} annees={annees} afficherStatut aujourdhui={aujourdhui()} />
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg">Ajouter l’inscription</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
