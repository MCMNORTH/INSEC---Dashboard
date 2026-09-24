import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { enseignants, examens, resultatsExamens } from "@/db/schema";
import { CoquePortail } from "@/components/coques";
import { exigerRole } from "@/lib/auth/current";
import { formatDateHeure } from "@/lib/format";

export const metadata: Metadata = { title: "Espace enseignant" };

export default async function PortailEnseignant() {
  const user = await exigerRole(["enseignant"]);
  const db = getDb();
  const enseignant = user.enseignantId
    ? await db.query.enseignants.findFirst({
        where: eq(enseignants.id, user.enseignantId),
        with: { affectations: { with: { ue: { with: { formation: true } } } } },
      })
    : undefined;
  if (!enseignant) forbidden();

  const ueIds = enseignant.affectations.map((a) => a.ueId);
  const liste = ueIds.length
    ? await db.query.examens.findMany({
        where: inArray(examens.ueId, ueIds),
        orderBy: desc(examens.dateExamen),
        with: { ue: true, annee: true },
      })
    : [];
  const effectifs = liste.length
    ? await db
        .select({ examenId: resultatsExamens.examenId, n: count() })
        .from(resultatsExamens)
        .where(inArray(resultatsExamens.examenId, liste.map((e) => e.id)))
        .groupBy(resultatsExamens.examenId)
    : [];

  return (
    <CoquePortail user={user} espace="Espace enseignant">
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-insec">
          Bonjour {enseignant.prenom} {enseignant.nom}
        </h1>
        <p className="text-gray-500 mb-6">{enseignant.specialite}</p>
        <h2 className="font-bold text-insec mb-3">Mes UE</h2>
        <div className="grid md:grid-cols-3 gap-4 mb-7">
          {enseignant.affectations.length ? (
            enseignant.affectations.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow p-4">
                <strong>{a.ue.code}</strong>
                <p>{a.ue.libelle}</p>
                <p className="text-xs text-gray-500">
                  {a.ue.formation?.code} · {a.nombreEtudiants} étudiants
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">Aucune UE affectée.</p>
          )}
        </div>
        <h2 className="font-bold text-insec mb-3">Examens de mes UE</h2>
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-insec text-white">
              <tr>
                <th className="p-3 text-left">UE</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Session</th>
                <th className="p-3 text-left">Étudiants</th>
              </tr>
            </thead>
            <tbody>
              {liste.length ? (
                liste.map((e) => (
                  <tr key={e.id} className="border-b">
                    <td className="p-3">
                      {e.ue.code} · {e.ue.libelle}
                    </td>
                    <td className="p-3">{formatDateHeure(e.dateExamen)}</td>
                    <td className="p-3">{e.session}</td>
                    <td className="p-3">{effectifs.find((x) => x.examenId === e.id)?.n ?? 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    Aucun examen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </CoquePortail>
  );
}
