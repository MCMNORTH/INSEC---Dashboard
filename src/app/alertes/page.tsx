import type { Metadata } from "next";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { alertes } from "@/db/schema";
import { BoutonAction } from "@/components/bouton-action";
import { CoqueGestion, CoquePortail } from "@/components/coques";
import { Flash } from "@/components/flash";
import { Pagination, pageDepuis } from "@/components/ui";
import { exigerConnexion } from "@/lib/auth/current";
import { depuis } from "@/lib/format";
import { isStaff } from "@/lib/roles";
import { synchroniserAlertes } from "@/lib/services/alertes";
import { actionArchiver, actionLire, actionToutLire } from "./actions";

export const metadata: Metadata = { title: "Alertes" };

const PAR_PAGE = 20;
const STYLES: Record<string, [string, string, string]> = {
  danger: ["bg-red-50", "text-red-700", "fa-circle-exclamation"],
  warning: ["bg-amber-50", "text-amber-700", "fa-triangle-exclamation"],
  success: ["bg-green-50", "text-green-700", "fa-circle-check"],
  info: ["bg-blue-50", "text-blue-700", "fa-circle-info"],
};

export default async function Alertes({ searchParams }: PageProps<"/alertes">) {
  const user = await exigerConnexion();
  const db = getDb();
  await synchroniserAlertes(db, user);
  const page = pageDepuis((await searchParams).page);
  const filtre = and(eq(alertes.userId, user.id), eq(alertes.active, true), isNull(alertes.archiveeAt));
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(alertes).where(filtre);
  const liste = await db
    .select()
    .from(alertes)
    .where(filtre)
    .orderBy(desc(alertes.createdAt), desc(alertes.id))
    .limit(PAR_PAGE)
    .offset((page - 1) * PAR_PAGE);

  const contenu = (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold text-insec">Centre d’alertes</h1>
          <p className="text-sm text-gray-500 mt-1">Échéances, examens, documents et résultats importants.</p>
        </div>
        <BoutonAction action={actionToutLire} className="border border-gray-300 bg-white px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          <i className="fa-solid fa-check-double mr-2" aria-hidden />
          Tout marquer comme lu
        </BoutonAction>
      </div>
      <Flash className="mb-5" />
      <div className="space-y-3">
        {liste.length ? (
          liste.map((a) => {
            const [fond, texte, icone] = STYLES[a.niveau] ?? ["bg-gray-50", "text-gray-700", "fa-bell"];
            return (
              <article key={a.id} className={`bg-white border ${a.lueAt ? "border-gray-200 opacity-75" : "border-or"} rounded-xl p-5 flex gap-4`}>
                <div className={`w-11 h-11 shrink-0 rounded-full ${fond} ${texte} flex items-center justify-center`}>
                  <i className={`fa-solid ${icone}`} aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-3">
                    <h2 className="font-semibold text-insec">{a.titre}</h2>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{depuis(a.updatedAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{a.message}</p>
                  <div className="flex gap-4 mt-3">
                    <BoutonAction action={actionLire} champs={{ id: a.id }} className="text-sm font-semibold text-insec">
                      {a.lien ? "Consulter" : "Marquer comme lue"} <i className="fa-solid fa-arrow-right ml-1" aria-hidden />
                    </BoutonAction>
                    <BoutonAction action={actionArchiver} champs={{ id: a.id }} className="text-sm text-gray-400 hover:text-gray-700">
                      Archiver
                    </BoutonAction>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <i className="fa-regular fa-bell text-4xl text-gray-300" aria-hidden />
            <p className="font-semibold mt-4">Aucune alerte active</p>
            <p className="text-sm text-gray-500 mt-1">Tout est à jour pour le moment.</p>
          </div>
        )}
      </div>
      <div className="mt-6">
        <Pagination page={page} total={total} parPage={PAR_PAGE} chemin="/alertes" />
      </div>
    </div>
  );

  if (isStaff(user.role)) return <CoqueGestion user={user}>{contenu}</CoqueGestion>;
  return (
    <CoquePortail user={user} espace={user.role === "etudiant" ? "Espace étudiant" : "Espace enseignant"}>
      <main className="p-4 sm:p-6 lg:p-10">{contenu}</main>
    </CoquePortail>
  );
}
