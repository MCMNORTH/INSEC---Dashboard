import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { enseignants } from "@/db/schema";
import { ChampsEnseignant } from "@/components/champs-enseignant";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { actionModifierEnseignant } from "../../actions";

export const metadata: Metadata = { title: "Modifier l’enseignant" };

export default async function ModifierEnseignant({ params }: PageProps<"/enseignants/[id]/edit">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const [e] = id ? await getDb().select().from(enseignants).where(eq(enseignants.id, id)) : [];
  if (!e) notFound();
  return (
    <div className="max-w-2xl">
      <Retour href={`/enseignants/${e.id}`}>Retour à la fiche</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-6">Modifier l’enseignant</h1>
      <Formulaire action={actionModifierEnseignant.bind(null, e.id)} className="bg-white rounded-xl shadow p-6 space-y-4">
        <ChampsEnseignant valeurs={e} />
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg">Mettre à jour</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
