import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/flash";
import { ProgressionAcademique } from "@/components/progression";
import { Retour, StatutBadge, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { dossierEtudiant } from "@/lib/chargements";
import { montantNet, soldeRestant, totalVerse } from "@/lib/domain/calculs";
import { formatNombre } from "@/lib/format";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Fiche étudiant" };

export default async function FicheEtudiant({ params }: PageProps<"/etudiants/[id]">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const etudiant = id ? await dossierEtudiant(id) : null;
  if (!etudiant) notFound();

  return (
    <>
      <Retour href="/etudiants">Retour à la liste</Retour>
      <Flash className="mt-4" />
      <section className="bg-white rounded-xl shadow p-6 mt-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-insec">
              {etudiant.prenom} {etudiant.nom}
            </h1>
            <StatutBadge statut={etudiant.statutEtudiant} />
            <p className="text-sm text-gray-500 mt-2">
              {etudiant.email} · {etudiant.telephone ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 h-fit">
            <Link href={`/etudiants/${etudiant.id}/documents`} className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg">
              Dossier documentaire
            </Link>
            <Link href={`/etudiants/${etudiant.id}/edit`} className="bg-gray-100 px-4 py-2 rounded-lg">
              Modifier l’identité
            </Link>
            <Link href={`/etudiants/${etudiant.id}/inscriptions/create`} className="bg-amber-500 text-white px-4 py-2 rounded-lg">
              Nouvelle inscription
            </Link>
          </div>
        </div>
      </section>

      <h2 className="text-lg font-bold text-insec mt-8 mb-3">Historique des inscriptions</h2>
      <div className="space-y-4">
        {etudiant.inscriptions.length ? (
          etudiant.inscriptions.map((i) => (
            <article key={i.id} className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-insec">
                    {i.formation?.code} — {i.annee?.libelle}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Année {i.anneeParcours ?? "—"} · {i.statut.charAt(0).toUpperCase() + i.statut.slice(1)} · N° INTEC{" "}
                    {i.numeroInscriptionIntec ?? "—"}
                  </p>
                </div>
                <div className="flex gap-3 text-sm h-fit">
                  <Link href={`/finances?etudiant=${etudiant.id}&inscription=${i.id}`} className="text-blue-700">
                    Finances
                  </Link>
                  <Link href={`/inscriptions/${i.id}/edit`} className="text-blue-700">
                    Modifier
                  </Link>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {i.ues.length ? (
                  i.ues.map((ue) => (
                    <span key={ue.id} className="bg-blue-50 text-blue-800 rounded-full px-3 py-1 text-sm">
                      {ue.code} · {ue.libelle}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-amber-700">Aucune UE renseignée.</span>
                )}
              </div>
              <div className="mt-4 border-t pt-3 text-sm">
                <strong>Finances :</strong> {formatNombre(totalVerse(i))} / {formatNombre(montantNet(i))} MRU · Solde{" "}
                {formatNombre(soldeRestant(i))} MRU
              </div>
            </article>
          ))
        ) : (
          <div className="bg-white rounded-xl p-6 text-gray-500">Aucune inscription.</div>
        )}
      </div>
      <ProgressionAcademique inscriptions={etudiant.inscriptions} />
    </>
  );
}
