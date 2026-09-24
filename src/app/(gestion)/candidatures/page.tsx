import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { candidatures } from "@/db/schema";
import { SelectFiltre } from "@/components/selecteur";
import { EnTete, Pagination, pageDepuis, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS } from "@/lib/roles";
import { STATUTS_CANDIDATURE } from "@/lib/validation";

export const metadata: Metadata = { title: "Candidatures" };

const PAR_PAGE = 20;

export default async function Candidatures({ searchParams }: PageProps<"/candidatures">) {
  await exigerRole(ADMINS);
  const sp = await searchParams;
  const statut = param(sp.statut);
  const page = pageDepuis(sp.page);
  const db = getDb();
  const filtre = statut ? eq(candidatures.statut, statut) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(candidatures).where(filtre);
  const liste = await db.query.candidatures.findMany({
    where: filtre,
    orderBy: [desc(candidatures.createdAt), desc(candidatures.id)],
    limit: PAR_PAGE,
    offset: (page - 1) * PAR_PAGE,
    with: { formation: true, annee: true },
  });

  return (
    <>
      <EnTete surtitre="Admissions" titre="Candidatures">
        <a href="/admission" target="_blank" rel="noopener" className="bg-insec text-white px-4 py-2 rounded-lg text-sm">
          Ouvrir le formulaire public
        </a>
      </EnTete>
      <div className="mb-4">
        <SelectFiltre
          nom="statut"
          libelle="Statut"
          valeur={statut}
          vide="Tous les statuts"
          options={STATUTS_CANDIDATURE.map((s) => ({ valeur: s, libelle: s }))}
        />
      </div>
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-4">Référence / candidat</th>
              <th className="text-left p-4">Diplôme</th>
              <th className="text-left p-4">Année</th>
              <th className="text-left p-4">Statut</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {liste.length ? (
              liste.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-4">
                    <strong>
                      {c.prenom} {c.nom}
                    </strong>
                    <span className="block text-xs text-gray-400">
                      {c.reference} · {c.email}
                    </span>
                  </td>
                  <td className="p-4 font-semibold">{c.formation.code}</td>
                  <td className="p-4">{c.annee.libelle}</td>
                  <td className="p-4">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">{c.statut}</span>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/candidatures/${c.id}`} className="font-semibold text-insec">
                      Examiner →
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-10 text-center text-gray-400">
                  Aucune candidature.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <Pagination page={page} total={total} parPage={PAR_PAGE} chemin="/candidatures" params={{ statut }} />
      </div>
    </>
  );
}
