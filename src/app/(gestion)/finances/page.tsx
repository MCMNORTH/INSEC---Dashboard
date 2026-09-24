import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { etudiants, inscriptions } from "@/db/schema";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { LigneCliquable } from "@/components/ligne-cliquable";
import { SelectFiltre } from "@/components/selecteur";
import { BadgePaiement, param } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { montantEnRetard, montantNet, soldeRestant, statutPaiement, totalVerse } from "@/lib/domain/calculs";
import { anneeCourante, formatDate, formatMru, formatNombre } from "@/lib/format";
import { anneesRecentes } from "@/lib/requetes";
import { FINANCE } from "@/lib/roles";
import { MODES_PAIEMENT } from "@/lib/validation";
import { actionEcheance, actionSituation, actionVersement } from "./actions";

export const metadata: Metadata = { title: "Finances" };

const champ = "rounded-lg text-gray-900 text-xs";

export default async function Finances({ searchParams }: PageProps<"/finances">) {
  const user = await exigerRole(FINANCE);
  const sp = await searchParams;
  const onglet = param(sp.tab) === "reversement" ? "reversement" : "etudiants";
  const db = getDb();

  const liste = await db.query.etudiants.findMany({
    orderBy: [asc(etudiants.nom), asc(etudiants.prenom)],
    with: { inscriptions: { orderBy: desc(inscriptions.id), limit: 1, with: { versements: true, echeances: true } } },
  });

  const etudiantId = Number(param(sp.etudiant)) || null;
  const selection = etudiantId
    ? await db.query.etudiants.findFirst({
        where: eq(etudiants.id, etudiantId),
        with: {
          inscriptions: {
            orderBy: [desc(inscriptions.createdAt), desc(inscriptions.id)],
            with: { formation: true, annee: true, versements: true, echeances: true },
          },
        },
      })
    : null;
  // L'inscription demandée doit appartenir à l'étudiant sélectionné.
  const inscriptionId = Number(param(sp.inscription)) || null;
  const dossier = selection
    ? (selection.inscriptions.find((i) => i.id === inscriptionId) ?? selection.inscriptions[0] ?? null)
    : null;

  const annees = await anneesRecentes();
  const anneeChoisie = Number(param(sp.annee_reversement)) || anneeCourante(annees)?.id;
  const toutes = await db.query.inscriptions.findMany({ with: { versements: true } });
  const synthese = annees.map((a) => {
    const groupe = toutes.filter((i) => i.idAnneeAcademique === a.id);
    const du = groupe.reduce((s, i) => s + montantNet(i), 0);
    const encaisse = groupe.reduce((s, i) => s + totalVerse(i), 0);
    return {
      ...a,
      nb: groupe.length,
      du,
      encaisse,
      statut: du > 0 && encaisse >= du ? "Soldé" : encaisse > 0 ? "Partiel" : "Impayé",
    };
  });
  const carte = synthese.find((a) => a.id === anneeChoisie);

  const lienOnglet = (o: string) => {
    const q = new URLSearchParams();
    if (selection) q.set("etudiant", String(selection.id));
    if (o === "reversement") q.set("tab", "reversement");
    return `/finances?${q.toString()}`;
  };

  return (
    <>
      <h1 className="text-xl font-bold text-insec mb-4">Finances</h1>
      <Flash />
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["etudiants", "Étudiants"],
          ["reversement", "Synthèse annuelle"],
        ].map(([o, l]) => (
          <Link
            key={o}
            href={lienOnglet(o)}
            aria-current={onglet === o ? "page" : undefined}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${onglet === o ? "bg-insec text-white" : "bg-white text-gray-600 border"}`}
          >
            {l}
          </Link>
        ))}
      </div>

      {onglet === "etudiants" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl shadow overflow-x-auto h-fit">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-insec text-white">
                  <th className="p-3 text-left">Étudiant</th>
                  <th className="p-3 text-left">Restant</th>
                  <th className="p-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {liste.length ? (
                  liste.map((e) => {
                    const i = e.inscriptions[0];
                    return (
                      <LigneCliquable
                        key={e.id}
                        href={`/finances?etudiant=${e.id}`}
                        className={`border-b hover:bg-gray-50 ${selection?.id === e.id ? "bg-blue-50" : ""}`}
                      >
                        <td className="p-3 text-gray-900">
                          <Link href={`/finances?etudiant=${e.id}`}>
                            {e.nom} {e.prenom}
                          </Link>
                        </td>
                        <td className="p-3 text-gray-700">{formatNombre(i ? soldeRestant(i) : 0)}</td>
                        <td className="p-3">
                          <BadgePaiement statut={i ? statutPaiement(i) : "Non inscrit"} />
                        </td>
                      </LigneCliquable>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      Aucun étudiant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="text-xs text-gray-400 p-3">Cliquez sur un étudiant pour ouvrir son dossier.</p>
          </div>

          {selection && (
            <div className="bg-insec text-white rounded-xl shadow p-5 h-fit">
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">
                Dossier — {selection.nom} {selection.prenom}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {selection.inscriptions.map((d) => (
                  <Link
                    key={d.id}
                    href={`/finances?etudiant=${selection.id}&inscription=${d.id}`}
                    className={`text-xs px-2 py-1 rounded ${dossier?.id === d.id ? "bg-amber-500 text-white" : "bg-white/10 text-blue-100"}`}
                  >
                    {d.formation?.code} {d.annee?.libelle}
                  </Link>
                ))}
              </div>

              {dossier ? (
                <>
                  <p className="text-xs text-blue-200 mt-4">Montant brut</p>
                  <p className="text-2xl font-bold">{formatMru(dossier.montantDu)}</p>
                  <p className="text-xs text-blue-200 mt-3">Remise · Montant net</p>
                  <p className="text-sm">
                    <span className="text-amber-300">- {formatNombre(dossier.montantRemise)}</span> ·{" "}
                    <strong>{formatMru(montantNet(dossier))}</strong>
                  </p>
                  <p className="text-xs text-blue-200 mt-4">Total versé</p>
                  <p className="text-lg font-bold text-green-400">{formatMru(totalVerse(dossier))}</p>
                  <p className="text-xs text-blue-200 mt-4">Solde restant (calculé)</p>
                  <p className="text-lg font-bold text-amber-400">{formatMru(soldeRestant(dossier))}</p>
                  {montantEnRetard(dossier) > 0 && (
                    <p className="mt-2 rounded bg-red-500/20 p-2 text-xs text-red-200">En retard : {formatMru(montantEnRetard(dossier))}</p>
                  )}

                  <Formulaire
                    action={actionSituation.bind(null, dossier.id)}
                    erreurs="premiere"
                    className="border-t border-blue-400/30 mt-4 pt-4 space-y-2"
                  >
                    <div className="flex gap-2">
                      <label className="flex-1 text-xs text-blue-200">
                        Montant brut
                        <input type="number" name="montant_du" min={0} defaultValue={dossier.montantDu} required className={`w-full mt-1 ${champ}`} />
                      </label>
                      <label className="flex-1 text-xs text-blue-200">
                        Remise
                        <input type="number" name="montant_remise" min={0} defaultValue={dossier.montantRemise} required className={`w-full mt-1 ${champ}`} />
                      </label>
                    </div>
                    <textarea
                      name="note_financiere"
                      defaultValue={dossier.noteFinanciere ?? ""}
                      placeholder="Note financière interne"
                      aria-label="Note financière interne"
                      className={`w-full ${champ}`}
                    />
                    <BoutonEnvoi className="w-full bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg">Mettre à jour</BoutonEnvoi>
                  </Formulaire>

                  <div className="border-t border-blue-400/30 mt-4 pt-4">
                    <p className="text-xs text-blue-200 mb-2">Échéancier</p>
                    {dossier.echeances.length ? (
                      [...dossier.echeances]
                        .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
                        .map((e) => (
                          <div key={e.id} className="flex justify-between text-xs bg-white/10 rounded px-2 py-1 mb-1">
                            <span>
                              {e.libelle} · {formatDate(e.dateEcheance)}
                            </span>
                            <strong>{formatNombre(e.montant)}</strong>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-blue-200">Aucune échéance.</p>
                    )}
                    <Formulaire action={actionEcheance.bind(null, dossier.id)} erreurs="premiere" className="grid grid-cols-2 gap-2 mt-2">
                      <input name="libelle" placeholder="Ex. 1re tranche" aria-label="Libellé de l’échéance" required className={`rounded ${champ}`} />
                      <input type="number" name="montant" min={1} placeholder="Montant" aria-label="Montant de l’échéance" required className={`rounded ${champ}`} />
                      <input type="date" name="date_echeance" aria-label="Date d’échéance" required className={`rounded ${champ}`} />
                      <BoutonEnvoi className="bg-white/10 rounded text-xs">+ Échéance</BoutonEnvoi>
                    </Formulaire>
                  </div>

                  <div className="border-t border-blue-400/30 mt-4 pt-4">
                    <p className="text-xs text-blue-200 mb-2">Derniers versements</p>
                    <div className="space-y-2 mb-4">
                      {dossier.versements.length ? (
                        [...dossier.versements]
                          .sort((a, b) => b.dateVersement.localeCompare(a.dateVersement) || b.id - a.id)
                          .map((v) => (
                            <div key={v.id}>
                              <div className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2 text-xs">
                                <span>{formatDate(v.dateVersement)}</span>
                                <span>{formatNombre(v.montant)}</span>
                                <span className={v.statut === "Validée" ? "text-green-400" : "text-amber-400"}>{v.statut}</span>
                              </div>
                              <p className="text-[10px] text-blue-200 px-2">
                                {v.numeroRecu ? (
                                  <a href={`/pdf/recus/${v.id}`} className="underline">
                                    {v.numeroRecu}
                                  </a>
                                ) : (
                                  "Sans reçu"
                                )}{" "}
                                · {v.modePaiement}
                                {v.reference ? ` · ${v.reference}` : ""}
                              </p>
                            </div>
                          ))
                      ) : (
                        <p className="text-xs text-blue-200">Aucun versement.</p>
                      )}
                    </div>

                    <Formulaire action={actionVersement.bind(null, dossier.id)} erreurs="premiere" reinitialiser className="space-y-2">
                      <p className="text-xs text-blue-200">Ajouter un versement</p>
                      <div className="flex gap-2">
                        <input type="number" name="montant" min={1} placeholder="Montant" aria-label="Montant du versement" required className={`w-1/2 ${champ}`} />
                        <input type="date" name="date_versement" aria-label="Date du versement" required className={`w-1/2 ${champ}`} />
                      </div>
                      <select name="statut" aria-label="Statut du versement" required className={`w-full ${champ}`}>
                        <option value="Validée">Validée</option>
                        <option value="En attente">En attente</option>
                      </select>
                      <div className="flex gap-2">
                        <select name="mode_paiement" aria-label="Mode de paiement" className={`w-1/2 ${champ}`}>
                          {MODES_PAIEMENT.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                        <input name="reference" placeholder="Référence (facultatif)" aria-label="Référence" className={`w-1/2 ${champ}`} />
                      </div>
                      <textarea name="note" placeholder="Note (facultatif)" aria-label="Note" className={`w-full ${champ}`} />
                      <BoutonEnvoi className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg">
                        + Ajouter le versement
                      </BoutonEnvoi>
                    </Formulaire>
                  </div>
                </>
              ) : (
                <p className="text-sm text-blue-200 mt-4">
                  Cet étudiant n’a pas encore de formation/année assignée.{" "}
                  {user.role !== "finance" && (
                    <Link href={`/etudiants/${selection.id}/inscriptions/create`} className="underline text-amber-400">
                      Créer une inscription
                    </Link>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-gray-600">Année académique :</span>
            <SelectFiltre
              nom="annee_reversement"
              libelle="Année académique"
              valeur={anneeChoisie}
              options={annees.map((a) => ({ valeur: a.id, libelle: a.libelle }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-500">Étudiants concernés</p>
              <p className="text-xl font-bold text-insec">{carte?.nb ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-500">Frais nets facturés</p>
              <p className="text-xl font-bold text-insec">{formatMru(carte?.du ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-500">Encaissé auprès des étudiants</p>
              <p className="text-xl font-bold text-green-600">{formatMru(carte?.encaisse ?? 0)}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-insec text-white">
                  <th className="p-3 text-left">Année académique</th>
                  <th className="p-3 text-left">Étudiants</th>
                  <th className="p-3 text-left">Montant dû</th>
                  <th className="p-3 text-left">Encaissé</th>
                  <th className="p-3 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {synthese.filter((a) => a.nb > 0).length ? (
                  synthese
                    .filter((a) => a.nb > 0)
                    .map((a) => (
                      <tr key={a.id} className="border-b">
                        <td className="p-3">{a.libelle}</td>
                        <td className="p-3">{a.nb}</td>
                        <td className="p-3">{formatNombre(a.du)}</td>
                        <td className="p-3">{formatNombre(a.encaisse)}</td>
                        <td className="p-3">
                          <BadgePaiement statut={a.statut} />
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400">
                      Aucune donnée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
