import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { examens, resultatsExamens } from "@/db/schema";
import { Flash } from "@/components/flash";
import { LigneCliquable } from "@/components/ligne-cliquable";
import { SelectFiltre } from "@/components/selecteur";
import { Pagination, pageDepuis, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { formatDateHeure } from "@/lib/format";
import { anneesRecentes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Examens" };

const PAR_PAGE = 15;

export default async function Examens({ searchParams }: PageProps<"/examens">) {
  await exigerRole(ADMINS);
  const sp = await searchParams;
  const anneeId = Number(param(sp.annee_id)) || undefined;
  const page = pageDepuis(sp.page);
  const db = getDb();
  const filtre = anneeId ? eq(examens.anneeAcademiqueId, anneeId) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(examens).where(filtre);
  const liste = await db.query.examens.findMany({
    where: filtre,
    orderBy: [desc(examens.dateExamen), desc(examens.id)],
    limit: PAR_PAGE,
    offset: (page - 1) * PAR_PAGE,
    with: { ue: { with: { formation: true } }, annee: true },
  });
  const ids = liste.map((e) => e.id);
  const convoques = ids.length
    ? await db
        .select({ examenId: resultatsExamens.examenId, n: count() })
        .from(resultatsExamens)
        .where(inArray(resultatsExamens.examenId, ids))
        .groupBy(resultatsExamens.examenId)
    : [];
  const annees = await anneesRecentes();

  return (
    <>
      <div className="flex flex-wrap justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-insec">Examens & résultats</h1>
          <p className="text-sm text-gray-500">Planification, convocations et validation des UE</p>
        </div>
        <Link href="/examens/create" className="bg-amber-500 text-white px-4 py-2 rounded-lg h-fit">
          + Planifier un examen
        </Link>
      </div>
      <Flash />
      <div className="bg-white p-3 rounded-xl shadow mb-4">
        <SelectFiltre
          nom="annee_id"
          libelle="Année académique"
          valeur={anneeId}
          vide="Toutes les années"
          options={annees.map((a) => ({ valeur: a.id, libelle: a.libelle }))}
        />
      </div>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-insec text-white">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Diplôme / UE</th>
              <th className="p-3 text-left">Session</th>
              <th className="p-3 text-left">Salle</th>
              <th className="p-3 text-left">Convoqués</th>
              <th className="p-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.length ? (
              liste.map((e) => (
                <LigneCliquable key={e.id} href={`/examens/${e.id}`} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <Link href={`/examens/${e.id}`}>{formatDateHeure(e.dateExamen)}</Link>
                  </td>
                  <td className="p-3">
                    <strong>
                      {e.ue.formation?.code} · {e.ue.code}
                    </strong>
                    <br />
                    <span className="text-gray-500">{e.ue.libelle}</span>
                  </td>
                  <td className="p-3">
                    {e.session}
                    <br />
                    <span className="text-xs text-gray-500">{e.annee.libelle}</span>
                  </td>
                  <td className="p-3">{e.salle ?? "—"}</td>
                  <td className="p-3">{convoques.find((c) => c.examenId === e.id)?.n ?? 0}</td>
                  <td className="p-3">{e.statut}</td>
                </LigneCliquable>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  Aucun examen planifié.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Pagination page={page} total={total} parPage={PAR_PAGE} chemin="/examens" params={{ annee_id: param(sp.annee_id) }} />
      </div>
    </>
  );
}
