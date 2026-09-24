"use client";

import { useState } from "react";

type UeOption = { id: number; code: string; libelle: string; credits: number; anneeParcours: number | null };
type FormationOption = { id: number; code: string | null; libelle: string | null; nom: string; dureeAnnees: number; ues: UeOption[] };

const STATUTS = [
  ["active", "Active"],
  ["terminée", "Terminée"],
  ["suspendue", "Suspendue"],
  ["annulée", "Annulée"],
] as const;

/** Champs d'inscription : les UE proposées dépendent du diplôme et de l'année de parcours choisis. */
export function ChampsInscription({
  formations,
  annees,
  valeurs,
  afficherStatut,
  aujourdhui,
}: {
  formations: FormationOption[];
  annees: { id: number; libelle: string }[];
  valeurs?: {
    formationId: number;
    anneeAcademiqueId: number;
    anneeParcours: number | null;
    dateInscription: string | null;
    numeroInscriptionIntec: string | null;
    statut: string;
    ueIds: number[];
  };
  afficherStatut: boolean;
  aujourdhui: string;
}) {
  const [formationId, setFormationId] = useState(valeurs ? String(valeurs.formationId) : "");
  const [annee, setAnnee] = useState(valeurs?.anneeParcours ? String(valeurs.anneeParcours) : "");
  const [cochees, setCochees] = useState<number[]>(valeurs?.ueIds ?? []);

  const formation = formations.find((f) => String(f.id) === formationId);
  const visibles = formation?.ues.filter((u) => String(u.anneeParcours) === annee) ?? [];
  const idsVisibles = new Set(visibles.map((u) => u.id));
  const maxAnnees = formation?.dureeAnnees ?? 3;

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-sm text-gray-600">
          Diplôme
          <select
            name="formation_id"
            required
            className="w-full rounded-lg mt-1"
            value={formationId}
            onChange={(e) => {
              setFormationId(e.target.value);
              setCochees([]);
            }}
          >
            <option value="">Sélectionner…</option>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code} — {f.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Année académique
          <select name="annee_academique_id" required className="w-full rounded-lg mt-1" defaultValue={valeurs?.anneeAcademiqueId}>
            {annees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Année de parcours
          <select
            name="annee_parcours"
            required
            className="w-full rounded-lg mt-1"
            value={annee}
            onChange={(e) => {
              setAnnee(e.target.value);
              setCochees([]);
            }}
          >
            <option value="">Sélectionner…</option>
            {Array.from({ length: Math.max(maxAnnees, 1) }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                Année {i}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Date d’inscription
          <input type="date" name="date_inscription" required className="w-full rounded-lg mt-1" defaultValue={valeurs?.dateInscription ?? aujourdhui} />
        </label>
        <label className="text-sm text-gray-600">
          N° d’inscription INTEC <span className="text-gray-400">(facultatif)</span>
          <input name="numero_inscription_intec" className="w-full rounded-lg mt-1" defaultValue={valeurs?.numeroInscriptionIntec ?? ""} />
        </label>
        {afficherStatut && (
          <label className="text-sm text-gray-600">
            Statut de l’inscription
            <select name="statut" className="w-full rounded-lg mt-1" defaultValue={valeurs?.statut ?? "active"}>
              {STATUTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-gray-700 mb-2">UE suivies</legend>
        <div className="grid md:grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3">
          {visibles.map((ue) => (
            <label key={ue.id} className="flex gap-2 rounded p-2 hover:bg-gray-50 text-sm">
              <input
                type="checkbox"
                name="ue_ids"
                value={ue.id}
                className="mt-0.5 rounded"
                checked={cochees.includes(ue.id)}
                onChange={(e) =>
                  setCochees((c) => (e.target.checked ? [...c, ue.id] : c.filter((x) => x !== ue.id)))
                }
              />
              <span>
                <strong>{ue.code}</strong> — {ue.libelle} <span className="text-xs text-gray-500">({ue.credits} ECTS)</span>
              </span>
            </label>
          ))}
          {visibles.length === 0 && <p className="text-sm text-gray-500">Choisissez d’abord le diplôme et l’année de parcours.</p>}
          {visibles.length > 0 && (
            <button
              type="button"
              className="md:col-span-2 text-left text-xs text-insec font-semibold"
              onClick={() => setCochees(cochees.filter((id) => idsVisibles.has(id)).length === visibles.length ? [] : visibles.map((u) => u.id))}
            >
              Tout cocher / décocher
            </button>
          )}
        </div>
      </fieldset>
    </>
  );
}
