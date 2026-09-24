import Link from "next/link";
import type { ReactNode } from "react";

const BADGES_ETUDIANT: Record<string, string> = {
  Actif: "bg-green-100 text-green-700",
  Suspendu: "bg-amber-100 text-amber-700",
  Diplômé: "bg-blue-100 text-blue-700",
  Abandon: "bg-red-100 text-red-700",
};

export function StatutBadge({ statut, className = "" }: { statut: string; className?: string }) {
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${BADGES_ETUDIANT[statut] ?? "bg-gray-100 text-gray-700"} ${className}`}
    >
      {statut}
    </span>
  );
}

const BADGES_PAIEMENT: Record<string, string> = {
  Soldé: "bg-green-100 text-green-700",
  Partiel: "bg-amber-100 text-amber-700",
  Impayé: "bg-red-100 text-red-700",
};

export function BadgePaiement({ statut }: { statut: string }) {
  return (
    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${BADGES_PAIEMENT[statut] ?? "bg-gray-100 text-gray-700"}`}>
      {statut}
    </span>
  );
}

export function Retour({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-gray-500 hover:text-gray-700">
      &larr; {children}
    </Link>
  );
}

export function EnTete({ surtitre, titre, children, description }: { surtitre?: string; titre: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {surtitre && <p className="text-sm text-gray-500">{surtitre}</p>}
        <h1 className="text-2xl font-bold text-insec">{titre}</h1>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Pagination simple (?page=N) conservant les autres paramètres de recherche. */
export function Pagination({
  page,
  total,
  parPage,
  chemin,
  params = {},
}: {
  page: number;
  total: number;
  parPage: number;
  chemin: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;
  const lien = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${chemin}?${q.toString()}`;
  };
  const debut = (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, total);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="Pagination">
      <p className="text-gray-500">
        {debut} à {fin} sur {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={lien(page - 1)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
            « Précédent
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg border bg-gray-50 text-gray-300">« Précédent</span>
        )}
        <span className="px-3 py-1.5 text-gray-600">
          Page {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={lien(page + 1)} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
            Suivant »
          </Link>
        ) : (
          <span className="px-3 py-1.5 rounded-lg border bg-gray-50 text-gray-300">Suivant »</span>
        )}
      </div>
    </nav>
  );
}

export function pageDepuis(valeur: string | string[] | undefined): number {
  const n = Number(Array.isArray(valeur) ? valeur[0] : valeur);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function param(valeur: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valeur) ? valeur[0] : valeur;
  return v === "" ? undefined : v;
}

export function idDepuis(valeur: string): number | null {
  const n = Number(valeur);
  return Number.isInteger(n) && n > 0 ? n : null;
}
