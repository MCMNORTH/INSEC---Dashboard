import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { formations, ues } from "@/db/schema";
import { exigerRole } from "@/lib/auth/current";
import { formatDate } from "@/lib/format";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Diplômes et UE" };

export default async function Formations() {
  await exigerRole(ADMINS);
  const liste = await getDb().query.formations.findMany({
    where: eq(formations.active, true),
    orderBy: asc(formations.code),
    with: { ues: { orderBy: [asc(ues.anneeParcours), asc(ues.ordre)] } },
  });

  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Référentiel officiel INTEC-CNAM</p>
        <h1 className="mt-1 text-2xl font-bold text-insec">Diplômes et unités d’enseignement</h1>
        <p className="mt-2 text-sm text-gray-500">Catalogue limité aux deux diplômes ouverts par la convention de l’INSEC.</p>
      </div>
      <div className="space-y-6">
        {liste.map((f) => (
          <section key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <header className="flex flex-wrap items-start justify-between gap-4 bg-insec px-6 py-5 text-white">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-black text-insec">{f.code}</span>
                  <h2 className="text-lg font-bold">{f.libelle}</h2>
                </div>
                <p className="mt-2 text-sm text-blue-100">
                  {f.niveauDiplome} · {f.dureeAnnees} ans · {f.creditsTotal} ECTS
                </p>
              </div>
              {f.sourceUrl && (
                <a
                  href={f.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-white/30 px-3 py-2 text-xs font-medium hover:bg-white/10"
                >
                  Source officielle ↗
                </a>
              )}
            </header>
            <div className={`grid gap-5 p-6 ${f.dureeAnnees === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
              {Array.from({ length: f.dureeAnnees }, (_, i) => i + 1).map((annee) => {
                const liste = f.ues.filter((u) => u.anneeParcours === annee);
                return (
                  <div key={annee}>
                    <h3 className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 text-sm font-bold text-insec">
                      <span>
                        {annee}
                        {annee === 1 ? "re" : "e"} année
                      </span>
                      <span className="text-xs font-medium text-gray-400">{liste.reduce((s, u) => s + u.credits, 0)} ECTS</span>
                    </h3>
                    <div className="space-y-2">
                      {liste.map((ue) => (
                        <article key={ue.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-amber-700">{ue.code}</p>
                              <p className="mt-1 text-sm font-medium text-gray-800">{ue.libelle}</p>
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                              {ue.credits} ECTS
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {f.sourceVerifieeLe && (
              <footer className="border-t border-gray-100 px-6 py-3 text-xs text-gray-400">Source vérifiée le {formatDate(f.sourceVerifieeLe)}</footer>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
