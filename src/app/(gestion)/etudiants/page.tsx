import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { etudiants, formations, inscriptions } from "@/db/schema";
import { BoutonAction } from "@/components/bouton-action";
import { Flash } from "@/components/flash";
import { LigneCliquable } from "@/components/ligne-cliquable";
import { Pagination, StatutBadge, pageDepuis, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { anneesRecentes } from "@/lib/requetes";
import { ADMINS } from "@/lib/roles";
import { actionSupprimerEtudiant } from "./actions";

export const metadata: Metadata = { title: "Étudiants" };

const PAR_PAGE = 10;

export default async function ListeEtudiants({ searchParams }: PageProps<"/etudiants">) {
  await exigerRole(ADMINS);
  const sp = await searchParams;
  const recherche = param(sp.search)?.trim();
  const formationId = Number(param(sp.formation_id)) || undefined;
  const anneeId = Number(param(sp.annee_id)) || undefined;
  const page = pageDepuis(sp.page);
  const db = getDb();

  const motif = recherche ? `%${recherche.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const filtre = and(
    motif ? or(ilike(etudiants.nom, motif), ilike(etudiants.prenom, motif), ilike(etudiants.email, motif)) : undefined,
    formationId || anneeId
      ? exists(
          db
            .select({ x: sql`1` })
            .from(inscriptions)
            .where(
              and(
                eq(inscriptions.idEtudiant, etudiants.id),
                formationId ? eq(inscriptions.idFormation, formationId) : undefined,
                anneeId ? eq(inscriptions.idAnneeAcademique, anneeId) : undefined,
              ),
            ),
        )
      : undefined,
  );

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(etudiants).where(filtre);
  const liste = await db.query.etudiants.findMany({
    where: filtre,
    orderBy: [asc(etudiants.nom), asc(etudiants.prenom)],
    limit: PAR_PAGE,
    offset: (page - 1) * PAR_PAGE,
    with: { inscriptions: { orderBy: desc(inscriptions.id), limit: 1, with: { formation: true, annee: true } } },
  });
  const listeFormations = await db.select().from(formations).where(eq(formations.active, true)).orderBy(asc(formations.nom));
  const annees = await anneesRecentes();

  return (
    <>
      <Flash />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-bold text-insec">Gestion des étudiants</h1>
        <Link href="/etudiants/create" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm">
          + Nouvel étudiant
        </Link>
      </div>

      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          name="search"
          defaultValue={recherche}
          placeholder="Rechercher un étudiant..."
          aria-label="Rechercher un étudiant"
          className="flex-1 min-w-48 rounded-lg text-sm"
        />
        <select name="formation_id" defaultValue={formationId ?? ""} aria-label="Formation" className="rounded-lg text-sm text-gray-600">
          <option value="">Formation</option>
          {listeFormations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </select>
        <select name="annee_id" defaultValue={anneeId ?? ""} aria-label="Année" className="rounded-lg text-sm text-gray-600">
          <option value="">Année</option>
          {annees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.libelle}
            </option>
          ))}
        </select>
        <button type="submit" className="bg-insec text-white text-sm px-4 py-2 rounded-lg font-medium">
          Filtrer
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-insec text-white text-sm">
              <th className="p-3">Nom & prénom</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Formation</th>
              <th className="p-3">Année</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {liste.length ? (
              liste.map((e) => {
                const derniere = e.inscriptions[0];
                return (
                  <LigneCliquable key={e.id} href={`/etudiants/${e.id}`} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-medium text-gray-800">
                      <Link href={`/etudiants/${e.id}`}>
                        {e.nom} {e.prenom}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-600">{e.email}</td>
                    <td className="p-3 text-gray-600">{derniere?.formation?.nom ?? "-"}</td>
                    <td className="p-3 text-gray-600">{derniere?.annee?.libelle ?? "-"}</td>
                    <td className="p-3">
                      <StatutBadge statut={e.statutEtudiant} />
                    </td>
                    <td className="p-3 text-right whitespace-nowrap" data-no-row-click>
                      <div className="inline-flex gap-3">
                        <Link href={`/etudiants/${e.id}/edit`} className="text-gray-400 hover:text-blue-600" title="Modifier">
                          <i className="fa-solid fa-pen" aria-hidden />
                          <span className="sr-only">Modifier</span>
                        </Link>
                        <BoutonAction
                          action={actionSupprimerEtudiant}
                          champs={{ id: e.id }}
                          confirmation={`Supprimer définitivement ${e.nom} ${e.prenom} ?`}
                          className="text-gray-400 hover:text-red-600"
                          titre="Supprimer"
                        >
                          <i className="fa-solid fa-trash" aria-hidden />
                          <span className="sr-only">Supprimer</span>
                        </BoutonAction>
                      </div>
                    </td>
                  </LigneCliquable>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400">
                  Aucun étudiant trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Pagination
          page={page}
          total={total}
          parPage={PAR_PAGE}
          chemin="/etudiants"
          params={{ search: recherche, formation_id: param(sp.formation_id), annee_id: param(sp.annee_id) }}
        />
      </div>
    </>
  );
}
