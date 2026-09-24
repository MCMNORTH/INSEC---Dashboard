import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, between, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { anneesAcademiques, etudiants, examens, inscriptions, versements } from "@/db/schema";
import { GraphiqueEncaissements, GraphiqueStatuts } from "@/components/graphiques";
import { SelecteurAnnee } from "@/components/selecteur";
import { param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { montantEnRetard, montantNet, pourcentage, resultatValide, soldeRestant, totalVerse } from "@/lib/domain/calculs";
import { MOIS_COURTS, anneeCivile, anneeCourante, formatJourMois, formatHeure, formatMru, formatNombre } from "@/lib/format";
import { ADMINS } from "@/lib/roles";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function TableauDeBord({ searchParams }: PageProps<"/admin/dashboard">) {
  await exigerRole(ADMINS);
  const db = getDb();
  const annees = await db.select().from(anneesAcademiques).orderBy(desc(anneesAcademiques.libelle));
  const demande = param((await searchParams).annee_id);
  const anneeId = demande ? Number(demande) : anneeCourante(annees)?.id;
  if (demande && !annees.some((a) => a.id === anneeId)) notFound();

  const liste = anneeId
    ? await db.query.inscriptions.findMany({
        where: eq(inscriptions.idAnneeAcademique, anneeId),
        with: {
          etudiant: true,
          formation: true,
          versements: true,
          echeances: true,
          resultats: { with: { examen: { with: { ue: true } } } },
        },
      })
    : [];

  const montantFacture = liste.reduce((s, i) => s + montantNet(i), 0);
  const encaisses = liste.reduce((s, i) => s + totalVerse(i), 0);
  const resteARecouvrer = liste.reduce((s, i) => s + soldeRestant(i), 0);
  const enRetard = liste.reduce((s, i) => s + montantEnRetard(i), 0);
  const tauxRecouvrement = pourcentage(encaisses, montantFacture);

  const resultats = liste.flatMap((i) => i.resultats).filter((r) => r.note !== null);
  const valides = resultats.filter((r) => resultatValide(r, r.examen));
  const tauxReussite = pourcentage(valides.length, resultats.length);

  const parDiplome = new Map<string, typeof liste>();
  for (const i of liste) {
    const code = i.formation?.code ?? "—";
    parDiplome.set(code, [...(parDiplome.get(code) ?? []), i]);
  }
  const performanceDiplomes = [...parDiplome.entries()].map(([code, groupe]) => {
    const notes = groupe.flatMap((i) => i.resultats).filter((r) => r.note !== null);
    const ok = notes.filter((r) => resultatValide(r, r.examen)).length;
    return { code, inscrits: new Set(groupe.map((i) => i.idEtudiant)).size, notes: notes.length, valides: ok, taux: pourcentage(ok, notes.length) };
  });

  const parUe = new Map<number, typeof resultats>();
  for (const r of resultats) parUe.set(r.examen.ueId, [...(parUe.get(r.examen.ueId) ?? []), r]);
  const performanceUes = [...parUe.values()]
    .map((notes) => {
      const ue = notes[0].examen.ue;
      const moyenne = Math.round((notes.reduce((s, r) => s + (r.note ?? 0), 0) / notes.length) * 100) / 100;
      return { id: ue.id, code: ue.code, libelle: ue.libelle, moyenne, taux: pourcentage(notes.filter((r) => resultatValide(r, r.examen)).length, notes.length) };
    })
    .sort((a, b) => b.taux - a.taux)
    .slice(0, 8);

  const impayes = liste
    .filter((i) => soldeRestant(i) > 0)
    .sort((a, b) => montantEnRetard(b) - montantEnRetard(a))
    .slice(0, 8);

  const maintenant = new Date();
  const examensProchains = await db.query.examens.findMany({
    where: and(
      anneeId ? eq(examens.anneeAcademiqueId, anneeId) : undefined,
      eq(examens.statut, "Planifié"),
      between(examens.dateExamen, maintenant, new Date(maintenant.getTime() + 30 * 86_400_000)),
    ),
    with: { ue: true },
    orderBy: asc(examens.dateExamen),
    limit: 6,
  });

  const annee = anneeCivile();
  const ids = liste.map((i) => i.id);
  const parMois = ids.length
    ? await db
        .select({
          mois: sql<number>`extract(month from ${versements.dateVersement})::int`,
          total: sql<number>`sum(${versements.montant})::bigint`,
        })
        .from(versements)
        .where(
          and(
            eq(versements.statut, "Validée"),
            inArray(versements.inscriptionId, ids),
            sql`extract(year from ${versements.dateVersement}) = ${annee}`,
          ),
        )
        .groupBy(sql`1`)
    : [];
  const paiements12 = Array.from({ length: 12 }, (_, m) => Number(parMois.find((p) => p.mois === m + 1)?.total ?? 0));

  const repartitionRows = await db
    .select({ statut: etudiants.statutEtudiant, total: sql<number>`count(*)::int` })
    .from(etudiants)
    .groupBy(etudiants.statutEtudiant);
  const repartition = Object.fromEntries(repartitionRows.map((r) => [r.statut, r.total]));
  const [{ actifs }] = await db
    .select({ actifs: sql<number>`count(*)::int` })
    .from(etudiants)
    .where(eq(etudiants.statutEtudiant, "Actif"));
  const inscriptionsActives = liste.filter((i) => i.statut === "active").length;

  const cartes: [string, string, string, string][] = [
    ["Étudiants actifs", formatNombre(actifs), "fa-users", "bg-blue-50"],
    ["Inscriptions actives", formatNombre(inscriptionsActives), "fa-id-card", "bg-indigo-50"],
    ["Encaissé", formatMru(encaisses), "fa-money-bill-wave", "bg-emerald-50"],
    ["À recouvrer", formatMru(resteARecouvrer), "fa-wallet", "bg-amber-50"],
    ["Taux recouvrement", `${tauxRecouvrement} %`, "fa-chart-line", "bg-cyan-50"],
    ["Taux de réussite", `${tauxReussite} %`, "fa-graduation-cap", "bg-purple-50"],
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">Pilotage INSEC</p>
          <h1 className="text-2xl font-bold text-insec">Tableau de bord décisionnel</h1>
        </div>
        <SelecteurAnnee annees={annees} valeur={anneeId} nom="annee_id" libelle="Année" />
      </div>

      <section className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        {cartes.map(([libelle, valeur, icone, fond]) => (
          <article key={libelle} className={`${fond} rounded-xl border border-white p-4 shadow-sm`}>
            <i className={`fa-solid ${icone} text-insec mb-3`} aria-hidden />
            <p className="text-xl font-bold text-insec">{valeur}</p>
            <p className="text-xs text-gray-500 mt-1">{libelle}</p>
          </article>
        ))}
      </section>

      {enRetard > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex flex-wrap gap-2 justify-between">
          <span>
            <i className="fa-solid fa-triangle-exclamation mr-2" aria-hidden />
            <strong>{formatMru(enRetard)}</strong> actuellement en retard.
          </span>
          <Link href="/finances" className="text-sm font-semibold">
            Traiter →
          </Link>
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <article className="xl:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex justify-between mb-4">
            <h2 className="font-bold text-insec">Encaissements mensuels</h2>
            <span className="text-xs text-gray-400">{annee}</span>
          </div>
          <GraphiqueEncaissements libelles={MOIS_COURTS} valeurs={paiements12} />
        </article>
        <article className="bg-white rounded-xl border p-5">
          <h2 className="font-bold text-insec mb-4">Situation des étudiants</h2>
          <GraphiqueStatuts repartition={repartition} />
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <article className="bg-white rounded-xl border overflow-hidden">
          <header className="p-5 border-b">
            <h2 className="font-bold text-insec">Performance par diplôme</h2>
          </header>
          <div className="p-5 space-y-5">
            {performanceDiplomes.length ? (
              performanceDiplomes.map((l) => (
                <div key={l.code}>
                  <div className="flex justify-between text-sm mb-2">
                    <span>
                      <strong>{l.code}</strong> · {l.inscrits} étudiant(s)
                    </span>
                    <span className="font-bold">{l.taux} %</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-insec rounded-full" style={{ width: `${Math.min(l.taux, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {l.valides} UE validée(s) sur {l.notes} résultat(s)
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Aucun résultat publié.</p>
            )}
          </div>
        </article>
        <article className="bg-white rounded-xl border overflow-hidden">
          <header className="p-5 border-b">
            <h2 className="font-bold text-insec">Réussite par UE</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-3">UE</th>
                  <th className="text-right p-3">Moyenne</th>
                  <th className="text-right p-3">Réussite</th>
                </tr>
              </thead>
              <tbody>
                {performanceUes.length ? (
                  performanceUes.map((ue) => (
                    <tr key={ue.id} className="border-t">
                      <td className="p-3">
                        <strong>{ue.code}</strong>
                        <span className="block text-xs text-gray-400 truncate max-w-xs">{ue.libelle}</span>
                      </td>
                      <td className="p-3 text-right">{ue.moyenne}/20</td>
                      <td className={`p-3 text-right font-semibold ${ue.taux >= 50 ? "text-green-600" : "text-red-600"}`}>{ue.taux} %</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      Aucune note disponible.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <article className="xl:col-span-2 bg-white rounded-xl border overflow-hidden">
          <header className="p-5 border-b flex justify-between">
            <h2 className="font-bold text-insec">Dossiers financiers à suivre</h2>
            <Link href="/finances" className="text-sm font-semibold">
              Voir tout
            </Link>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-3">Étudiant</th>
                  <th className="text-left p-3">Diplôme</th>
                  <th className="text-right p-3">Reste</th>
                  <th className="text-right p-3">Retard</th>
                </tr>
              </thead>
              <tbody>
                {impayes.length ? (
                  impayes.map((i) => {
                    const retard = montantEnRetard(i);
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-3 font-medium">
                          <Link href={`/finances?etudiant=${i.idEtudiant}&inscription=${i.id}`} className="hover:underline">
                            {i.etudiant.prenom} {i.etudiant.nom}
                          </Link>
                        </td>
                        <td className="p-3">{i.formation.code}</td>
                        <td className="p-3 text-right">{formatNombre(soldeRestant(i))}</td>
                        <td className={`p-3 text-right font-semibold ${retard > 0 ? "text-red-600" : "text-gray-400"}`}>{formatNombre(retard)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      Aucun solde restant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
        <article className="bg-white rounded-xl border">
          <header className="p-5 border-b">
            <h2 className="font-bold text-insec">Examens dans les 30 jours</h2>
          </header>
          <div className="divide-y">
            {examensProchains.length ? (
              examensProchains.map((e) => (
                <Link key={e.id} href={`/examens/${e.id}`} className="block p-4 hover:bg-gray-50">
                  <div className="flex justify-between">
                    <strong className="text-sm">{e.ue.code}</strong>
                    <span className="text-xs text-gray-400">{formatJourMois(e.dateExamen)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatHeure(e.dateExamen)} · {e.salle || "Salle à définir"}
                  </p>
                </Link>
              ))
            ) : (
              <p className="p-6 text-sm text-center text-gray-400">Aucun examen proche.</p>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
