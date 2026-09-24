import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { CoquePortail } from "@/components/coques";
import { exigerRole } from "@/lib/auth/current";
import { dossierEtudiant, examensAVenir } from "@/lib/chargements";
import { creditsValides, montantEnRetard, montantNet, soldeRestant, totalVerse } from "@/lib/domain/calculs";
import { formatDate, formatDateHeure, formatMru, formatNote } from "@/lib/format";

export const metadata: Metadata = { title: "Espace étudiant" };

export default async function PortailEtudiant() {
  const user = await exigerRole(["etudiant"]);
  // Aucun dossier rattaché : accès refusé (comme l'ancienne application).
  const etudiant = user.etudiantId ? await dossierEtudiant(user.etudiantId) : null;
  if (!etudiant) forbidden();

  const resultats = etudiant.inscriptions.flatMap((i) => i.resultats);
  const aVenir = examensAVenir(resultats);
  const notes = resultats
    .filter((r) => r.note !== null)
    .sort((a, b) => b.examen.dateExamen.getTime() - a.examen.dateExamen.getTime());

  return (
    <CoquePortail user={user} espace="Espace étudiant">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-insec">Bonjour {etudiant.prenom}</h1>
        <p className="text-gray-500 mb-6">Votre parcours INSEC / INTEC-CNAM</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Statut</p>
            <strong>{etudiant.statutEtudiant}</strong>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Inscriptions</p>
            <strong>{etudiant.inscriptions.length}</strong>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-xs text-gray-500">Examens à venir</p>
            <strong>{aVenir.length}</strong>
          </div>
        </div>

        <h2 className="font-bold text-insec mb-3">Mes inscriptions</h2>
        <div className="space-y-4">
          {etudiant.inscriptions.map((i) => {
            const retard = montantEnRetard(i);
            return (
              <section key={i.id} className="bg-white rounded-xl shadow p-5">
                <div className="flex flex-wrap gap-2 justify-between">
                  <div>
                    <strong>
                      {i.formation?.code} · {i.annee?.libelle}
                    </strong>
                    <p className="text-sm text-gray-500">
                      Année {i.anneeParcours ?? "—"} · N° INTEC {i.numeroInscriptionIntec ?? "—"}
                    </p>
                  </div>
                  <span className="text-sm">
                    {creditsValides(i.resultats)}/{i.ues.reduce((s, u) => s + u.credits, 0)} ECTS
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {i.ues.map((ue) => (
                    <span key={ue.id} className="bg-blue-50 text-blue-800 px-2 py-1 rounded text-xs" title={ue.libelle}>
                      {ue.code}
                    </span>
                  ))}
                </div>
                <div className="border-t mt-4 pt-3 grid md:grid-cols-3 gap-2 text-sm">
                  <div>
                    Montant net : <strong>{formatMru(montantNet(i))}</strong>
                  </div>
                  <div>
                    Payé : <strong>{formatMru(totalVerse(i))}</strong>
                  </div>
                  <div>
                    Solde :{" "}
                    <strong className={soldeRestant(i) > 0 ? "text-red-600" : "text-green-600"}>{formatMru(soldeRestant(i))}</strong>
                  </div>
                </div>
                {retard > 0 && <p className="mt-3 text-sm bg-red-50 text-red-700 rounded p-2">Montant en retard : {formatMru(retard)}</p>}
                {i.echeances.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-insec font-semibold">Échéancier</summary>
                    <ul className="mt-2 space-y-1">
                      {[...i.echeances]
                        .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
                        .map((e) => (
                          <li key={e.id} className="flex justify-between bg-gray-50 rounded px-3 py-1">
                            <span>
                              {e.libelle} · {formatDate(e.dateEcheance)}
                            </span>
                            <strong>{formatMru(e.montant)}</strong>
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}
        </div>

        <h2 className="font-bold text-insec mt-7 mb-3">Mes prochains examens</h2>
        <div className="bg-white rounded-xl shadow divide-y">
          {aVenir.length ? (
            aVenir.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap gap-2 justify-between">
                <div>
                  <strong>
                    {r.examen.ue.code} — {r.examen.ue.libelle}
                  </strong>
                  <p className="text-sm text-gray-500">
                    {r.examen.session} · {r.examen.salle ?? "Lieu à confirmer"}
                  </p>
                </div>
                <strong>{formatDateHeure(r.examen.dateExamen)}</strong>
              </div>
            ))
          ) : (
            <p className="p-5 text-gray-500">Aucun examen à venir.</p>
          )}
        </div>

        {notes.length > 0 && (
          <>
            <h2 className="font-bold text-insec mt-7 mb-3">Mes résultats</h2>
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-insec text-white">
                  <tr>
                    <th className="p-3 text-left">UE</th>
                    <th className="p-3 text-left">Session</th>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">
                        {r.examen.ue.code} · {r.examen.ue.libelle}
                      </td>
                      <td className="p-3">{r.examen.session}</td>
                      <td className="p-3">{formatDate(r.examen.dateExamen)}</td>
                      <td className="p-3 font-semibold">
                        {formatNote(r.note)}/{formatNote(r.examen.noteSur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </CoquePortail>
  );
}
