import type { Metadata } from "next";
import { ImportExcel } from "@/components/import-excel";
import { EnTete } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { actionImporter } from "./actions";

export const metadata: Metadata = { title: "Imports et exports" };

const EXPORTS: [string, string, string][] = [
  ["/excel/etudiants", "Étudiants et inscriptions", "Identité, diplôme, année et statut"],
  ["/excel/finances", "Situation financière", "Montants dus, versés, soldes et retards"],
  ["/excel/resultats", "Résultats académiques", "UE, notes, présences et décisions"],
];

export default async function Excel() {
  await exigerRole(ADMINS);
  return (
    <>
      <EnTete surtitre="Données" titre="Imports et exports Excel" description="Échangez les données sans modifier leur structure dans la base." />
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border rounded-xl p-6">
          <div className="w-11 h-11 bg-green-50 text-green-700 rounded-lg flex items-center justify-center mb-4">
            <i className="fa-solid fa-file-arrow-up" aria-hidden />
          </div>
          <h2 className="font-bold text-insec text-lg">Importer des étudiants</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Utilisez exclusivement le modèle INSEC. Chaque ligne invalide est signalée sans bloquer les autres.
          </p>
          <a href="/excel/modele" className="inline-block text-sm font-semibold text-insec mb-5">
            <i className="fa-solid fa-download mr-1" aria-hidden />
            Télécharger le modèle
          </a>
          <ImportExcel action={actionImporter} />
        </section>
        <section className="bg-white border rounded-xl p-6 h-fit">
          <div className="w-11 h-11 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center mb-4">
            <i className="fa-solid fa-file-arrow-down" aria-hidden />
          </div>
          <h2 className="font-bold text-insec text-lg">Exporter les données</h2>
          <p className="text-sm text-gray-500 mt-1 mb-5">Les exports utilisent les données actuelles et des colonnes filtrables.</p>
          <div className="space-y-3">
            {EXPORTS.map(([href, titre, texte]) => (
              <a key={href} href={href} className="flex items-center justify-between border rounded-lg p-4 hover:border-or">
                <span>
                  <strong className="block text-sm">{titre}</strong>
                  <span className="text-xs text-gray-400">{texte}</span>
                </span>
                <i className="fa-solid fa-download text-insec" aria-hidden />
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
