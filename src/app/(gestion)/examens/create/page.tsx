import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ues } from "@/db/schema";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { anneesRecentes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";
import { actionPlanifier } from "../actions";

export const metadata: Metadata = { title: "Planifier un examen" };

export default async function PlanifierExamen() {
  await exigerRole(ADMINS);
  const [liste, annees] = await Promise.all([
    getDb().query.ues.findMany({ where: eq(ues.active, true), orderBy: asc(ues.code), with: { formation: true } }),
    anneesRecentes(),
  ]);
  return (
    <div className="max-w-3xl">
      <Retour href="/examens">Retour</Retour>
      <h1 className="text-xl font-bold text-insec mt-2 mb-5">Planifier un examen</h1>
      <Formulaire action={actionPlanifier} erreurs="premiere" className="bg-white rounded-xl shadow p-6 grid md:grid-cols-2 gap-4">
        <label className="md:col-span-2 text-sm">
          UE
          <select name="ue_id" required defaultValue="" className="w-full rounded-lg mt-1">
            <option value="">Sélectionner…</option>
            {liste.map((ue) => (
              <option key={ue.id} value={ue.id}>
                {ue.formation?.code} · {ue.code} — {ue.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Année académique
          <select name="annee_academique_id" className="w-full rounded-lg mt-1">
            {annees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Session
          <select name="session" className="w-full rounded-lg mt-1">
            <option>Normale</option>
            <option>Rattrapage</option>
          </select>
        </label>
        <label className="text-sm">
          Date et heure
          <input type="datetime-local" name="date_examen" required className="w-full rounded-lg mt-1" />
        </label>
        <label className="text-sm">
          Salle / lien
          <input name="salle" className="w-full rounded-lg mt-1" />
        </label>
        <label className="text-sm">
          Note sur
          <input type="number" step="0.01" name="note_sur" defaultValue={20} min={1} max={100} required className="w-full rounded-lg mt-1" />
        </label>
        <label className="text-sm">
          Seuil de validation
          <input type="number" step="0.01" name="seuil_validation" defaultValue={10} min={0} required className="w-full rounded-lg mt-1" />
        </label>
        <input type="hidden" name="statut" value="Planifié" />
        <p className="md:col-span-2 text-sm text-gray-500">
          Les étudiants inscrits à cette UE pendant l’année choisie seront convoqués automatiquement par e-mail.
        </p>
        <BoutonEnvoi className="md:col-span-2 bg-amber-500 text-white px-4 py-2 rounded-lg">Créer et convoquer</BoutonEnvoi>
      </Formulaire>
    </div>
  );
}
