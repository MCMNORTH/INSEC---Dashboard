import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { examens, resultatsExamens } from "@/db/schema";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { resultatValide } from "@/lib/domain/calculs";
import { formatDateHeure, formatNote } from "@/lib/format";
import { ADMINS } from "@/lib/roles";
import { PRESENCES } from "@/lib/validation";
import { actionResultat } from "../actions";

export const metadata: Metadata = { title: "Examen" };

export default async function Examen({ params }: PageProps<"/examens/[id]">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const e = id
    ? await getDb().query.examens.findFirst({
        where: eq(examens.id, id),
        with: {
          ue: { with: { formation: true } },
          annee: true,
          resultats: { orderBy: asc(resultatsExamens.id), with: { inscription: { with: { etudiant: true } } } },
        },
      })
    : undefined;
  if (!e) notFound();
  const resultats = [...e.resultats].sort((a, b) =>
    `${a.inscription.etudiant.nom} ${a.inscription.etudiant.prenom}`.localeCompare(`${b.inscription.etudiant.nom} ${b.inscription.etudiant.prenom}`, "fr"),
  );

  return (
    <>
      <Retour href="/examens">Retour</Retour>
      <Flash className="mt-3" />
      <section className="bg-white rounded-xl shadow p-5 mt-4">
        <p className="text-sm text-amber-600 font-semibold">
          {e.ue.formation?.code} · {e.annee.libelle}
        </p>
        <h1 className="text-xl font-bold text-insec">
          {e.ue.code} — {e.ue.libelle}
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
          <div>
            <span className="text-gray-500">Date</span>
            <br />
            <strong>{formatDateHeure(e.dateExamen)}</strong>
          </div>
          <div>
            <span className="text-gray-500">Session</span>
            <br />
            <strong>{e.session}</strong>
          </div>
          <div>
            <span className="text-gray-500">Salle</span>
            <br />
            <strong>{e.salle ?? "—"}</strong>
          </div>
          <div>
            <span className="text-gray-500">Validation</span>
            <br />
            <strong>
              {formatNote(e.seuilValidation)}/{formatNote(e.noteSur)}
            </strong>
          </div>
          <div>
            <span className="text-gray-500">Statut</span>
            <br />
            <strong>{e.statut}</strong>
          </div>
        </div>
      </section>

      <h2 className="font-bold text-insec mt-7 mb-3">Convocations et résultats ({resultats.length})</h2>
      <div className="space-y-3">
        {resultats.length ? (
          resultats.map((r) => (
            <Formulaire
              key={r.id}
              action={actionResultat.bind(null, e.id, r.id)}
              erreurs="premiere"
              className="bg-white rounded-xl shadow p-4 grid md:grid-cols-6 items-end gap-3"
            >
              <div className="md:col-span-2">
                <p className="font-semibold">
                  {r.inscription.etudiant.prenom} {r.inscription.etudiant.nom}
                </p>
                <p className="text-xs text-gray-500">
                  N° INTEC {r.inscription.numeroInscriptionIntec ?? "—"} ·{" "}
                  <a href={`/pdf/convocations/${e.id}/${r.id}`} className="text-blue-700">
                    Convocation PDF
                  </a>
                </p>
              </div>
              <label className="text-xs text-gray-500">
                Présence
                <select name="presence" defaultValue={r.presence} className="w-full rounded text-sm text-gray-900">
                  {PRESENCES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Note / {formatNote(e.noteSur)}
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={e.noteSur}
                  name="note"
                  defaultValue={r.note ?? ""}
                  className="w-full rounded text-sm text-gray-900"
                />
              </label>
              <label className="text-xs text-gray-500">
                Commentaire
                <input name="commentaire" defaultValue={r.commentaire ?? ""} className="w-full rounded text-sm text-gray-900" />
              </label>
              <BoutonEnvoi className="bg-insec text-white rounded px-3 py-2 text-sm">Enregistrer</BoutonEnvoi>
              {r.presence === "Présent" && r.note !== null && (
                <p className={`md:col-span-6 text-xs ${resultatValide(r, e) ? "text-green-700" : "text-red-700"}`}>
                  {resultatValide(r, e) ? "UE validée" : "UE non validée"}
                </p>
              )}
            </Formulaire>
          ))
        ) : (
          <div className="bg-white p-6 rounded-xl text-gray-500">Aucun étudiant inscrit à cette UE pour cette année.</div>
        )}
      </div>
    </>
  );
}
