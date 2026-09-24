import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { enseignants, ues } from "@/db/schema";
import { BoutonAction } from "@/components/bouton-action";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { initiales } from "@/lib/format";
import { ADMINS } from "@/lib/roles";
import { actionAffecter, actionRetirer } from "../actions";

export const metadata: Metadata = { title: "Fiche enseignant" };

export default async function FicheEnseignant({ params }: PageProps<"/enseignants/[id]">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const db = getDb();
  const e = id
    ? await db.query.enseignants.findFirst({
        where: eq(enseignants.id, id),
        with: { affectations: { with: { ue: true } } },
      })
    : undefined;
  if (!e) notFound();
  const affectees = new Set(e.affectations.map((a) => a.ueId));
  const disponibles = (await db.select().from(ues).orderBy(asc(ues.libelle))).filter((u) => !affectees.has(u.id));

  return (
    <div className="max-w-3xl">
      <Retour href="/enseignants">Retour à la liste</Retour>
      <Flash className="mt-4" />
      <div className="bg-white rounded-xl shadow p-6 mt-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-insec text-white flex items-center justify-center font-bold">{initiales(e.prenom, e.nom)}</div>
            <div>
              <h1 className="text-lg font-bold text-insec">
                {e.nom} {e.prenom}
              </h1>
              <p className="text-sm text-gray-500">{e.specialite}</p>
            </div>
          </div>
          <Link href={`/enseignants/${e.id}/edit`} className="text-gray-400 hover:text-blue-600 text-lg" title="Modifier">
            <i className="fa-solid fa-pen" aria-hidden />
            <span className="sr-only">Modifier</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">E-mail</p>
            <p className="font-medium break-all">{e.email}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500">Téléphone</p>
            <p className="font-medium">{e.telephone ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mt-4">
        <h2 className="font-bold text-insec mb-4">UE affectées et étudiants</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-insec text-white">
                <th className="p-2 text-left">UE</th>
                <th className="p-2 text-left">Crédits</th>
                <th className="p-2 text-left">Étudiants</th>
                <th className="p-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {e.affectations.length ? (
                e.affectations.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="p-2">
                      {a.ue.code} — {a.ue.libelle}
                    </td>
                    <td className="p-2">{a.ue.credits}</td>
                    <td className="p-2">{a.nombreEtudiants}</td>
                    <td className="p-2 text-right">
                      <BoutonAction
                        action={actionRetirer}
                        champs={{ id: a.id }}
                        confirmation={`Retirer l’UE ${a.ue.libelle} ?`}
                        className="text-gray-400 hover:text-red-600"
                        titre="Retirer"
                      >
                        <i className="fa-solid fa-trash" aria-hidden />
                        <span className="sr-only">Retirer</span>
                      </BoutonAction>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-400">
                    Aucune UE affectée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {disponibles.length ? (
          <Formulaire action={actionAffecter.bind(null, e.id)} erreurs="premiere" className="flex flex-wrap items-end gap-3 border-t pt-4">
            <label className="flex-1 min-w-[180px] text-xs text-gray-500">
              UE à affecter
              <select name="ue_id" required className="w-full rounded-lg mt-1 text-sm text-gray-900">
                {disponibles.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-32 text-xs text-gray-500">
              Étudiants
              <input type="number" name="nombre_etudiants" min={0} defaultValue={0} required className="w-full rounded-lg mt-1 text-sm text-gray-900" />
            </label>
            <BoutonEnvoi className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Ajouter</BoutonEnvoi>
          </Formulaire>
        ) : (
          <p className="text-sm text-gray-400 border-t pt-4">Toutes les UE sont déjà affectées à cet enseignant.</p>
        )}
      </div>
    </div>
  );
}
