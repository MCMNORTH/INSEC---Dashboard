import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { enseignants, etudiants, users } from "@/db/schema";
import { BoutonAction } from "@/components/bouton-action";
import { ChampsCompte } from "@/components/champs-compte";
import { Flash } from "@/components/flash";
import { BoutonEnvoi, Formulaire } from "@/components/formulaire";
import { exigerRole } from "@/lib/auth/current";
import { ADMINS, ROLE_LABELS, type Role } from "@/lib/roles";
import { actionBasculer, actionCreerCompte } from "./actions";

export const metadata: Metadata = { title: "Comptes & accès" };

export default async function Comptes() {
  const moi = await exigerRole(ADMINS);
  const db = getDb();
  const comptes = await db.query.users.findMany({ orderBy: asc(users.name), with: { etudiant: true, enseignant: true } });
  const etudiantsLies = new Set(comptes.map((c) => c.etudiantId).filter(Boolean));
  const enseignantsLies = new Set(comptes.map((c) => c.enseignantId).filter(Boolean));
  const etudiantsLibres = (await db.select().from(etudiants).orderBy(asc(etudiants.nom))).filter((e) => !etudiantsLies.has(e.id));
  const enseignantsLibres = (await db.select().from(enseignants).orderBy(asc(enseignants.nom))).filter((e) => !enseignantsLies.has(e.id));

  return (
    <>
      <h1 className="text-xl font-bold text-insec">Comptes & accès</h1>
      <p className="text-gray-500 mb-5">Création des accès et rattachement aux dossiers</p>
      <Flash />
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white rounded-xl shadow overflow-x-auto h-fit">
          <table className="w-full text-sm">
            <thead className="bg-insec text-white">
              <tr>
                <th className="p-3 text-left">Compte</th>
                <th className="p-3 text-left">Rôle</th>
                <th className="p-3 text-left">Dossier lié</th>
                <th className="p-3 text-left">Statut</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((c) => {
                const protege = c.id === moi.id || (c.role === "super_admin" && moi.role !== "super_admin");
                return (
                  <tr key={c.id} className="border-b">
                    <td className="p-3">
                      <strong>{c.name}</strong>
                      <br />
                      <span className="text-gray-500">{c.email}</span>
                    </td>
                    <td className="p-3">{ROLE_LABELS[c.role as Role] ?? c.role}</td>
                    <td className="p-3">
                      {c.etudiant
                        ? `${c.etudiant.prenom} ${c.etudiant.nom}`
                        : c.enseignant
                          ? `${c.enseignant.prenom} ${c.enseignant.nom}`
                          : "—"}
                    </td>
                    <td className="p-3">
                      <BoutonAction
                        action={actionBasculer}
                        champs={{ id: c.id }}
                        desactive={protege}
                        confirmation={c.active ? `Désactiver le compte de ${c.name} ?` : undefined}
                        titre={c.id === moi.id ? "Vous ne pouvez pas désactiver votre propre compte" : c.active ? "Désactiver" : "Activer"}
                        className={`px-2 py-1 rounded disabled:opacity-60 ${c.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {c.active ? "Actif" : "Désactivé"}
                      </BoutonAction>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside className="bg-white rounded-xl shadow p-5 h-fit">
          <h2 className="font-bold text-insec mb-3">Créer un compte</h2>
          <Formulaire action={actionCreerCompte} erreurs="premiere" className="space-y-3">
            <input name="name" placeholder="Nom affiché" aria-label="Nom affiché" required className="w-full rounded" />
            <input type="email" name="email" placeholder="E-mail" aria-label="E-mail" required className="w-full rounded" />
            <ChampsCompte
              etudiants={etudiantsLibres.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, email: e.email }))}
              enseignants={enseignantsLibres.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, email: e.email }))}
            />
            <input
              type="password"
              name="password"
              placeholder="Mot de passe (8 caractères min.)"
              aria-label="Mot de passe"
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded"
            />
            <input
              type="password"
              name="password_confirmation"
              placeholder="Confirmer le mot de passe"
              aria-label="Confirmer le mot de passe"
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full rounded"
            />
            <BoutonEnvoi className="w-full bg-amber-500 text-white p-2 rounded">Créer le compte</BoutonEnvoi>
          </Formulaire>
        </aside>
      </div>
    </>
  );
}
