import type { Metadata } from "next";
import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { enseignants } from "@/db/schema";
import { BoutonAction } from "@/components/bouton-action";
import { Flash } from "@/components/flash";
import { LigneCliquable } from "@/components/ligne-cliquable";
import { Pagination, pageDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { actionSupprimerEnseignant } from "./actions";

export const metadata: Metadata = { title: "Enseignants" };

const PAR_PAGE = 10;

export default async function Enseignants({ searchParams }: PageProps<"/enseignants">) {
  await exigerRole(ADMINS);
  const page = pageDepuis((await searchParams).page);
  const db = getDb();
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(enseignants);
  const liste = await db.query.enseignants.findMany({
    orderBy: [asc(enseignants.nom), asc(enseignants.prenom)],
    limit: PAR_PAGE,
    offset: (page - 1) * PAR_PAGE,
    with: { affectations: true },
  });

  return (
    <>
      <Flash />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-insec">Gestion des enseignants</h1>
        <Link href="/enseignants/create" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Nouvel enseignant
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-insec text-white">
              <th className="p-3 text-left">Nom &amp; prénom</th>
              <th className="p-3 text-left">Spécialité</th>
              <th className="p-3 text-left">UE affectées</th>
              <th className="p-3 text-left">Étudiants</th>
              <th className="p-3 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {liste.length ? (
              liste.map((e) => (
                <LigneCliquable key={e.id} href={`/enseignants/${e.id}`} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-gray-900">
                    <Link href={`/enseignants/${e.id}`}>
                      {e.nom} {e.prenom}
                    </Link>
                  </td>
                  <td className="p-3 text-gray-700">{e.specialite}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      {e.affectations.length}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center justify-center px-2 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                      {e.affectations.reduce((s, a) => s + a.nombreEtudiants, 0)}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-3">
                      <Link href={`/enseignants/${e.id}/edit`} className="text-gray-400 hover:text-blue-600" title="Modifier">
                        <i className="fa-solid fa-pen" aria-hidden />
                        <span className="sr-only">Modifier</span>
                      </Link>
                      <BoutonAction
                        action={actionSupprimerEnseignant}
                        champs={{ id: e.id }}
                        confirmation={`Supprimer ${e.nom} ${e.prenom} et ses affectations ?`}
                        className="text-gray-400 hover:text-red-600"
                        titre="Supprimer"
                      >
                        <i className="fa-solid fa-trash" aria-hidden />
                        <span className="sr-only">Supprimer</span>
                      </BoutonAction>
                    </div>
                  </td>
                </LigneCliquable>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  Aucun enseignant trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Pagination page={page} total={total} parPage={PAR_PAGE} chemin="/enseignants" />
      </div>
    </>
  );
}
