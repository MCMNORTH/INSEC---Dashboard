import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { piecesAdministratives } from "@/db/schema";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { dossierEtudiant } from "@/lib/chargements";
import { formatNombre } from "@/lib/format";
import { ADMINS } from "@/lib/roles";
import { STATUTS_PIECE, TYPES_PIECE } from "@/lib/validation";
import { actionDeposerPiece, actionModifierPiece } from "./actions";

export const metadata: Metadata = { title: "Dossier documentaire" };

const BADGE: Record<string, string> = {
  "À vérifier": "bg-amber-100 text-amber-700",
  Validé: "bg-green-100 text-green-700",
  Rejeté: "bg-red-100 text-red-700",
};

export default async function Documents({ params }: PageProps<"/etudiants/[id]/documents">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const etudiant = id ? await dossierEtudiant(id) : null;
  if (!etudiant) notFound();
  const pieces = await getDb()
    .select()
    .from(piecesAdministratives)
    .where(eq(piecesAdministratives.etudiantId, etudiant.id))
    .orderBy(desc(piecesAdministratives.createdAt), desc(piecesAdministratives.id));

  return (
    <>
      <Retour href={`/etudiants/${etudiant.id}`}>Retour à la fiche</Retour>
      <h1 className="text-xl font-bold text-insec mt-2">Dossier documentaire</h1>
      <p className="text-gray-600 mb-5">
        {etudiant.prenom} {etudiant.nom}
      </p>
      <Flash />
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white rounded-xl shadow p-5">
          <h2 className="font-bold text-insec mb-3">Pièces administratives</h2>
          <div className="space-y-3">
            {pieces.length ? (
              pieces.map((p) => (
                <div key={p.id} className="border rounded-lg p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <strong>{p.type}</strong>{" "}
                      <span className={`ml-2 text-xs rounded-full px-2 py-0.5 ${BADGE[p.statut] ?? "bg-gray-100"}`}>{p.statut}</span>
                      <p className="text-xs text-gray-500">
                        {p.nomOriginal} · {formatNombre(p.taille / 1024)} Ko
                        {p.dateExpiration ? ` · expire le ${p.dateExpiration.split("-").reverse().join("/")}` : ""}
                      </p>
                    </div>
                    <a href={`/documents/${p.id}/telecharger`} className="text-blue-700 text-sm h-fit">
                      Télécharger
                    </a>
                  </div>
                  <Formulaire action={actionModifierPiece.bind(null, p.id)} className="flex flex-wrap gap-2 mt-3">
                    <select name="statut" defaultValue={p.statut} aria-label="Statut" className="rounded text-sm">
                      {STATUTS_PIECE.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input name="note" defaultValue={p.note ?? ""} placeholder="Note" aria-label="Note" className="flex-1 min-w-40 rounded text-sm" />
                    <BoutonEnvoi className="bg-gray-100 px-3 rounded text-sm">Mettre à jour</BoutonEnvoi>
                  </Formulaire>
                </div>
              ))
            ) : (
              <p className="text-gray-500">Aucune pièce déposée.</p>
            )}
          </div>
        </section>
        <aside className="bg-white rounded-xl shadow p-5 h-fit">
          <h2 className="font-bold text-insec mb-3">Ajouter une pièce</h2>
          <Formulaire action={actionDeposerPiece.bind(null, etudiant.id)} erreurs="premiere" reinitialiser className="space-y-3">
            <select name="type" aria-label="Type de pièce" className="w-full rounded">
              {TYPES_PIECE.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input type="file" name="fichier" accept=".pdf,.jpg,.jpeg,.png" required aria-label="Fichier" className="w-full text-sm" />
            <p className="text-xs text-gray-400">PDF, JPG ou PNG — 4 Mo maximum.</p>
            <label className="block text-xs text-gray-500">
              Date d’expiration (facultatif)
              <input type="date" name="date_expiration" className="w-full rounded mt-1" />
            </label>
            <textarea name="note" placeholder="Note interne" aria-label="Note interne" className="w-full rounded" />
            <BoutonEnvoi className="w-full bg-amber-500 text-white p-2 rounded">Ajouter</BoutonEnvoi>
          </Formulaire>
        </aside>
      </div>

      <h2 className="font-bold text-insec mt-7 mb-3">Documents générés</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {etudiant.inscriptions.map((i) => (
          <div key={i.id} className="bg-white rounded-xl shadow p-4">
            <strong>
              {i.formation?.code} · {i.annee?.libelle}
            </strong>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={`/pdf/attestations/${i.id}`} className="bg-blue-50 text-blue-800 px-3 py-2 rounded text-sm">
                Attestation d’inscription
              </a>
              <a href={`/pdf/releves/${i.id}`} className="bg-green-50 text-green-800 px-3 py-2 rounded text-sm">
                Relevé de notes
              </a>
              {i.versements.map((v) => (
                <a key={v.id} href={`/pdf/recus/${v.id}`} className="bg-amber-50 text-amber-800 px-3 py-2 rounded text-sm">
                  Reçu {v.numeroRecu ?? v.id}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
