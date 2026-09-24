import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { etudiants } from "@/db/schema";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { STATUTS_ETUDIANT } from "@/lib/validation";
import { actionModifierEtudiant } from "../../actions";

export const metadata: Metadata = { title: "Modifier l’identité" };

export default async function ModifierEtudiant({ params }: PageProps<"/etudiants/[id]/edit">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const [e] = id ? await getDb().select().from(etudiants).where(eq(etudiants.id, id)) : [];
  if (!e) notFound();
  return (
    <div className="max-w-2xl">
      <Retour href={`/etudiants/${e.id}`}>Retour à la fiche</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-6">Modifier l’identité</h1>
      <Formulaire action={actionModifierEtudiant.bind(null, e.id)} erreurs="premiere" className="bg-white rounded-xl shadow p-6 space-y-4">
        <p className="text-sm text-gray-500">Les inscriptions, UE et données financières ne seront pas modifiées.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm text-gray-600">
            Nom
            <input name="nom" defaultValue={e.nom} required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Prénom
            <input name="prenom" defaultValue={e.prenom} required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            E-mail
            <input type="email" name="email" defaultValue={e.email} required className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Téléphone
            <input name="telephone" defaultValue={e.telephone ?? ""} className="w-full rounded-lg mt-1" />
          </label>
          <label className="text-sm text-gray-600">
            Statut étudiant
            <select name="statut_etudiant" defaultValue={e.statutEtudiant} className="w-full rounded-lg mt-1">
              {STATUTS_ETUDIANT.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg">Mettre à jour</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
