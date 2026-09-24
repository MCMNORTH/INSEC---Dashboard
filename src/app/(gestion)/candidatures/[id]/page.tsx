import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { candidatures } from "@/db/schema";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { Retour, idDepuis } from "@/components/ui";
import { exigerRole } from "@/lib/auth/current";
import { aujourdhui, formatDate } from "@/lib/format";
import { ADMINS } from "@/lib/roles";
import { DECISIONS_CANDIDATURE } from "@/lib/validation";
import { actionConvertir, actionDecider } from "../actions";

export const metadata: Metadata = { title: "Candidature" };

export default async function Candidature({ params }: PageProps<"/candidatures/[id]">) {
  await exigerRole(ADMINS);
  const id = idDepuis((await params).id);
  const c = id
    ? await getDb().query.candidatures.findFirst({
        where: eq(candidatures.id, id),
        with: { formation: true, annee: true, etudiant: true },
      })
    : undefined;
  if (!c) notFound();
  const inscrite = c.statut === "Inscrite";

  return (
    <>
      <Retour href="/candidatures">Retour aux candidatures</Retour>
      <div className="flex flex-wrap gap-3 justify-between mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-insec">
            {c.prenom} {c.nom}
          </h1>
          <p className="text-sm text-gray-500">
            {c.reference} · {c.formation.code} · {c.annee.libelle}
          </p>
        </div>
        <span className="h-fit bg-white border rounded-full px-4 py-2 text-sm font-semibold">{c.statut}</span>
      </div>
      <Flash className="mb-5" />
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 space-y-5">
          <article className="bg-white border rounded-xl p-5">
            <h2 className="font-bold text-insec mb-4">Informations du candidat</h2>
            <dl className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-400">E-mail</dt>
                <dd>{c.email}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Téléphone</dt>
                <dd>{c.telephone}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Date de naissance</dt>
                <dd>{c.dateNaissance ? formatDate(c.dateNaissance) : "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Dernier diplôme</dt>
                <dd>{c.dernierDiplome}</dd>
              </div>
            </dl>
            {c.motivation && (
              <div className="mt-5">
                <p className="text-sm text-gray-400">Motivation</p>
                <p className="text-sm mt-1 whitespace-pre-line">{c.motivation}</p>
              </div>
            )}
            {c.etudiant && (
              <p className="mt-5 text-sm">
                Dossier étudiant :{" "}
                <Link href={`/etudiants/${c.etudiant.id}`} className="text-insec font-semibold">
                  {c.etudiant.prenom} {c.etudiant.nom} →
                </Link>
              </p>
            )}
          </article>

          {c.statut === "Admissible" && (
            <article className="bg-white border border-or rounded-xl p-5">
              <h2 className="font-bold text-insec">Créer l’inscription définitive</h2>
              <p className="text-sm text-gray-500 mt-1 mb-4">Toutes les UE actives de l’année de parcours choisie seront rattachées.</p>
              <Formulaire action={actionConvertir.bind(null, c.id)} className="grid md:grid-cols-2 gap-4">
                <label className="text-sm">
                  Année de parcours
                  <select name="annee_parcours" className="w-full mt-1 rounded-lg">
                    {Array.from({ length: c.formation.dureeAnnees }, (_, i) => i + 1).map((i) => (
                      <option key={i} value={i}>
                        Année {i}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Date d’inscription
                  <input type="date" name="date_inscription" defaultValue={aujourdhui()} required className="w-full mt-1 rounded-lg" />
                </label>
                <label className="text-sm">
                  N° INTEC
                  <input name="numero_inscription_intec" className="w-full mt-1 rounded-lg" />
                </label>
                <label className="text-sm">
                  Montant dû (MRU)
                  <input type="number" min={0} name="montant_du" required className="w-full mt-1 rounded-lg" />
                </label>
                <BoutonEnvoi className="md:col-span-2 bg-insec text-white py-3 rounded-lg font-semibold">
                  Créer l’étudiant et son inscription
                </BoutonEnvoi>
              </Formulaire>
            </article>
          )}
        </section>
        <aside>
          <Formulaire action={actionDecider.bind(null, c.id)} erreurs="premiere" className="bg-white border rounded-xl p-5 space-y-4">
            <h2 className="font-bold text-insec">Décision administrative</h2>
            <label className="block text-sm">
              Statut
              <select name="statut" defaultValue={inscrite ? undefined : c.statut} disabled={inscrite} className="w-full mt-1 rounded-lg">
                {inscrite && <option>Inscrite</option>}
                {DECISIONS_CANDIDATURE.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Note interne
              <textarea name="note_interne" rows={5} defaultValue={c.noteInterne ?? ""} disabled={inscrite} className="w-full mt-1 rounded-lg" />
            </label>
            {inscrite ? (
              <p className="text-sm text-green-700">Dossier converti en étudiant.</p>
            ) : (
              <BoutonEnvoi className="w-full bg-gray-800 text-white py-2 rounded-lg">Enregistrer la décision</BoutonEnvoi>
            )}
          </Formulaire>
        </aside>
      </div>
    </>
  );
}
