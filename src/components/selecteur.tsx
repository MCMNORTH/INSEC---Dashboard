"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Liste déroulante qui recharge la page avec le paramètre choisi (filtre GET). */
export function SelectFiltre({
  nom,
  valeur,
  options,
  vide,
  libelle,
  className = "rounded-lg border-gray-300 text-sm",
  conserver = true,
}: {
  nom: string;
  valeur?: string | number | null;
  options: { valeur: string | number; libelle: string }[];
  vide?: string;
  libelle?: string;
  className?: string;
  conserver?: boolean;
}) {
  const router = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  return (
    <select
      name={nom}
      aria-label={libelle ?? nom}
      className={className}
      value={valeur ?? ""}
      onChange={(e) => {
        const q = new URLSearchParams(conserver ? params.toString() : "");
        if (e.target.value) q.set(nom, e.target.value);
        else q.delete(nom);
        q.delete("page");
        router.push(`${chemin}?${q.toString()}`);
      }}
    >
      {vide !== undefined && <option value="">{vide}</option>}
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  );
}

export function SelecteurAnnee({
  annees,
  valeur,
  nom,
  libelle,
}: {
  annees: { id: number; libelle: string }[];
  valeur?: number;
  nom: string;
  libelle: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border rounded-lg p-2">
      <span className="text-sm text-gray-500 pl-2">{libelle}</span>
      {annees.length ? (
        <SelectFiltre
          nom={nom}
          libelle={libelle}
          valeur={valeur}
          options={annees.map((a) => ({ valeur: a.id, libelle: a.libelle }))}
          className="border-0 py-1 pr-8 text-sm font-semibold focus:ring-0"
        />
      ) : (
        <span className="text-sm font-semibold pr-2">Aucune année</span>
      )}
    </div>
  );
}
