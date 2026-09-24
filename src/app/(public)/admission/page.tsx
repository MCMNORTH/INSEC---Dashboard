import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { formations } from "@/db/schema";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { anneesRecentes } from "@/lib/requetes";
import { actionDeposer } from "./actions";

export const metadata: Metadata = { title: "Préinscription", robots: { index: true, follow: true } };

const CHAMPS: [string, string, string, boolean][] = [
  ["prenom", "Prénom", "text", true],
  ["nom", "Nom", "text", true],
  ["email", "Adresse e-mail", "email", true],
  ["telephone", "Téléphone", "tel", true],
  ["date_naissance", "Date de naissance", "date", false],
  ["dernier_diplome", "Dernier diplôme obtenu", "text", true],
];

export default async function Admission() {
  // Toujours rendu à la demande : les diplômes et années ouverts viennent de la base.
  await connection();
  const [liste, annees] = await Promise.all([
    getDb().select().from(formations).where(eq(formations.active, true)).orderBy(asc(formations.code)),
    anneesRecentes(),
  ]);
  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      <header className="bg-insec text-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between items-center">
          <strong className="text-xl">INSEC</strong>
          <Link href="/login" className="text-sm bg-white/10 px-4 py-2 rounded-lg">
            Espace connecté
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-6 py-10">
        <div className="mb-7">
          <p className="text-sm font-semibold text-or">DGC · DSGC — INTEC CNAM</p>
          <h1 className="text-3xl font-bold text-insec mt-1">Demande de préinscription</h1>
          <p className="text-gray-500 mt-2">
            Déposez votre candidature. L’équipe INSEC étudiera votre dossier avant toute inscription définitive.
          </p>
        </div>
        <Formulaire action={actionDeposer} className="bg-white border rounded-2xl shadow-sm p-6 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            {CHAMPS.map(([nom, libelle, type, requis]) => (
              <label key={nom} className="text-sm text-gray-600">
                {libelle}
                <input type={type} name={nom} required={requis} className="w-full mt-1 rounded-lg" />
              </label>
            ))}
            <label className="text-sm text-gray-600">
              Diplôme visé
              <select name="formation_id" required className="w-full mt-1 rounded-lg" defaultValue="">
                <option value="">Sélectionner…</option>
                {liste.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-600">
              Année académique
              <select name="annee_academique_id" required className="w-full mt-1 rounded-lg">
                {annees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm text-gray-600 block">
            Motivation <span className="text-gray-400">(facultatif)</span>
            <textarea name="motivation" rows={4} maxLength={2000} className="w-full mt-1 rounded-lg" />
          </label>
          <div aria-hidden className="hidden">
            <label>
              Site web
              <input name="site_web" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="flex gap-2 text-sm text-gray-600">
            <input type="checkbox" name="consentement" required className="rounded mt-1" />
            <span>Je certifie l’exactitude des informations transmises et autorise leur traitement pour ma demande d’admission.</span>
          </label>
          <BoutonEnvoi className="w-full bg-insec text-white font-semibold py-3 rounded-lg hover:bg-insec-dark">Envoyer ma candidature</BoutonEnvoi>
        </Formulaire>
      </main>
    </div>
  );
}
