"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { EtatFormulaire } from "@/lib/actions";
import type { RapportImport } from "@/lib/services/excel";

export function ImportExcel({ action }: { action: (e: EtatFormulaire, fd: FormData) => Promise<EtatFormulaire> }) {
  const [etat, dispatch, enCours] = useActionState(action, { erreurs: [] });
  const rapport = etat.donnees as RapportImport | undefined;

  function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <>
      {etat.erreurs.length > 0 && (
        <div role="alert" className="bg-red-50 text-red-800 rounded-lg p-4 mb-5">
          {etat.erreurs[0]}
        </div>
      )}
      {rapport && (
        <div className="bg-gray-50 border rounded-xl p-5 mb-5" role="status">
          <h3 className="font-bold text-insec">Rapport d’import</h3>
          <div className="grid grid-cols-3 gap-3 my-4 text-center">
            <div className="bg-green-50 p-3 rounded">
              <strong>{rapport.crees}</strong>
              <span className="block text-xs">créés</span>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <strong>{rapport.misAJour}</strong>
              <span className="block text-xs">mis à jour</span>
            </div>
            <div className="bg-white p-3 rounded">
              <strong>{rapport.ignores}</strong>
              <span className="block text-xs">ignorés</span>
            </div>
          </div>
          {rapport.erreurs.length > 0 && (
            <details className="text-sm text-red-700" open>
              <summary className="cursor-pointer font-semibold">{rapport.erreurs.length} ligne(s) en erreur</summary>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {rapport.erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <form onSubmit={soumettre} className="space-y-4">
        <label className="block text-sm">
          Fichier Excel (.xlsx) ou CSV
          <input type="file" name="fichier" accept=".xlsx,.csv" required className="block w-full mt-1 text-sm border rounded-lg p-2" />
        </label>
        <label className="block text-sm">
          Si l’e-mail existe déjà
          <select name="mode" className="w-full mt-1 rounded-lg">
            <option value="ignorer">Ignorer la ligne</option>
            <option value="mettre_a_jour">Mettre à jour l’étudiant</option>
          </select>
        </label>
        <button disabled={enCours} className="w-full bg-insec text-white rounded-lg py-3 font-semibold disabled:opacity-60">
          {enCours ? "Analyse en cours…" : "Analyser et importer"}
        </button>
      </form>
    </>
  );
}
