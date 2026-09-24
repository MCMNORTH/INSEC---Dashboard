import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { inscriptions } from "@/db/schema";
import { ChampsInscription } from "@/components/champs-inscription";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { aujourdhui } from "@/lib/format";
import { anneesRecentes, formationsAvecUes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";
import { actionModifierInscription } from "../../../etudiants/actions";

export const metadata: Metadata = { title: "Modifier l’inscription" };

export default async function ModifierInscription({ params }: PageProps<"/inscriptions/[id]/edit">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const inscription = id
    ? await getDb().query.inscriptions.findFirst({
        where: eq(inscriptions.id, id),
        with: { etudiant: true, inscriptionUes: true },
      })
    : undefined;
  if (!inscription) notFound();
  const [formations, annees] = await Promise.all([formationsAvecUes(), anneesRecentes()]);
  return (
    <div className="max-w-4xl">
      <Retour href={`/etudiants/${inscription.idEtudiant}`}>Retour à la fiche</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-1">Modifier l’inscription</h1>
      <p className="text-gray-600 mb-6">
        {inscription.etudiant.prenom} {inscription.etudiant.nom}
      </p>
      <Formulaire
        action={actionModifierInscription.bind(null, inscription.id)}
        erreurs="premiere"
        className="bg-white rounded-xl shadow p-6 space-y-5"
      >
        <ChampsInscription
          formations={formations}
          annees={annees}
          afficherStatut
          aujourdhui={aujourdhui()}
          valeurs={{
            formationId: inscription.idFormation,
            anneeAcademiqueId: inscription.idAnneeAcademique,
            anneeParcours: inscription.anneeParcours,
            dateInscription: inscription.dateInscription,
            numeroInscriptionIntec: inscription.numeroInscriptionIntec,
            statut: inscription.statut,
            ueIds: inscription.inscriptionUes.map((iu) => iu.ueId),
          }}
        />
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg">Mettre à jour</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
