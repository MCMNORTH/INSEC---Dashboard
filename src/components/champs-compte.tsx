"use client";

import { useState } from "react";

type Dossier = { id: number; prenom: string; nom: string; email: string };

/** Le dossier à rattacher dépend du rôle choisi (étudiant ou enseignant). */
export function ChampsCompte({ etudiants, enseignants }: { etudiants: Dossier[]; enseignants: Dossier[] }) {
  const [role, setRole] = useState("etudiant");
  return (
    <>
      <select name="role" aria-label="Rôle" value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded">
        <option value="etudiant">Étudiant</option>
        <option value="enseignant">Enseignant</option>
        <option value="finance">Finance</option>
        <option value="admin">Administrateur</option>
      </select>
      {role === "etudiant" && (
        <select name="etudiant_id" aria-label="Dossier étudiant" className="w-full rounded" defaultValue="">
          <option value="">Dossier étudiant…</option>
          {etudiants.map((e) => (
            <option key={e.id} value={e.id}>
              {e.prenom} {e.nom} · {e.email}
            </option>
          ))}
        </select>
      )}
      {role === "enseignant" && (
        <select name="enseignant_id" aria-label="Dossier enseignant" className="w-full rounded" defaultValue="">
          <option value="">Dossier enseignant…</option>
          {enseignants.map((e) => (
            <option key={e.id} value={e.id}>
              {e.prenom} {e.nom} · {e.email}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
